// Fastly limit enforcement and the compound-assignment header fix.
//
// These pin two production behaviours that are easy to drift on: a `set` with a
// compound operator must read the current header and append, and the
// interpreter must reject programs that would blow Fastly's inlined call-tree or
// per-request workspace limits rather than running past them silently.

import "../src/platform-node";
import { describe, expect, it } from "bun:test";
import { createVCLContext, executeVCL, loadVCLContent } from "../src/vcl";
import {
	BASE_REQUEST_WORKSPACE_OVERHEAD,
	headerWorkspaceCost,
	seedRequestWorkspace,
	VCLLimitExceededError,
} from "../src/vcl-limits";

function runRecv(vcl: string) {
	const subroutines = loadVCLContent(vcl);
	const context = createVCLContext();
	executeVCL(subroutines, "vcl_recv", context);
	return context;
}

describe("compound assignment on headers", () => {
	it("appends to an existing request header", () => {
		const ctx = runRecv(`sub vcl_recv {
			set req.http.A = "abc";
			set req.http.A += "xy";
		}`);
		expect(ctx.req.http.A).toBe("abcxy");
	});

	it("sets an unset header when appended to", () => {
		const ctx = runRecv(`sub vcl_recv { set req.http.A += "xy"; }`);
		expect(ctx.req.http.A).toBe("xy");
	});

	it("appends a multi-fragment value rather than its object form", () => {
		const ctx = runRecv(`sub vcl_recv {
			set req.http.A = "1";
			set req.http.A += "2";
			set req.http.A += "3" "4";
		}`);
		expect(ctx.req.http.A).toBe("1234");
	});

	it("still overwrites with a plain assignment", () => {
		const ctx = runRecv(`sub vcl_recv {
			set req.http.A = "abc";
			set req.http.A = "xy";
		}`);
		expect(ctx.req.http.A).toBe("xy");
	});

	it("appends to a response header", () => {
		const subroutines = loadVCLContent(`sub vcl_deliver {
			set resp.http.A = "abc";
			set resp.http.A += "xy";
		}`);
		const ctx = createVCLContext();
		executeVCL(subroutines, "vcl_deliver", ctx);
		expect(ctx.resp.http.A).toBe("abcxy");
	});
});

describe("subroutine call-tree limit", () => {
	it("accepts a modest call tree", () => {
		const vcl = `sub leaf { set req.http.X = "1"; }
			sub mid { ${"call leaf; ".repeat(10)} }
			sub vcl_recv { ${"call mid; ".repeat(10)} }`;
		expect(() => loadVCLContent(vcl)).not.toThrow();
	});

	it("rejects an explosive call tree", () => {
		// 20^4 inlined calls, far over the 25000 ceiling.
		const vcl = `sub leaf { set req.http.X = "1"; }
			sub a { ${"call leaf; ".repeat(20)} }
			sub b { ${"call a; ".repeat(20)} }
			sub c { ${"call b; ".repeat(20)} }
			sub vcl_recv { ${"call c; ".repeat(20)} }`;
		expect(() => loadVCLContent(vcl)).toThrow(VCLLimitExceededError);
		expect(() => loadVCLContent(vcl)).toThrow(/Too many sub calls/);
	});

	it("counts calls nested in if and switch blocks", () => {
		const vcl = `sub leaf { set req.http.X = "1"; }
			sub vcl_recv {
				if (req.http.Host) { ${"call leaf; ".repeat(5)} }
				else { ${"call leaf; ".repeat(5)} }
				switch (req.http.Host) {
					case "a": ${"call leaf; ".repeat(5)} break;
					default: ${"call leaf; ".repeat(5)} break;
				}
			}`;
		// 20 reachable call statements, each leaf cost 0 -> total 20, well under.
		expect(() => loadVCLContent(vcl)).not.toThrow();
	});

	it("terminates on recursive VCL", () => {
		const vcl = `sub a { call b; } sub b { call a; } sub vcl_recv { call a; }`;
		expect(() => loadVCLContent(vcl)).not.toThrow();
	});
});

