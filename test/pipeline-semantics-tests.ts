import { runPipeline } from "../src/runtime/pipeline";
import { createVCLContext } from "../src/vcl";
import type { VCLContext, VCLSubroutines } from "../src/vcl-compiler";
import { assert, executeSubroutine, type TestSuite } from "./test-framework";

async function fakeBackend() {
	return {
		status: 200,
		headers: { "content-type": "text/plain" },
		body: "ok",
	};
}

const pipelineSemanticsTests: TestSuite = {
	name: "Pipeline Semantics Tests",
	tests: [
		{
			name: "client.ip !~ acl matches the complement of the ACL",
			vclSnippet: `
        acl internal {
          "10.0.0.0"/8;
        }
        sub vcl_recv {
          set req.http.X-Neg = "no";
          set req.http.X-Pos = "no";
          if (client.ip !~ internal) {
            set req.http.X-Neg = "yes";
          }
          if (client.ip ~ internal) {
            set req.http.X-Pos = "yes";
          }
          return(lookup);
        }
      `,
			run: async (context: VCLContext, subroutines: VCLSubroutines) => {
				context.client!.ip = "8.8.8.8";
				executeSubroutine(context, subroutines, "vcl_recv");
			},
			assertions: [
				(context) =>
					assert(
						context.req.http["X-Neg"] === "yes",
						"!~ should be true for an IP outside the ACL",
					),
				(context) =>
					assert(context.req.http["X-Pos"] === "no", "~ should be false for an IP outside the ACL"),
			],
		},
		{
			name: "ACL matching works inside compound conditions",
			vclSnippet: `
        acl internal {
          "10.0.0.0"/8;
        }
        sub vcl_recv {
          set req.http.X-Blocked = "no";
          if (req.url ~ "^/admin" && client.ip !~ internal) {
            set req.http.X-Blocked = "yes";
          }
          return(lookup);
        }
      `,
			run: async (context: VCLContext, subroutines: VCLSubroutines) => {
				context.req.url = "/admin/panel";
				context.client!.ip = "8.8.8.8";
				executeSubroutine(context, subroutines, "vcl_recv");
			},
			assertions: [
				(context) =>
					assert(
						context.req.http["X-Blocked"] === "yes",
						"compound condition with client.ip !~ acl should match an external IP",
					),
			],
		},
		{
			name: "ACL matching inside a compound condition lets internal IPs through",
			vclSnippet: `
        acl internal {
          "10.0.0.0"/8;
        }
        sub vcl_recv {
          set req.http.X-Blocked = "no";
          if (req.url ~ "^/admin" && client.ip !~ internal) {
            set req.http.X-Blocked = "yes";
          }
          return(lookup);
        }
      `,
			run: async (context: VCLContext, subroutines: VCLSubroutines) => {
				context.req.url = "/admin/panel";
				context.client!.ip = "10.1.2.3";
				executeSubroutine(context, subroutines, "vcl_recv");
			},
			assertions: [
				(context) =>
					assert(
						context.req.http["X-Blocked"] === "no",
						"an IP inside the ACL should not trigger the !~ branch",
					),
			],
		},
		{
			name: "restart statement increments req.restarts once per restart",
			vclSnippet: `
        sub vcl_recv {
          set req.http.X-Seen = req.http.X-Seen ", " req.restarts;
          if (req.restarts < 2) {
            restart;
          }
          return(lookup);
        }
      `,
			run: async (context: VCLContext, subroutines: VCLSubroutines) => {
				context.req.url = "/restart-count";
				const result = await runPipeline({
					subroutines,
					context,
					cache: new Map(),
					maxRestarts: 3,
					getBackendResponse: fakeBackend,
				});
				context.req.http["X-Final-Restarts"] = String(result.restarts);
				context.req.http["X-Status"] = String(result.response.status);
			},
			assertions: [
				(context) =>
					assert(
						context.req.http["X-Seen"] === "(null), 0, 1, 2",
						`vcl_recv should observe req.restarts as 0, 1, 2 (got "${context.req.http["X-Seen"]}")`,
					),
				(context) => assert(context.req.http["X-Final-Restarts"] === "2", "two restarts total"),
				(context) => assert(context.req.http["X-Status"] === "200", "request should succeed"),
			],
		},
		{
			name: "return(restart) counts the same as the restart statement",
			vclSnippet: `
        sub vcl_recv {
          set req.http.X-Seen = req.http.X-Seen ", " req.restarts;
          if (req.restarts < 2) {
            return(restart);
          }
          return(lookup);
        }
      `,
			run: async (context: VCLContext, subroutines: VCLSubroutines) => {
				context.req.url = "/restart-return";
				const result = await runPipeline({
					subroutines,
					context,
					cache: new Map(),
					maxRestarts: 3,
					getBackendResponse: fakeBackend,
				});
				context.req.http["X-Final-Restarts"] = String(result.restarts);
			},
			assertions: [
				(context) =>
					assert(
						context.req.http["X-Seen"] === "(null), 0, 1, 2",
						`vcl_recv should observe req.restarts as 0, 1, 2 (got "${context.req.http["X-Seen"]}")`,
					),
				(context) => assert(context.req.http["X-Final-Restarts"] === "2", "two restarts total"),
			],
		},
		{
			name: "restarting forever stops with a 503 at the restart limit",
			vclSnippet: `
        sub vcl_recv {
          restart;
        }
      `,
			run: async (context: VCLContext, subroutines: VCLSubroutines) => {
				context.req.url = "/restart-forever";
				const result = await runPipeline({
					subroutines,
					context,
					cache: new Map(),
					maxRestarts: 3,
					getBackendResponse: fakeBackend,
				});
				context.req.http["X-Final-Restarts"] = String(result.restarts);
				context.req.http["X-Status"] = String(result.response.status);
			},
			assertions: [
				(context) =>
					assert(context.req.http["X-Status"] === "503", "hitting the limit returns 503"),
				(context) =>
					assert(context.req.http["X-Final-Restarts"] === "3", "the limit allows three restarts"),
			],
		},
		{
			name: "restart from vcl_fetch re-runs the request",
			vclSnippet: `
        sub vcl_recv {
          if (req.restarts > 0) {
            set req.http.X-Restarted = "yes";
          }
          return(pass);
        }
        sub vcl_fetch {
          if (req.restarts == 0) {
            restart;
          }
          return(pass);
        }
      `,
			run: async (context: VCLContext, subroutines: VCLSubroutines) => {
				context.req.url = "/fetch-restart";
				const result = await runPipeline({
					subroutines,
					context,
					cache: new Map(),
					maxRestarts: 3,
					getBackendResponse: fakeBackend,
				});
				context.req.http["X-Final-Restarts"] = String(result.restarts);
				context.req.http["X-Status"] = String(result.response.status);
			},
			assertions: [
				(context) =>
					assert(context.req.http["X-Restarted"] === "yes", "vcl_recv ran a second time"),
				(context) => assert(context.req.http["X-Final-Restarts"] === "1", "one restart counted"),
				(context) => assert(context.req.http["X-Status"] === "200", "request completed"),
			],
		},
		{
			name: "restart from vcl_deliver re-runs the request",
			vclSnippet: `
        sub vcl_recv {
          return(pass);
        }
        sub vcl_deliver {
          if (req.restarts == 0) {
            return(restart);
          }
          return(deliver);
        }
      `,
			run: async (context: VCLContext, subroutines: VCLSubroutines) => {
				context.req.url = "/deliver-restart";
				const result = await runPipeline({
					subroutines,
					context,
					cache: new Map(),
					maxRestarts: 3,
					getBackendResponse: fakeBackend,
				});
				context.req.http["X-Final-Restarts"] = String(result.restarts);
				context.req.http["X-Status"] = String(result.response.status);
			},
			assertions: [
				(context) => assert(context.req.http["X-Final-Restarts"] === "1", "one restart counted"),
				(context) => assert(context.req.http["X-Status"] === "200", "request completed"),
			],
		},
		{
			name: "restart from vcl_error re-runs the request",
			vclSnippet: `
        sub vcl_recv {
          if (req.restarts == 0) {
            error 601;
          }
          set req.http.X-Second-Pass = "yes";
          return(pass);
        }
        sub vcl_error {
          if (obj.status == 601 && req.restarts == 0) {
            return(restart);
          }
          return(deliver);
        }
      `,
			run: async (context: VCLContext, subroutines: VCLSubroutines) => {
				context.req.url = "/error-restart";
				const result = await runPipeline({
					subroutines,
					context,
					cache: new Map(),
					maxRestarts: 3,
					getBackendResponse: fakeBackend,
				});
				context.req.http["X-Final-Restarts"] = String(result.restarts);
				context.req.http["X-Status"] = String(result.response.status);
			},
			assertions: [
				(context) =>
					assert(context.req.http["X-Second-Pass"] === "yes", "vcl_recv ran past the error"),
				(context) => assert(context.req.http["X-Final-Restarts"] === "1", "one restart counted"),
				(context) => assert(context.req.http["X-Status"] === "200", "request completed"),
			],
		},
		{
			name: "a restart recomputes the cache key instead of appending hash data",
			vclSnippet: `
        sub vcl_hash {
          hash_data(req.url);
          return(hash);
        }
        sub vcl_deliver {
          if (req.restarts == 0) {
            return(restart);
          }
          return(deliver);
        }
        sub vcl_fetch {
          set beresp.ttl = 60s;
          return(deliver);
        }
      `,
			run: async (context: VCLContext, subroutines: VCLSubroutines) => {
				// The first pass stores the object, then vcl_deliver restarts. The
				// second pass can only find that object if its cache key is computed
				// from a clean slate rather than doubled-up hash data.
				context.req.url = "/hash-restart";
				const result = await runPipeline({
					subroutines,
					context,
					cache: new Map(),
					maxRestarts: 3,
					getBackendResponse: fakeBackend,
				});
				context.req.http["X-Outcome"] = result.cache.outcome;
				context.req.http["X-Final-Restarts"] = String(result.restarts);
			},
			assertions: [
				(context) =>
					assert(
						context.req.http["X-Outcome"] === "hit",
						"the restarted pass must hit the object the first pass cached",
					),
				(context) => assert(context.req.http["X-Final-Restarts"] === "1", "one restart counted"),
			],
		},
		{
			name: "beresp starts clean on every pass",
			vclSnippet: `
        sub vcl_recv {
          return(pass);
        }
        sub vcl_fetch {
          if (beresp.cacheable) {
            set req.http.X-Leaked = "yes";
          }
          set beresp.cacheable = true;
          set beresp.http.X-From-VCL = "pass-" req.restarts;
          return(pass);
        }
        sub vcl_deliver {
          if (req.restarts == 0) {
            return(restart);
          }
          return(deliver);
        }
      `,
			run: async (context: VCLContext, subroutines: VCLSubroutines) => {
				context.req.url = "/beresp-clean";
				await runPipeline({
					subroutines,
					context,
					cache: new Map(),
					maxRestarts: 3,
					getBackendResponse: fakeBackend,
				});
			},
			assertions: [
				(context) =>
					assert(
						context.req.http["X-Leaked"] === undefined,
						"beresp.cacheable from the first pass must not survive the restart",
					),
			],
		},
		{
			name: "a call parameter shadowing an ACL is restored after the call",
			vclSnippet: `
        acl internal {
          "10.0.0.0"/8;
        }
        sub tag_request(STRING internal) {
          set req.http.X-Tag = internal;
        }
        sub vcl_recv {
          call tag_request("hello");
          set req.http.X-In-Acl = "no";
          if (client.ip ~ internal) {
            set req.http.X-In-Acl = "yes";
          }
          return(lookup);
        }
      `,
			run: async (context: VCLContext, subroutines: VCLSubroutines) => {
				context.client!.ip = "10.1.2.3";
				executeSubroutine(context, subroutines, "vcl_recv");
			},
			assertions: [
				(context) => assert(context.req.http["X-Tag"] === "hello", "the parameter was usable"),
				(context) =>
					assert(
						context.req.http["X-In-Acl"] === "yes",
						"after the call returns, the identifier resolves to the ACL again",
					),
			],
		},
		{
			name: "a string right-hand side is a regex even when an ACL has the same name",
			vclSnippet: `
        acl internal {
          "10.0.0.0"/8;
        }
        sub vcl_recv {
          set req.http.X-Match = "no";
          if (req.url ~ "internal") {
            set req.http.X-Match = "yes";
          }
          return(lookup);
        }
      `,
			run: async (context: VCLContext, subroutines: VCLSubroutines) => {
				context.req.url = "/internal/page";
				executeSubroutine(context, subroutines, "vcl_recv");
			},
			assertions: [
				(context) =>
					assert(
						context.req.http["X-Match"] === "yes",
						"the quoted string must regex-match the URL, not name the ACL",
					),
			],
		},
		{
			name: "vcl_hit without a return delivers the cached object",
			vclSnippet: `
        sub vcl_hit {
          set req.http.X-Hit-Ran = "yes";
        }
        sub vcl_fetch {
          set beresp.ttl = 60s;
          return(deliver);
        }
      `,
			run: async (context: VCLContext, subroutines: VCLSubroutines) => {
				const cache = new Map();
				const primeCtx = createVCLContext();
				primeCtx.req.url = "/hit-default";
				await runPipeline({
					subroutines,
					context: primeCtx,
					cache,
					maxRestarts: 3,
					getBackendResponse: fakeBackend,
				});
				context.req.url = "/hit-default";
				const result = await runPipeline({
					subroutines,
					context,
					cache,
					maxRestarts: 3,
					getBackendResponse: fakeBackend,
				});
				context.req.http["X-Outcome"] = result.cache.outcome;
				context.req.http["X-Cache-Header"] = result.response.headers["X-Cache"] ?? "";
			},
			assertions: [
				(context) =>
					assert(context.req.http["X-Outcome"] === "hit", "second request is a cache hit"),
				(context) => assert(context.req.http["X-Hit-Ran"] === "yes", "vcl_hit executed"),
				(context) =>
					assert(context.req.http["X-Cache-Header"] === "HIT", "the cached object is delivered"),
			],
		},
	],
};

export default pipelineSemanticsTests;
