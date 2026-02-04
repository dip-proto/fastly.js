/**
 * Caching Behavior Test
 *
 * Tests the caching behavior functionality in the VCL compiler
 */

import type { VCLContext, VCLSubroutines } from "../src/vcl-compiler";
import { assert, executeSubroutine, runTestSuite } from "./test-framework";

// Caching Behavior Test
const cachingBehaviorTest = {
	name: "Caching Behavior Test",
	tests: [
		{
			name: "Static Content Caching",
			vclSnippet: `
        sub vcl_fetch {
          if (req.url ~ "^/static/") {
            set beresp.ttl = 24h;
            set beresp.grace = 12h;
          }
          else if (req.url ~ "^/api/") {
            set beresp.ttl = 0s;
          }
          else {
            set beresp.ttl = 5m;
          }
          
          return(deliver);
        }
      `,
			run: async (context: VCLContext, subroutines: VCLSubroutines) => {
				// Set up the context for a static content request
				context.req.url = "/static/css/style.css";

				// Execute the subroutine
				const result = executeSubroutine(context, subroutines, "vcl_fetch");

				// Set the state based on the result
				if (result === "deliver") {
					context.fastly!.state = "deliver";
				}
			},
			assertions: [
				// Check that the TTL is set correctly for static content
				(context: VCLContext) => {
					return assert(
						context.beresp.ttl === 86400, // 24 hours in seconds
						`Expected TTL to be 86400 seconds (24h), got ${context.beresp.ttl}`,
					);
				},
				// Check that the grace period is set correctly for static content
				(context: VCLContext) => {
					return assert(
						context.beresp.grace === 43200, // 12 hours in seconds
						`Expected grace to be 43200 seconds (12h), got ${context.beresp.grace}`,
					);
				},
			],
		},
		{
			name: "API Content No Caching",
			vclSnippet: `
        sub vcl_fetch {
          if (req.url ~ "^/static/") {
            set beresp.ttl = 24h;
            set beresp.grace = 12h;
          }
          else if (req.url ~ "^/api/") {
            set beresp.ttl = 0s;
          }
          else {
            set beresp.ttl = 5m;
          }
          
          return(deliver);
        }
      `,
			run: async (context: VCLContext, subroutines: VCLSubroutines) => {
				// Set up the context for an API request
				context.req.url = "/api/products";

				// Execute the subroutine
				const result = executeSubroutine(context, subroutines, "vcl_fetch");

				// Set the state based on the result
				if (result === "deliver") {
					context.fastly!.state = "deliver";
				}
			},
			assertions: [
				// Check that the TTL is set correctly for API content
				(context: VCLContext) => {
					return assert(
						context.beresp.ttl === 0, // No caching
						`Expected TTL to be 0 seconds (no caching), got ${context.beresp.ttl}`,
					);
				},
			],
		},
		{
			name: "Default Content Caching",
			vclSnippet: `
        sub vcl_fetch {
          if (req.url ~ "^/static/") {
            set beresp.ttl = 24h;
            set beresp.grace = 12h;
          }
          else if (req.url ~ "^/api/") {
            set beresp.ttl = 0s;
          }
          else {
            set beresp.ttl = 5m;
          }
          
          return(deliver);
        }
      `,
			run: async (context: VCLContext, subroutines: VCLSubroutines) => {
				// Set up the context for a default request
				context.req.url = "/products/123";

				// Execute the subroutine
				const result = executeSubroutine(context, subroutines, "vcl_fetch");

				// Set the state based on the result
				if (result === "deliver") {
					context.fastly!.state = "deliver";
				}
			},
			assertions: [
				// Check that the TTL is set correctly for default content
				(context: VCLContext) => {
					return assert(
						context.beresp.ttl === 300, // 5 minutes in seconds
						`Expected TTL to be 300 seconds (5m), got ${context.beresp.ttl}`,
					);
				},
			],
		},
	],
};

// Export the test suite
export default cachingBehaviorTest;

// Run the test suite if this file is executed directly
if (import.meta.main) {
	runTestSuite(cachingBehaviorTest);
}
