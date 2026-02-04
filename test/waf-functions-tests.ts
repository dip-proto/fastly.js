/**
 * WAF Functions Tests
 *
 * Tests for VCL WAF functions including:
 * - waf.allow
 * - waf.block
 * - waf.log
 * - waf.rate_limit
 * - waf.rate_limit_tokens
 * - waf.detect_attack
 */

import type { VCLContext, VCLSubroutines } from "../src/vcl-compiler";
import { WAFModule } from "../src/vcl-waf";
import { assert, executeSubroutine, runTestSuite } from "./test-framework";

// WAF Functions test suite
const wafFunctionsTests = {
	name: "WAF Functions Tests",
	tests: [
		// Test 1: WAF logging
		{
			name: "WAF logging",
			vclSnippet: `
        sub vcl_recv {
          # Log a message
          set req.http.X-Log-1 = waf.log("Test WAF log message");

          # Log request information
          set req.http.X-Log-2 = waf.log("Client IP: " + client.ip);

          return(lookup);
        }
      `,
			run: async (context: VCLContext, subroutines: VCLSubroutines) => {
				// Clear logs before test
				WAFModule.clear_logs();

				// Execute the subroutine
				try {
					executeSubroutine(context, subroutines, "vcl_recv");

					// Get logs for verification
					context.req.http["X-WAF-Logs"] = WAFModule.get_logs().join(", ");
					console.log("WAF Logs:", WAFModule.get_logs());
				} catch (error) {
					console.error("Error executing subroutine:", error);
				}
			},
			assertions: [
				// Check that logs were created
				(context: VCLContext) => {
					return assert(
						context.req.http["X-WAF-Logs"]!.includes("Test WAF log message"),
						`Expected WAF logs to include "Test WAF log message", got '${context.req.http["X-WAF-Logs"]}'`,
					);
				},
				// Check that client IP was logged
				(context: VCLContext) => {
					return assert(
						context.req.http["X-WAF-Logs"]!.includes("Client IP:"),
						`Expected WAF logs to include "Client IP:", got '${context.req.http["X-WAF-Logs"]}'`,
					);
				},
			],
		},

		// Test 2: Attack detection
		{
			name: "Attack detection",
			vclSnippet: `
        sub vcl_recv {
          # Test SQL injection detection
          set req.http.X-SQL-Attack = waf.detect_attack("SELECT * FROM users WHERE id = 1; DROP TABLE users;", "sql");

          # Test XSS detection
          set req.http.X-XSS-Attack = waf.detect_attack("<script>alert('XSS');</script>", "xss");

          # Test path traversal detection
          set req.http.X-Path-Attack = waf.detect_attack("../../../etc/passwd", "path");

          # Test command injection detection
          set req.http.X-Command-Attack = waf.detect_attack("cat /etc/passwd | grep root", "command");

          # Test LFI detection
          set req.http.X-LFI-Attack = waf.detect_attack("/etc/passwd", "lfi");

          # Test RFI detection
          set req.http.X-RFI-Attack = waf.detect_attack("https://evil.com/malware.php", "rfi");

          # Test any attack detection
          set req.http.X-Any-Attack = waf.detect_attack("<script>alert('XSS');</script>", "any");

          # Test non-attack
          set req.http.X-Non-Attack = waf.detect_attack("Hello, world!", "any");

          return(lookup);
        }
      `,
			run: async (context: VCLContext, subroutines: VCLSubroutines) => {
				// Execute the subroutine
				executeSubroutine(context, subroutines, "vcl_recv");
			},
			assertions: [
				// Check SQL injection detection
				(context: VCLContext) => {
					return assert(
						context.req.http["X-SQL-Attack"] === "true",
						`Expected X-SQL-Attack to be 'true', got '${context.req.http["X-SQL-Attack"]}'`,
					);
				},
				// Check XSS detection
				(context: VCLContext) => {
					return assert(
						context.req.http["X-XSS-Attack"] === "true",
						`Expected X-XSS-Attack to be 'true', got '${context.req.http["X-XSS-Attack"]}'`,
					);
				},
				// Check path traversal detection
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Path-Attack"] === "true",
						`Expected X-Path-Attack to be 'true', got '${context.req.http["X-Path-Attack"]}'`,
					);
				},
				// Check command injection detection
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Command-Attack"] === "true",
						`Expected X-Command-Attack to be 'true', got '${context.req.http["X-Command-Attack"]}'`,
					);
				},
				// Check LFI detection
				(context: VCLContext) => {
					return assert(
						context.req.http["X-LFI-Attack"] === "true",
						`Expected X-LFI-Attack to be 'true', got '${context.req.http["X-LFI-Attack"]}'`,
					);
				},
				// Check RFI detection
				(context: VCLContext) => {
					return assert(
						context.req.http["X-RFI-Attack"] === "true",
						`Expected X-RFI-Attack to be 'true', got '${context.req.http["X-RFI-Attack"]}'`,
					);
				},
				// Check any attack detection
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Any-Attack"] === "true",
						`Expected X-Any-Attack to be 'true', got '${context.req.http["X-Any-Attack"]}'`,
					);
				},
				// Check non-attack
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Non-Attack"] === "false",
						`Expected X-Non-Attack to be 'false', got '${context.req.http["X-Non-Attack"]}'`,
					);
				},
			],
		},

		// Test 3: Rate limiting
		{
			name: "Rate limiting",
			vclSnippet: `
        sub vcl_recv {
          # Set up rate limit (5 requests per 10 seconds)
          set req.http.X-Rate-Limit-1 = waf.rate_limit("test_client", 5, 10);

          # Check tokens remaining
          set req.http.X-Rate-Tokens-1 = waf.rate_limit_tokens("test_client");

          # Make multiple requests to consume tokens
          set req.http.X-Rate-Limit-2 = waf.rate_limit("test_client", 5, 10);
          set req.http.X-Rate-Limit-3 = waf.rate_limit("test_client", 5, 10);
          set req.http.X-Rate-Limit-4 = waf.rate_limit("test_client", 5, 10);
          set req.http.X-Rate-Limit-5 = waf.rate_limit("test_client", 5, 10);

          # This should exceed the rate limit
          set req.http.X-Rate-Limit-6 = waf.rate_limit("test_client", 5, 10);

          # Check tokens remaining after all requests
          set req.http.X-Rate-Tokens-2 = waf.rate_limit_tokens("test_client");

          return(lookup);
        }
      `,
			run: async (context: VCLContext, subroutines: VCLSubroutines) => {
				// Initialize WAF module to clear any existing rate limits
				WAFModule.init();

				// Execute the subroutine
				executeSubroutine(context, subroutines, "vcl_recv");
			},
			assertions: [
				// Check first rate limit request (should be allowed)
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Rate-Limit-1"] === "true",
						`Expected X-Rate-Limit-1 to be 'true', got '${context.req.http["X-Rate-Limit-1"]}'`,
					);
				},
				// Check tokens after first request (should be 4)
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Rate-Tokens-1"] === "4",
						`Expected X-Rate-Tokens-1 to be '4', got '${context.req.http["X-Rate-Tokens-1"]}'`,
					);
				},
				// Check fifth rate limit request (should be allowed)
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Rate-Limit-5"] === "true",
						`Expected X-Rate-Limit-5 to be 'true', got '${context.req.http["X-Rate-Limit-5"]}'`,
					);
				},
				// Check sixth rate limit request (should be blocked)
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Rate-Limit-6"] === "false",
						`Expected X-Rate-Limit-6 to be 'false', got '${context.req.http["X-Rate-Limit-6"]}'`,
					);
				},
				// Check tokens after all requests (should be 0)
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Rate-Tokens-2"] === "0",
						`Expected X-Rate-Tokens-2 to be '0', got '${context.req.http["X-Rate-Tokens-2"]}'`,
					);
				},
			],
		},
	],
};

// Export the test suite
export default wafFunctionsTests;

// Run the test suite if this file is executed directly
if (import.meta.main) {
	runTestSuite(wafFunctionsTests);
}
