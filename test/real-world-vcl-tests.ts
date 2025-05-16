/**
 * Real-world VCL Tests
 *
 * This file contains tests for a comprehensive real-world VCL configuration
 * that demonstrates various VCL features and best practices.
 */

import type { VCLContext, VCLSubroutines } from "../src/vcl-compiler";
import { assert, executeSubroutine, runTestSuite } from "./test-framework";

// Real-world VCL test suite
const realWorldVCLTests = {
	name: "Real-world VCL Tests",
	tests: [
		// Test 1: API request handling
		{
			name: "API request handling",
			vclFile: "test/fixtures/vcl-files/basic-real-world-example.vcl",
			run: async (context: VCLContext, subroutines: VCLSubroutines) => {
				// Set up API request
				context.req.url = "/api/v1/users";
				context.req.method = "GET";
				context.req.http.Host = "api.example.com";
				context.req.http["User-Agent"] = "Mozilla/5.0";
				context.client.ip = "203.0.113.1"; // External IP

				// Initialize tables
				if (!context.tables.feature_flags) {
					context.tables.feature_flags = {
						new_homepage: "true",
						beta_api: "false",
						maintenance_mode: "false",
						rate_limit_threshold: "100",
					};
				}

				// Execute vcl_recv
				const result = executeSubroutine(context, subroutines, "vcl_recv");

				// Store the result for assertions
				context.req.http["X-VCL-Result"] = result;
			},
			assertions: [
				// Check that API requests are passed (not cached)
				(context: VCLContext) => {
					return assert(
						context.req.http["X-VCL-Result"] === "pass",
						`Expected API request to return 'pass', got '${context.req.http["X-VCL-Result"]}'`,
					);
				},
				// Check that a request ID was set
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Request-ID"] ===
							"12345678-1234-1234-1234-123456789012",
						`Expected X-Request-ID to be '12345678-1234-1234-1234-123456789012', got '${context.req.http["X-Request-ID"]}'`,
					);
				},
			],
		},

		// Test 2: Static content handling
		{
			name: "Static content handling",
			vclFile: "test/fixtures/vcl-files/basic-real-world-example.vcl",
			run: async (context: VCLContext, subroutines: VCLSubroutines) => {
				// Set up static content request
				context.req.url = "/static/css/style.css?v=123";
				context.req.method = "GET";
				context.req.http.Host = "www.example.com";
				context.client.ip = "203.0.113.1"; // External IP

				// Initialize tables
				if (!context.tables.feature_flags) {
					context.tables.feature_flags = {
						new_homepage: "true",
						beta_api: "false",
						maintenance_mode: "false",
						rate_limit_threshold: "100",
					};
				}

				// Execute vcl_recv
				const recvResult = executeSubroutine(context, subroutines, "vcl_recv");

				// Store the normalized URL
				const normalizedUrl = context.req.url;

				// Execute vcl_fetch
				executeSubroutine(context, subroutines, "vcl_fetch");

				// Store results for assertions
				context.req.http["X-VCL-Result"] = recvResult;
				context.req.http["X-Normalized-URL"] = normalizedUrl;
				context.req.http["X-TTL"] = context.beresp.ttl.toString();
			},
			assertions: [
				// Check that static requests are looked up in cache
				(context: VCLContext) => {
					return assert(
						context.req.http["X-VCL-Result"] === "lookup",
						`Expected static request to return 'lookup', got '${context.req.http["X-VCL-Result"]}'`,
					);
				},
				// Check that the request ID was set correctly
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Request-ID"] ===
							"12345678-1234-1234-1234-123456789012",
						`Expected X-Request-ID to be '12345678-1234-1234-1234-123456789012', got '${context.req.http["X-Request-ID"]}'`,
					);
				},
				// Check that the TTL was set correctly
				(context: VCLContext) => {
					return assert(
						context.req.http["X-TTL"] === "86400", // 24 hours in seconds
						`Expected TTL to be 86400 (24h), got '${context.req.http["X-TTL"]}'`,
					);
				},
			],
		},

		// Test 3: Homepage A/B testing
		{
			name: "Homepage A/B testing",
			vclFile: "test/fixtures/vcl-files/basic-real-world-example.vcl",
			run: async (context: VCLContext, subroutines: VCLSubroutines) => {
				// Set up homepage request
				context.req.url = "/";
				context.req.method = "GET";
				context.req.http.Host = "www.example.com";
				context.client.ip = "203.0.113.1"; // External IP

				// Initialize tables
				if (!context.tables.feature_flags) {
					context.tables.feature_flags = {
						new_homepage: "true",
						beta_api: "false",
						maintenance_mode: "false",
						rate_limit_threshold: "100",
					};
				}

				// Execute vcl_recv
				executeSubroutine(context, subroutines, "vcl_recv");

				// Execute vcl_hash
				executeSubroutine(context, subroutines, "vcl_hash");

				// Execute vcl_fetch
				executeSubroutine(context, subroutines, "vcl_fetch");

				// Execute vcl_deliver
				executeSubroutine(context, subroutines, "vcl_deliver");
			},
			assertions: [
				// Check that a homepage variant was assigned
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Homepage-Variant"] === "A" ||
							context.req.http["X-Homepage-Variant"] === "B",
						`Expected X-Homepage-Variant to be 'A' or 'B', got '${context.req.http["X-Homepage-Variant"]}'`,
					);
				},
				// Check that the request ID was set correctly
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Request-ID"] ===
							"12345678-1234-1234-1234-123456789012",
						`Expected X-Request-ID to be '12345678-1234-1234-1234-123456789012', got '${context.req.http["X-Request-ID"]}'`,
					);
				},
				// Check that the TTL was set correctly
				(context: VCLContext) => {
					return assert(
						context.beresp.ttl === 300, // 5 minutes in seconds
						`Expected TTL to be 300 (5m), got '${context.beresp.ttl}'`,
					);
				},
				// Check that the Content-Type-Options header was set
				(context: VCLContext) => {
					return assert(
						context.resp.http["X-Content-Type-Options"] === "nosniff",
						`Expected X-Content-Type-Options to be 'nosniff', got '${context.resp.http["X-Content-Type-Options"]}'`,
					);
				},
			],
		},

		// Test 4: Error handling
		{
			name: "Error handling",
			vclFile: "test/fixtures/vcl-files/basic-real-world-example.vcl",
			run: async (context: VCLContext, subroutines: VCLSubroutines) => {
				// Set up error scenario
				context.req.url = "/";
				context.req.method = "GET";
				context.req.http.Host = "www.example.com";
				context.client.ip = "203.0.113.1"; // External IP

				// Force an error
				context.obj.status = 503;
				context.obj.response = "Service Unavailable";

				// Execute vcl_error
				executeSubroutine(context, subroutines, "vcl_error");
			},
			assertions: [
				// Check that the error status is 503
				(context: VCLContext) => {
					return assert(
						context.obj.status === 503,
						`Expected error status to be 503, got '${context.obj.status}'`,
					);
				},
				// Check that the Content-Type header was set
				(context: VCLContext) => {
					return assert(
						context.obj.http["Content-Type"] === "text/html; charset=utf-8",
						`Expected Content-Type to be 'text/html; charset=utf-8', got '${context.obj.http["Content-Type"]}'`,
					);
				},
			],
		},
	],
};

// Export the test suite
export default realWorldVCLTests;

// Run the test suite if this file is executed directly
if (import.meta.main) {
	runTestSuite(realWorldVCLTests);
}
