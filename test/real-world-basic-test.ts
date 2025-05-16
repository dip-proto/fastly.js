/**
 * Basic Real-world VCL Test
 *
 * Tests a simple VCL configuration with basic routing and caching
 */

import type { VCLContext, VCLSubroutines } from "../src/vcl-compiler";
import { assert, executeSubroutine, runTestSuite } from "./test-framework";

// Basic Real-world VCL test
const realWorldBasicTest = {
	name: "Basic Real-world VCL Test",
	vclSnippet: `
    # Basic Real-world VCL Example
    # This file demonstrates a simplified real-world VCL configuration

    # Backend definitions
    backend origin_api {
      .host = "api.example.com";
      .port = "443";
      .ssl = true;
    }

    backend origin_static {
      .host = "static.example.com";
      .port = "443";
      .ssl = true;
    }

    # ACL for internal IPs
    acl internal {
      "127.0.0.1";
      "192.168.0.0"/16;
      "10.0.0.0"/8;
    }

    # Main VCL logic
    sub vcl_recv {
      # Set X-Request-ID for tracking
      set req.http.X-Request-ID = "12345678-1234-1234-1234-123456789012";

      # Route to appropriate backend
      if (req.url ~ "^/api/") {
        set req.backend = "origin_api";
        return(pass);
      }
      else if (req.url ~ "^/static/") {
        set req.backend = "origin_static";
        return(lookup);
      }
      else {
        set req.backend = "origin_api";

        # Handle homepage A/B testing
        if (req.url == "/") {
          set req.http.X-Homepage-Variant = "A";
        }

        return(lookup);
      }
    }

    sub vcl_hash {
      hash_data(req.url);

      if (req.http.host) {
        hash_data(req.http.host);
      }

      return(hash);
    }

    sub vcl_fetch {
      if (req.url ~ "^/static/") {
        set beresp.ttl = 24h;
      }
      else if (req.url ~ "^/api/") {
        set beresp.ttl = 0s;
      }
      else {
        set beresp.ttl = 5m;
      }

      return(deliver);
    }

    sub vcl_deliver {
      if (client.ip ~ internal) {
        set resp.http.X-Cache-Status = fastly.state;
        set resp.http.X-Request-ID = req.http.X-Request-ID;
      } else {
        unset resp.http.Server;
        unset resp.http.X-Powered-By;
      }

      set resp.http.X-Content-Type-Options = "nosniff";

      return(deliver);
    }

    sub vcl_error {
      set obj.http.Content-Type = "text/html; charset=utf-8";
      return(deliver);
    }
  `,
	tests: [
		{
			name: "API Request Routing",
			run: async (context: VCLContext, subroutines: VCLSubroutines) => {
				// Set up the context for an API request
				context.req.url = "/api/products";
				context.req.method = "GET";

				// Execute the subroutine
				const result = executeSubroutine(context, subroutines, "vcl_recv");

				// Set the state based on the result
				if (result === "pass") {
					context.fastly.state = "pass";
				} else if (result === "lookup") {
					context.fastly.state = "lookup";
				}
			},
			assertions: [
				// Check that the request is routed to the API backend
				(context: VCLContext) => {
					return assert(
						context.req.backend === "origin_api",
						`Expected backend to be origin_api, got ${context.req.backend}`,
					);
				},
				// Check that the request is passed (not cached)
				(context: VCLContext) => {
					return assert(
						context.fastly.state === "pass",
						`Expected state to be pass, got ${context.fastly.state}`,
					);
				},
			],
		},
		{
			name: "Static Content Caching",
			run: async (context: VCLContext, subroutines: VCLSubroutines) => {
				// Set up the context for a static content request
				context.req.url = "/static/css/style.css";
				context.req.method = "GET";

				// Execute the vcl_recv subroutine
				const recvResult = executeSubroutine(context, subroutines, "vcl_recv");

				// Set the state based on the result
				if (recvResult === "pass") {
					context.fastly.state = "pass";
				} else if (recvResult === "lookup") {
					context.fastly.state = "lookup";
				}

				// Save the state after vcl_recv
				context.req.http["X-After-Recv-State"] = context.fastly.state;

				// Now execute vcl_fetch to test caching behavior
				context.fastly.state = "fetch";
				executeSubroutine(context, subroutines, "vcl_fetch");
			},
			assertions: [
				// Check that the request is routed to the static backend
				(context: VCLContext) => {
					return assert(
						context.req.backend === "origin_static",
						`Expected backend to be origin_static, got ${context.req.backend}`,
					);
				},
				// Check that the request is looked up in cache
				(context: VCLContext) => {
					return assert(
						context.req.http["X-After-Recv-State"] === "lookup",
						`Expected state after vcl_recv to be lookup, got ${context.req.http["X-After-Recv-State"]}`,
					);
				},
				// Check that the TTL is set correctly for static content
				(context: VCLContext) => {
					return assert(
						context.beresp.ttl === 86400, // 24 hours in seconds
						`Expected TTL to be 86400 seconds (24h), got ${context.beresp.ttl}`,
					);
				},
			],
		},
		{
			name: "Security Headers",
			run: async (context: VCLContext, subroutines: VCLSubroutines) => {
				// Set up the context for a regular request
				context.req.url = "/products/123";
				context.req.method = "GET";

				// Execute the vcl_deliver subroutine
				context.fastly.state = "deliver";
				const deliverResult = executeSubroutine(
					context,
					subroutines,
					"vcl_deliver",
				);

				// Set the state based on the result
				if (deliverResult === "deliver") {
					context.fastly.state = "deliver";
				}
			},
			assertions: [
				// Check that security headers are set
				(context: VCLContext) => {
					return assert(
						context.resp.http["X-Content-Type-Options"] === "nosniff",
						`Expected X-Content-Type-Options to be nosniff, got ${context.resp.http["X-Content-Type-Options"]}`,
					);
				},
			],
		},
	],
};

// Export the test suite
export default realWorldBasicTest;

// Run the test suite if this file is executed directly
if (import.meta.main) {
	runTestSuite(realWorldBasicTest);
}
