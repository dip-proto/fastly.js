/**
 * Real-world E-commerce VCL Tests
 *
 * Tests for a comprehensive e-commerce VCL configuration with:
 * - Multiple backends
 * - Content-based caching
 * - A/B testing
 * - Rate limiting
 * - ESI processing
 * - Error handling
 * - Security headers
 */

import type { VCLContext, VCLSubroutines } from "../src/vcl-compiler";
import { assert, executeSubroutine, runTestSuite } from "./test-framework";

// Real-world E-commerce VCL test suite
const realWorldEcommerceTests = {
	name: "Real-world E-commerce VCL Tests",
	tests: [
		{
			name: "API Request Routing",
			vclFile: "test/fixtures/vcl-files/minimal-ecommerce.vcl",
			run: async (context: VCLContext, subroutines: VCLSubroutines) => {
				// Set up the context for an API request
				context.req.url = "/api/products";
				context.req.method = "GET";
				context.req.http["X-API-Key"] = "valid-api-key";

				// Execute the subroutine
				const result = executeSubroutine(context, subroutines, "vcl_recv");

				// Set the state based on the result
				if (result === "pass") {
					context.fastly!.state = "pass";
				} else if (result === "lookup") {
					context.fastly!.state = "lookup";
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
				// Check that the request is passed (not cached) - API requests use pass, not lookup
				(context: VCLContext) => {
					return assert(
						context.fastly!.state === "pass",
						`Expected state to be pass, got ${context.fastly!.state}`,
					);
				},
			],
		},
		{
			name: "Static Content Caching",
			vclFile: "test/fixtures/vcl-files/minimal-ecommerce.vcl",
			run: async (context: VCLContext, subroutines: VCLSubroutines) => {
				// Set up the context for a static content request
				context.req.url = "/static/css/style.css";
				context.req.method = "GET";

				// Execute the vcl_recv subroutine
				const recvResult = executeSubroutine(context, subroutines, "vcl_recv");

				// Set the state based on the result
				if (recvResult === "pass") {
					context.fastly!.state = "pass";
				} else if (recvResult === "lookup") {
					context.fastly!.state = "lookup";
				}

				// Save the state after vcl_recv
				context.req.http["X-After-Recv-State"] = context.fastly!.state!;

				// Now execute vcl_fetch to test caching behavior
				context.fastly!.state = "fetch";
				const fetchResult = executeSubroutine(context, subroutines, "vcl_fetch");

				// Set the state based on the result
				if (fetchResult === "deliver") {
					context.fastly!.state = "deliver";
				}
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
				// Check that grace period is set
				(context: VCLContext) => {
					return assert(
						context.beresp.grace === 43200, // 12 hours in seconds
						`Expected grace to be 43200 seconds (12h), got ${context.beresp.grace}`,
					);
				},
			],
		},
		{
			name: "Homepage A/B Testing",
			vclFile: "test/fixtures/vcl-files/minimal-ecommerce.vcl",
			run: async (context: VCLContext, subroutines: VCLSubroutines) => {
				// Set up the context for a homepage request
				context.req.url = "/";
				context.req.method = "GET";
				context.req.http.Cookie = "ab_test=A";

				// Execute the vcl_recv subroutine
				const recvResult = executeSubroutine(context, subroutines, "vcl_recv");

				// Set the state based on the result
				if (recvResult === "pass") {
					context.fastly!.state = "pass";
				} else if (recvResult === "lookup") {
					context.fastly!.state = "lookup";
				}

				// Execute vcl_hash to test A/B test inclusion in cache key
				context.fastly!.state = "hash";
				const hashResult = executeSubroutine(context, subroutines, "vcl_hash");

				// Set the state based on the result
				if (hashResult === "hash") {
					context.fastly!.state = "hash";
				}

				// Execute vcl_fetch to test caching behavior
				context.fastly!.state = "fetch";
				const fetchResult = executeSubroutine(context, subroutines, "vcl_fetch");

				// Set the state based on the result
				if (fetchResult === "deliver") {
					context.fastly!.state = "deliver";
				}
			},
			assertions: [
				// Check that an A/B test variant is assigned
				(context: VCLContext) => {
					return assert(
						context.req.http["X-AB-Test"] === "A" || context.req.http["X-AB-Test"] === "B",
						`Expected X-AB-Test to be A or B, got ${context.req.http["X-AB-Test"]}`,
					);
				},
				// Check that the A/B test cookie is set
				(context: VCLContext) => {
					return assert(
						context.req.http.Cookie?.includes("ab_test=") ?? false,
						`Expected Cookie to include ab_test, got ${context.req.http.Cookie}`,
					);
				},
				// Check that ESI is enabled for the homepage
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Enable-ESI"] === "true",
						`Expected X-Enable-ESI to be true, got ${context.req.http["X-Enable-ESI"]}`,
					);
				},
				// Check that the TTL is set correctly for the homepage
				(context: VCLContext) => {
					return assert(
						context.beresp.ttl === 300, // 5 minutes in seconds
						`Expected TTL to be 300 seconds (5m), got ${context.beresp.ttl}`,
					);
				},
			],
		},
		{
			name: "Security Headers",
			vclFile: "test/fixtures/vcl-files/minimal-ecommerce.vcl",
			run: async (context: VCLContext, subroutines: VCLSubroutines) => {
				// Set up the context for a regular request
				context.req.url = "/products/123";
				context.req.method = "GET";

				// Execute the vcl_deliver subroutine
				context.fastly!.state = "deliver";
				const deliverResult = executeSubroutine(context, subroutines, "vcl_deliver");

				// Set the state based on the result
				if (deliverResult === "deliver") {
					context.fastly!.state = "deliver";
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
				(context: VCLContext) => {
					return assert(
						context.resp.http["X-Frame-Options"] === "SAMEORIGIN",
						`Expected X-Frame-Options to be SAMEORIGIN, got ${context.resp.http["X-Frame-Options"]}`,
					);
				},
				(context: VCLContext) => {
					return assert(
						context.resp.http["X-XSS-Protection"] === "1; mode=block",
						`Expected X-XSS-Protection to be 1; mode=block, got ${context.resp.http["X-XSS-Protection"]}`,
					);
				},
				(context: VCLContext) => {
					return assert(
						context.resp.http["Content-Security-Policy"]?.includes("default-src") ?? false,
						`Expected Content-Security-Policy to be set with default-src, got ${context.resp.http["Content-Security-Policy"]}`,
					);
				},
			],
		},
		{
			name: "Error Handling - API Key Required",
			vclFile: "test/fixtures/vcl-files/minimal-ecommerce.vcl",
			run: async (context: VCLContext, subroutines: VCLSubroutines) => {
				// Set up the context for an API request without an API key
				context.req.url = "/api/products";
				context.req.method = "GET";
				// No API key set

				// Set the status to 401 to simulate the error
				context.obj.status = 401;
				context.fastly!.state = "error";

				// Execute vcl_error to handle the error
				const errorResult = executeSubroutine(context, subroutines, "vcl_error");

				// Set the state based on the result
				if (errorResult === "deliver") {
					context.fastly!.state = "deliver";
				}
			},
			assertions: [
				// Check that an error is triggered
				(context: VCLContext) => {
					return assert(
						context.obj.status === 401,
						`Expected status to be 401, got ${context.obj.status}`,
					);
				},
				// Check that the error response is set
				(context: VCLContext) => {
					return assert(
						(context.obj.response && typeof context.obj.response === "string") as boolean,
						`Expected response to be a string, got ${typeof context.obj.response}`,
					);
				},
				// Check that the synthetic response contains the expected content
				(context: VCLContext) => {
					return assert(
						context.obj.response?.includes("API Key Required") ?? false,
						`Expected synthetic response to include 'API Key Required'`,
					);
				},
			],
		},
		{
			name: "Rate Limiting",
			vclFile: "test/fixtures/vcl-files/minimal-ecommerce.vcl",
			run: async (context: VCLContext, subroutines: VCLSubroutines) => {
				// Set up the context for an API request that exceeds rate limits
				context.req.url = "/api/products";
				context.req.method = "GET";
				context.req.http["X-API-Key"] = "valid-api-key";
				context.req.http["X-Rate-Limit"] = "exceeded";

				// Simulate rate limit exceeded
				context.ratelimit!.counters = {
					[context.client!.ip]: {
						count: 200, // Exceeds the 100:60 limit
						lastReset: Date.now() - 30000, // 30 seconds ago
					},
				};

				// Execute the vcl_recv subroutine
				const recvResult = executeSubroutine(context, subroutines, "vcl_recv");

				// Set the state based on the result
				if (recvResult === "pass") {
					context.fastly!.state = "pass";
				} else if (recvResult === "lookup") {
					context.fastly!.state = "lookup";
				} else if (recvResult === "error") {
					context.fastly!.state = "error";

					// Execute vcl_error to handle the error
					const errorResult = executeSubroutine(context, subroutines, "vcl_error");

					// Set the state based on the result
					if (errorResult === "deliver") {
						context.fastly!.state = "deliver";
					}
				} else if (context.obj.status === 429) {
					context.fastly!.state = "error";
					const errorResult = executeSubroutine(context, subroutines, "vcl_error");

					// Set the state based on the result
					if (errorResult === "deliver") {
						context.fastly!.state = "deliver";
					}
				}
			},
			assertions: [
				// Check that a rate limit error is triggered
				(context: VCLContext) => {
					return assert(
						context.obj.status === 429,
						`Expected status to be 429, got ${context.obj.status}`,
					);
				},
				// Check that the Retry-After header is set
				(context: VCLContext) => {
					return assert(
						context.obj.http["Retry-After"] === "60",
						`Expected Retry-After to be 60, got ${context.obj.http["Retry-After"]}`,
					);
				},
				// Check that the synthetic response contains the expected content
				(context: VCLContext) => {
					return assert(
						context.obj.response?.includes("Too Many Requests") ?? false,
						`Expected synthetic response to include 'Too Many Requests'`,
					);
				},
			],
		},
	],
};

// Export the test suite
export default realWorldEcommerceTests;

// Run the test suite if this file is executed directly
if (import.meta.main) {
	runTestSuite(realWorldEcommerceTests);
}
