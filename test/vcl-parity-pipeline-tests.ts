// Fastly VCL behaviors that only surface across the full request lifecycle:
// beresp.backend.* after a real backend request, and the PCI/HIPAA flag
// persisting onto a cached object.

import { describe, expect, it } from "bun:test";
import "../src/platform-node";
import { type CacheEntry, runPipeline } from "../src/runtime/pipeline";
import { createVCLContext, loadVCLContent } from "../src/vcl";

async function okBackend() {
	return { status: 200, headers: { "content-type": "text/plain" }, body: "ok" };
}

async function drive(vcl: string, cache: Map<string, CacheEntry>) {
	const context = createVCLContext();
	context.req.url = "/";
	context.req.method = "GET";
	context.cache = cache;
	return runPipeline({
		subroutines: loadVCLContent(vcl),
		context,
		cache,
		maxRestarts: 3,
		getBackendResponse: okBackend,
	});
}

describe("beresp.backend.* reflects the backend request", () => {
	const vcl = `
    backend origin { .host = "example.com"; .port = 80; }
    sub vcl_recv { set req.backend = origin; return(lookup); }
    sub vcl_deliver {
      set resp.http.BName = "[" + beresp.backend.name + "]";
      set resp.http.BHost = "[" + beresp.backend.host + "]";
      set resp.http.BPort = beresp.backend.port;
    }
  `;

	it("reports name, host, and port on a miss", async () => {
		const result = await drive(vcl, new Map());
		expect(result.response.headers.BName).toBe("[origin]");
		expect(result.response.headers.BHost).toBe("[example.com]");
		expect(result.response.headers.BPort).toBe("80");
	});

	it("reads not set on a cache hit, when no backend request was made", async () => {
		const cache = new Map<string, CacheEntry>();
		await drive(`sub vcl_fetch { set beresp.ttl = 60s; }\n${vcl}`, cache);
		const hit = await drive(`sub vcl_fetch { set beresp.ttl = 60s; }\n${vcl}`, cache);
		expect(hit.cache.outcome).toBe("hit");
		expect(hit.response.headers.BName).toBe("[]");
		expect(hit.response.headers.BHost).toBe("[(null)]");
		expect(hit.response.headers.BPort).toBe("0");
	});
});

describe("return(upgrade)", () => {
	it("bypasses cache and fetch, responds 101, and runs vcl_log", async () => {
		const vcl = `
      sub vcl_recv { return(upgrade); }
      sub vcl_log { set req.http.Logged = "1"; }
    `;
		const context = createVCLContext();
		context.req.url = "/ws";
		context.req.method = "GET";
		const cache = new Map<string, CacheEntry>();
		context.cache = cache;
		const result = await runPipeline({
			subroutines: loadVCLContent(vcl),
			context,
			cache,
			maxRestarts: 3,
			getBackendResponse: async () => {
				throw new Error("upgrade must not fetch a backend");
			},
		});
		expect(result.response.status).toBe(101);
		expect(result.response.statusText).toBe("Switching Protocols");
		expect(result.cache.outcome).toBe("upgrade");
		expect(result.action).toBe("upgrade");
		expect(context.fastly?.state).toBe("UPGRADE");
		expect(context.req.http.Logged).toBe("1");
	});
});

describe("PCI/HIPAA flags", () => {
	it("beresp.hipaa and beresp.pci are the same flag", async () => {
		const vcl = `
      sub vcl_fetch {
        set beresp.hipaa = true;
        set beresp.http.Seen = if(beresp.pci, "1", "0");
      }
      sub vcl_deliver { set resp.http.Seen = beresp.http.Seen; }
    `;
		const result = await drive(vcl, new Map());
		expect(result.response.headers.Seen).toBe("1");
	});

	it("obj.is_pci and obj.is_hipaa reflect the cached flag on a hit", async () => {
		const vcl = `
      sub vcl_fetch { set beresp.pci = true; set beresp.ttl = 60s; }
      sub vcl_hit {
        set req.http.P = if(obj.is_pci, "1", "0");
        set req.http.H = if(obj.is_hipaa, "1", "0");
      }
      sub vcl_deliver {
        set resp.http.P = req.http.P;
        set resp.http.H = req.http.H;
      }
    `;
		const cache = new Map<string, CacheEntry>();
		await drive(vcl, cache);
		const hit = await drive(vcl, cache);
		expect(hit.cache.outcome).toBe("hit");
		expect(hit.response.headers.P).toBe("1");
		expect(hit.response.headers.H).toBe("1");
	});

	it("obj.is_pci is false for an object cached without the flag", async () => {
		const vcl = `
      sub vcl_fetch { set beresp.ttl = 60s; }
      sub vcl_hit { set req.http.P = if(obj.is_pci, "1", "0"); }
      sub vcl_deliver { set resp.http.P = req.http.P; }
    `;
		const cache = new Map<string, CacheEntry>();
		await drive(vcl, cache);
		const hit = await drive(vcl, cache);
		expect(hit.cache.outcome).toBe("hit");
		expect(hit.response.headers.P).toBe("0");
	});
});
