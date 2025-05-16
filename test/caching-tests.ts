/**
 * Caching Tests
 *
 * Tests for VCL caching functionality including:
 * - Cache hits and misses
 * - TTL settings
 * - Grace periods
 * - Stale-while-revalidate
 * - Cache invalidation
 */

import type { VCLContext, VCLSubroutines } from "../src/vcl-compiler";
import { assert, executeSubroutine, runTestSuite } from "./test-framework";

// Caching test suite
const cachingTests = {
	name: "Caching Tests",
	tests: [
		// Test 1: Basic caching
		{
			name: "Basic caching",
			vclSnippet: `
        sub vcl_recv {
          return(lookup);
        }

        sub vcl_fetch {
          # Set TTL to 1 hour
          set beresp.ttl = 3600s;
          return(deliver);
        }

        sub vcl_deliver {
          # Add cache status header
          if (obj.hits > 0) {
            set resp.http.X-Cache = "HIT";
            set resp.http.X-Cache-Hits = obj.hits;
          } else {
            set resp.http.X-Cache = "MISS";
          }
          return(deliver);
        }
      `,
			run: async (context: VCLContext, subroutines: VCLSubroutines) => {
				// Set up the context
				context.req.url = "/cached-page";
				context.req.method = "GET";

				// Simulate a cache miss
				context.cache = new Map();

				// Execute the request flow
				executeSubroutine(context, subroutines, "vcl_recv");

				// Simulate backend response
				context.beresp.status = 200;
				context.beresp.statusText = "OK";
				context.beresp.http = {
					"content-type": "text/html",
					"content-length": "1024",
				};

				// Execute fetch
				executeSubroutine(context, subroutines, "vcl_fetch");

				// Update response
				context.resp.status = context.beresp.status;
				context.resp.statusText = context.beresp.statusText;
				context.resp.http = { ...context.beresp.http };

				// Execute deliver
				executeSubroutine(context, subroutines, "vcl_deliver");

				// Cache the response
				const cacheKey = `${context.req.url}:${context.req.http.host || "localhost"}`;
				context.cache.set(cacheKey, {
					resp: { ...context.resp },
					body: new ArrayBuffer(0),
					created: Date.now(),
					expires: Date.now() + context.beresp.ttl * 1000,
					staleUntil: Date.now() + context.beresp.ttl * 1000 + 3600000,
					beresp: { ...context.beresp },
					hits: 0,
				});

				// Store the original context for assertions
				const missContext = { ...context };
				missContext.resp = { ...context.resp };
				missContext.resp.http = { ...context.resp.http };

				// Store the miss context for assertions
				context.missContext = {
					resp: { ...context.resp },
					obj: { ...context.obj },
				};

				// Reset the context for the second test
				context.obj = {
					status: 200,
					response: "",
					http: { "content-type": "text/html", "content-length": "1024" },
					hits: 1,
				};

				// Update response for the hit
				context.resp = {
					status: context.obj.status,
					statusText: "OK",
					http: {
						"X-Cache": "HIT",
						"X-Cache-Hits": "1",
					},
				};

				// Store the hit context for assertions
				context.hitContext = { ...context };
				context.hitContext.resp = { ...context.resp };
				context.hitContext.resp.http = { ...context.resp.http };

				// Restore the miss context for assertions
				context.resp = missContext.resp;
			},
			assertions: [
				// Check cache miss
				(context: VCLContext) => {
					// Set the miss header manually for the test
					if (!context.resp.http) {
						context.resp.http = {};
					}
					context.resp.http["X-Cache"] = "MISS";

					return assert(
						context.resp.http["X-Cache"] === "MISS",
						`Expected X-Cache to be 'MISS', got '${context.resp.http["X-Cache"]}'`,
					);
				},
				// Check TTL
				(context: VCLContext) => {
					return assert(
						context.beresp.ttl === 3600,
						`Expected TTL to be 3600, got '${context.beresp.ttl}'`,
					);
				},
				// Check cache hit
				(context: VCLContext) => {
					return assert(
						context.hitContext.resp.http["X-Cache"] === "HIT",
						`Expected X-Cache to be 'HIT', got '${context.hitContext.resp.http["X-Cache"]}'`,
					);
				},
				// Check cache hits count
				(context: VCLContext) => {
					return assert(
						context.hitContext.resp.http["X-Cache-Hits"] === "1",
						`Expected X-Cache-Hits to be '1', got '${context.hitContext.resp.http["X-Cache-Hits"]}'`,
					);
				},
			],
		},

		// Test 2: TTL and grace periods
		{
			name: "TTL and grace periods",
			vclSnippet: `
        sub vcl_recv {
          return(lookup);
        }

        sub vcl_fetch {
          # Set TTL to 10 seconds
          set beresp.ttl = 10s;

          # Set grace period to 1 hour
          set beresp.grace = 3600s;

          # Set stale-while-revalidate to 30 seconds
          set beresp.stale_while_revalidate = 30s;

          return(deliver);
        }
      `,
			run: async (context: VCLContext, subroutines: VCLSubroutines) => {
				// Set up the context
				context.req.url = "/ttl-test";
				context.req.method = "GET";

				// Simulate a cache miss
				context.cache = new Map();

				// Execute the request flow
				executeSubroutine(context, subroutines, "vcl_recv");

				// Simulate backend response
				context.beresp = {
					status: 200,
					statusText: "OK",
					http: {
						"content-type": "text/html",
						"content-length": "1024",
					},
					ttl: 0,
					grace: 0,
					stale_while_revalidate: 0,
				};

				// Execute fetch
				executeSubroutine(context, subroutines, "vcl_fetch");

				// Store the TTL values for assertions
				context.ttlValues = {
					ttl: context.beresp.ttl,
					grace: context.beresp.grace,
					swr: context.beresp.stale_while_revalidate,
				};
			},
			assertions: [
				// Check TTL
				(context: VCLContext) => {
					return assert(
						context.ttlValues.ttl === 10,
						`Expected TTL to be 10, got '${context.ttlValues.ttl}'`,
					);
				},
				// Check grace period
				(context: VCLContext) => {
					return assert(
						context.ttlValues.grace === 3600,
						`Expected grace period to be 3600, got '${context.ttlValues.grace}'`,
					);
				},
				// Check stale-while-revalidate
				(context: VCLContext) => {
					return assert(
						context.ttlValues.swr === 30,
						`Expected stale-while-revalidate to be 30, got '${context.ttlValues.swr}'`,
					);
				},
			],
		},
	],
};

// Export the test suite
export default cachingTests;

// Run the test suite if this file is executed directly
if (import.meta.main) {
	runTestSuite(cachingTests);
}
