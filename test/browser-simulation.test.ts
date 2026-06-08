import { describe, expect, it } from "bun:test";
import { runBrowserSimulation } from "../src/runtime/browser";

const PIN = 1_700_000_000_000;

describe("browser simulation", () => {
	it("serves MISS then HIT across two runs sharing cache state", async () => {
		const vcl = `
			sub vcl_recv { return(lookup); }
			sub vcl_fetch { set beresp.ttl = 3600s; return(deliver); }
		`;
		const request = { url: "/page", headers: { host: "example.com" } };
		const backendResponse = {
			status: 200,
			headers: { "content-type": "text/plain" },
			body: "hello",
		};
		const platformOptions = { now: PIN };

		const first = await runBrowserSimulation({ vcl, request, backendResponse, platformOptions });
		expect(first.ok).toBe(true);
		expect(first.cacheDecision?.outcome).toBe("miss");
		expect(first.cacheDecision?.stored).toBe(true);
		expect(first.response?.headers["X-Cache"]).toBe("MISS");
		expect(first.response?.body).toBe("hello");

		const second = await runBrowserSimulation({
			vcl,
			request,
			backendResponse,
			platformOptions,
			cacheState: first.cacheState,
		});
		expect(second.cacheDecision?.outcome).toBe("hit");
		expect(second.response?.headers["X-Cache"]).toBe("HIT");
		expect(second.response?.body).toBe("hello");
	});

	it("captures the execution trace", async () => {
		const result = await runBrowserSimulation({
			vcl: `
				sub vcl_recv { return(lookup); }
				sub vcl_fetch { return(deliver); }
				sub vcl_deliver { return(deliver); }
			`,
			request: { url: "/" },
			backendResponse: { status: 200, body: "x" },
			platformOptions: { now: PIN },
		});
		const subroutines = result.trace.map((e) => e.subroutine);
		expect(subroutines).toContain("vcl_recv");
		expect(subroutines).toContain("vcl_fetch");
		expect(subroutines).toContain("vcl_deliver");
		// recv emits an entry (no returnAction) and an exit (with returnAction)
		const recv = result.trace.filter((e) => e.subroutine === "vcl_recv");
		expect(recv.some((e) => e.returnAction === "lookup")).toBe(true);
	});

	it("captures VCL log statements per run", async () => {
		const result = await runBrowserSimulation({
			vcl: 'sub vcl_recv { log "hello from vcl"; return(lookup); } sub vcl_fetch { return(deliver); }',
			request: { url: "/" },
			backendResponse: { status: 200, body: "x" },
			platformOptions: { now: PIN },
		});
		expect(result.logs).toContain("[VCL] hello from vcl");
	});

	it("returns structured diagnostics for invalid VCL", async () => {
		const result = await runBrowserSimulation({
			vcl: "sub vcl_recv {\n  set req.http.X =\n}\n",
			request: { url: "/" },
			backendResponse: { status: 200, body: "x" },
		});
		expect(result.ok).toBe(false);
		expect(result.diagnostics.length).toBeGreaterThan(0);
		expect(result.diagnostics[0]!.line).toBeGreaterThan(0);
		expect(result.diagnostics[0]!.sourceFrame).toContain("^");
		expect(typeof result.diagnostics[0]!.message).toBe("string");
	});

	it("reports unsupported RSA/ECDSA as a run-blocking compatibility error", async () => {
		const result = await runBrowserSimulation({
			vcl: 'sub vcl_recv { if (digest.rsa_verify("sha256", "key", "payload", "sig")) { set req.http.X = "1"; } return(lookup); }',
			request: { url: "/" },
			backendResponse: { status: 200, body: "x" },
			platformOptions: { now: PIN },
		});
		expect(result.ok).toBe(false);
		expect(result.error?.kind).toBe("unsupported");
		expect(result.error?.message).toContain("RSA/ECDSA");
	});

	it("is deterministic for a seeded run", async () => {
		const opts = {
			vcl: 'sub vcl_recv { log "r=" + randomstr(12); return(lookup); } sub vcl_fetch { return(deliver); }',
			request: { url: "/" },
			backendResponse: { status: 200, body: "x" },
			platformOptions: { now: PIN, randomSeed: 99 },
		};
		const a = await runBrowserSimulation(opts);
		const b = await runBrowserSimulation(opts);
		// Same seed -> same generated random string
		expect(a.logs[0]).toMatch(/^\[VCL\] r=.{12}$/);
		expect(a.logs).toEqual(b.logs);
	});
});
