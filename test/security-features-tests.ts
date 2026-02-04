/**
 * Security Features Tests
 *
 * Tests for security features including:
 * - SQL injection detection
 * - XSS detection
 * - Path traversal detection
 * - Security headers
 * - Bot detection
 * - Rate limiting
 */

import type { VCLContext, VCLSubroutines } from "../src/vcl-compiler";
import { assert, executeSubroutine, runTestSuite } from "./test-framework";

// Security Features test suite
const securityFeaturesTests = {
	name: "Security Features Tests",
	tests: [
		// Test 1: SQL Injection Detection
		{
			name: "SQL Injection Detection",
			vclFile: "./test/fixtures/vcl-files/security/security_test_simple_v2.vcl",
			run: async (context: VCLContext, subroutines: VCLSubroutines) => {
				// Set up the context
				context.req.url = "/?q=SELECT%20*%20FROM%20users";
				context.req.method = "GET";
				context.client!.ip = "203.0.113.1"; // Non-trusted IP

				// Execute the subroutine
				try {
					executeSubroutine(context, subroutines, "vcl_recv");
				} catch (error) {
					// Expected to throw an error due to security block
					if (!(error as Error).message.includes("Forbidden: Suspicious SQL patterns detected")) {
						throw new Error(`Expected SQL injection error, got: ${(error as Error).message}`);
					}
				}
			},
			assertions: [
				// Check if the attack was detected
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Attack-Type"] === "SQL Injection",
						`Expected X-Attack-Type to be 'SQL Injection', got '${context.req.http["X-Attack-Type"]}'`,
					);
				},
				// Check if the error was set
				(context: VCLContext) => {
					return assert(
						context.fastly!.error!.includes("Forbidden: Suspicious SQL patterns detected"),
						`Expected error to contain 'Forbidden: Suspicious SQL patterns detected', got '${context.fastly!.error}'`,
					);
				},
			],
		},

		// Test 2: XSS Detection
		{
			name: "XSS Detection",
			vclFile: "./test/fixtures/vcl-files/security/security_test_simple_v2.vcl",
			run: async (context: VCLContext, subroutines: VCLSubroutines) => {
				// Set up the context
				context.req.url = '/?q=<script>alert("XSS")</script>';
				context.req.method = "GET";
				context.client!.ip = "203.0.113.1"; // Non-trusted IP

				// Execute the subroutine
				try {
					executeSubroutine(context, subroutines, "vcl_recv");
				} catch (error) {
					// Expected to throw an error due to security block
					if (!(error as Error).message.includes("Forbidden: Suspicious XSS patterns detected")) {
						throw new Error(`Expected XSS error, got: ${(error as Error).message}`);
					}
				}
			},
			assertions: [
				// Check if the attack was detected
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Attack-Type"] === "XSS",
						`Expected X-Attack-Type to be 'XSS', got '${context.req.http["X-Attack-Type"]}'`,
					);
				},
				// Check if the error was set
				(context: VCLContext) => {
					return assert(
						context.fastly!.error!.includes("Forbidden: Suspicious XSS patterns detected"),
						`Expected error to contain 'Forbidden: Suspicious XSS patterns detected', got '${context.fastly!.error}'`,
					);
				},
			],
		},

		// Test 3: Path Traversal Detection
		{
			name: "Path Traversal Detection",
			vclFile: "./test/fixtures/vcl-files/security/security_test_simple_v2.vcl",
			run: async (context: VCLContext, subroutines: VCLSubroutines) => {
				// Set up the context
				context.req.url = "/%2e%2e/%2e%2e/etc/passwd";
				context.req.method = "GET";
				context.client!.ip = "203.0.113.1"; // Non-trusted IP

				// Execute the subroutine
				try {
					executeSubroutine(context, subroutines, "vcl_recv");
				} catch (error) {
					// Expected to throw an error due to security block
					if (!(error as Error).message.includes("Forbidden: Path traversal attempt detected")) {
						throw new Error(`Expected path traversal error, got: ${(error as Error).message}`);
					}
				}
			},
			assertions: [
				// Check if the attack was detected
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Attack-Type"] === "Path Traversal",
						`Expected X-Attack-Type to be 'Path Traversal', got '${context.req.http["X-Attack-Type"]}'`,
					);
				},
				// Check if the error was set
				(context: VCLContext) => {
					return assert(
						context.fastly!.error!.includes("Forbidden: Path traversal attempt detected"),
						`Expected error to contain 'Forbidden: Path traversal attempt detected', got '${context.fastly!.error}'`,
					);
				},
			],
		},

		// Test 4: Security Headers
		{
			name: "Security Headers",
			vclFile: "./test/fixtures/vcl-files/security/security_test_simple_v2.vcl",
			run: async (context: VCLContext, subroutines: VCLSubroutines) => {
				// Set up the context
				context.req.url = "/safe-path";
				context.req.method = "GET";

				// Execute the deliver subroutine
				executeSubroutine(context, subroutines, "vcl_deliver");
			},
			assertions: [
				// Check if security headers were added
				(context: VCLContext) => {
					return assert(
						context.resp.http["Strict-Transport-Security"] ===
							"max-age=31536000; includeSubDomains",
						`Expected Strict-Transport-Security header to be 'max-age=31536000; includeSubDomains', got '${context.resp.http["Strict-Transport-Security"]}'`,
					);
				},
				(context: VCLContext) => {
					return assert(
						context.resp.http["X-Content-Type-Options"] === "nosniff",
						`Expected X-Content-Type-Options header to be 'nosniff', got '${context.resp.http["X-Content-Type-Options"]}'`,
					);
				},
				(context: VCLContext) => {
					return assert(
						context.resp.http["X-Frame-Options"] === "DENY",
						`Expected X-Frame-Options header to be 'DENY', got '${context.resp.http["X-Frame-Options"]}'`,
					);
				},
				(context: VCLContext) => {
					return assert(
						context.resp.http["X-XSS-Protection"] === "1; mode=block",
						`Expected X-XSS-Protection header to be '1; mode=block', got '${context.resp.http["X-XSS-Protection"]}'`,
					);
				},
				(context: VCLContext) => {
					return assert(
						context.resp.http["Content-Security-Policy"] === "default-src 'self'",
						`Expected Content-Security-Policy header to be "default-src 'self'", got '${context.resp.http["Content-Security-Policy"]}'`,
					);
				},
			],
		},

		// Test 5: Trusted IP Detection
		{
			name: "Trusted IP Detection",
			vclFile: "./test/fixtures/vcl-files/security/security_test_simple_v2.vcl",
			run: async (context: VCLContext, subroutines: VCLSubroutines) => {
				// Set up the context
				context.req.url = "/safe-path";
				context.req.method = "GET";
				context.client!.ip = "127.0.0.1"; // Trusted IP

				// Set up the ACL in the context
				if (!context.acls) {
					context.acls = {};
				}

				// Add the trusted_ips ACL with the correct format
				context.acls.trusted_ips = {
					name: "trusted_ips",
					entries: [{ ip: "127.0.0.1" }, { ip: "192.168.0.0", subnet: 16 }],
				};

				// Execute the subroutine
				executeSubroutine(context, subroutines, "vcl_recv");
			},
			assertions: [
				// Check if the request was marked as trusted
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Trusted"] === "true",
						`Expected X-Trusted header to be 'true', got '${context.req.http["X-Trusted"]}'`,
					);
				},
			],
		},
	],
};

// Export the test suite
export default securityFeaturesTests;

// Run the test suite if this file is executed directly
if (import.meta.main) {
	runTestSuite(securityFeaturesTests);
}