describe("request workspace limit", () => {
	it("accepts ordinary header writes", () => {
		const ctx = runRecv(`sub vcl_recv {
			set req.http.A = "hello";
			set req.http.B = "world";
		}`);
		expect(ctx.req.http.A).toBe("hello");
		expect(ctx.req.http.B).toBe("world");
	});

	it("overflows when a header is rewritten many times", () => {
		const big = "v".repeat(1000);
		const vcl = `sub vcl_recv { ${`set req.http.X = "${big}"; `.repeat(300)} }`;
		expect(() => runRecv(vcl)).toThrow(/Header overflow/);
	});

	it("counts intermediate copies left behind while a header grows", () => {
		const chunk = "a".repeat(2000);
		// Each append assembles a fresh, larger copy, so the running total grows
		// faster than the final header and overflows before the 40th append.
		const vcl = `sub vcl_recv {
			set req.http.X = "${chunk}";
			${`set req.http.X += "${chunk}"; `.repeat(40)}
		}`;
		expect(() => runRecv(vcl)).toThrow(VCLLimitExceededError);
	});

	it("does not reclaim the workspace across restarts", () => {
		const vcl = `sub vcl_recv { set req.http.X = "${"y".repeat(1000)}"; }`;
		const subroutines = loadVCLContent(vcl);
		const ctx = createVCLContext();
		executeVCL(subroutines, "vcl_recv", ctx);
		const afterFirst = ctx.workspaceBytes ?? 0;
		executeVCL(subroutines, "vcl_recv", ctx); // a restart reuses the context
		const afterSecond = ctx.workspaceBytes ?? 0;
		expect(afterSecond).toBeGreaterThan(afterFirst);
	});

	it("reports consumption through workspace.* variables", () => {
		const ctx = runRecv(`sub vcl_recv {
			set req.http.X = "${"z".repeat(100)}";
			set req.http.Free = workspace.bytes_free;
			set req.http.Total = workspace.bytes_total;
			set req.http.Over = workspace.overflowed;
		}`);
		expect(ctx.req.http.Total).toBe("262144");
		expect(Number(ctx.req.http.Free)).toBeGreaterThan(0);
		expect(Number(ctx.req.http.Free)).toBeLessThan(262144);
		expect(ctx.req.http.Over).toBe("false");
	});
});

describe("request workspace charge formula", () => {
	// A write costs roundUp8(name + value + 3), where name is the bare header
	// name. runRecv does not seed the inbound baseline, so workspaceBytes here is
	// exactly the cost of the write under test.
	it("charges the bare name, value and three bytes, rounded to 8", () => {
		// roundUp8(5 + 5 + 3) = roundUp8(13) = 16
		const ctx = runRecv(`sub vcl_recv { set req.http.X-Foo = "hello"; }`);
		expect(ctx.workspaceBytes).toBe(16);
	});

	it("does not charge the req.http. prefix", () => {
		// roundUp8(1 + 1 + 3) = 8, not roundUp8("req.http.a".length + 1) = 16
		const ctx = runRecv(`sub vcl_recv { set req.http.a = "b"; }`);
		expect(ctx.workspaceBytes).toBe(8);
	});

	it("charges add the same way", () => {
		// roundUp8(3 + 5 + 3) = roundUp8(11) = 16
		const ctx = runRecv(`sub vcl_recv { add req.http.Via = "proxy"; }`);
		expect(ctx.workspaceBytes).toBe(16);
	});

	it("counts name and value identically and rounds up to 8", () => {
		expect(headerWorkspaceCost("X-Foo", "hello")).toBe(16);
		// same name+value total (16) regardless of the split between the two
		expect(headerWorkspaceCost("a".repeat(13), "x".repeat(3))).toBe(
			headerWorkspaceCost("a".repeat(3), "x".repeat(13)),
		);
		// a `:subfield` is dropped from the name
		expect(headerWorkspaceCost("Cookie:sess", "x")).toBe(headerWorkspaceCost("Cookie", "x"));
	});
});

describe("inbound request workspace baseline", () => {
	it("charges the fixed overhead with no headers", () => {
		expect(seedRequestWorkspace({})).toBe(BASE_REQUEST_WORKSPACE_OVERHEAD);
	});

	it("adds each inbound header with the same formula", () => {
		const seeded = seedRequestWorkspace({ "x-foo": "hello", host: "example.com" });
		expect(seeded).toBe(
			BASE_REQUEST_WORKSPACE_OVERHEAD +
				headerWorkspaceCost("x-foo", "hello") +
				headerWorkspaceCost("host", "example.com"),
		);
	});
});
