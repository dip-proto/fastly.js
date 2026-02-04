/**
 * Rate Limiting Functions Tests
 *
 * Tests for VCL rate limiting functions including:
 * - ratelimit.open_window
 * - ratelimit.ratecounter_increment
 * - ratelimit.check_rate
 * - ratelimit.check_rates
 * - ratelimit.penaltybox_add
 * - ratelimit.penaltybox_has
 */

import type { VCLContext, VCLSubroutines } from "../src/vcl-compiler";
import { RateLimitModule } from "../src/vcl-ratelimit";
import { assert, executeSubroutine, runTestSuite } from "./test-framework";

// Rate Limiting Functions test suite
const rateLimitFunctionsTests = {
	name: "Rate Limiting Functions Tests",
	tests: [
		// Test 1: Basic rate counter
		{
			name: "Basic rate counter",
			vclSnippet: `
        sub vcl_recv {
          # Open a rate counter window with a 10-second duration
          set req.http.X-Window-ID = std.ratelimit.open_window(10);

          # Increment a counter
          set req.http.X-Counter-1 = std.ratelimit.ratecounter_increment("test_counter", 1);

          # Increment it again
          set req.http.X-Counter-2 = std.ratelimit.ratecounter_increment("test_counter", 2);

          # Check the total
          set req.http.X-Counter-3 = std.ratelimit.ratecounter_increment("test_counter", 3);

          return(lookup);
        }
      `,
			run: async (context: VCLContext, subroutines: VCLSubroutines) => {
				// Initialize rate limit module to clear any existing counters
				RateLimitModule.init();

				// Execute the subroutine
				executeSubroutine(context, subroutines, "vcl_recv");
			},
			assertions: [
				// Check if window ID is set
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Window-ID"] !== undefined,
						`Expected X-Window-ID to be set, got '${context.req.http["X-Window-ID"]}'`,
					);
				},
				// Check first counter increment
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Counter-1"] === "1",
						`Expected X-Counter-1 to be '1', got '${context.req.http["X-Counter-1"]}'`,
					);
				},
				// Check second counter increment
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Counter-2"] === "3",
						`Expected X-Counter-2 to be '3', got '${context.req.http["X-Counter-2"]}'`,
					);
				},
				// Check third counter increment
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Counter-3"] === "6",
						`Expected X-Counter-3 to be '6', got '${context.req.http["X-Counter-3"]}'`,
					);
				},
			],
		},

		// Test 2: Rate limit checking
		{
			name: "Rate limit checking",
			vclSnippet: `
        sub vcl_recv {
          # Increment counter to 10
          set req.http.X-Counter = std.ratelimit.ratecounter_increment("rate_test", 10);

          # Check if rate exceeds 5 per second (should be true)
          set req.http.X-Rate-Exceeded-1 = std.ratelimit.check_rate("rate_test", 5);

          # Check if rate exceeds 20 per second (should be false)
          set req.http.X-Rate-Exceeded-2 = std.ratelimit.check_rate("rate_test", 20);

          # Check multiple rates (10:1, 20:2, 30:3)
          # - 10 per 1 second (exceeded)
          # - 20 per 2 seconds (not exceeded)
          # - 30 per 3 seconds (not exceeded)
          set req.http.X-Multi-Rate = std.ratelimit.check_rates("rate_test", "10:1,20:2,30:3");

          return(lookup);
        }
      `,
			run: async (context: VCLContext, subroutines: VCLSubroutines) => {
				// Initialize rate limit module to clear any existing counters
				RateLimitModule.init();

				// Execute the subroutine
				executeSubroutine(context, subroutines, "vcl_recv");
			},
			assertions: [
				// Check counter value
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Counter"] === "10",
						`Expected X-Counter to be '10', got '${context.req.http["X-Counter"]}'`,
					);
				},
				// Check first rate limit (should be exceeded)
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Rate-Exceeded-1"] === "true",
						`Expected X-Rate-Exceeded-1 to be 'true', got '${context.req.http["X-Rate-Exceeded-1"]}'`,
					);
				},
				// Check second rate limit (should not be exceeded)
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Rate-Exceeded-2"] === "false",
						`Expected X-Rate-Exceeded-2 to be 'false', got '${context.req.http["X-Rate-Exceeded-2"]}'`,
					);
				},
				// Check multi-rate limit (should be exceeded due to first rate)
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Multi-Rate"] === "true",
						`Expected X-Multi-Rate to be 'true', got '${context.req.http["X-Multi-Rate"]}'`,
					);
				},
			],
		},

		// Test 3: Penalty box
		{
			name: "Penalty box",
			vclSnippet: `
        sub vcl_recv {
          # Add client to penalty box for 10 seconds
          set req.http.X-Add-Result = std.ratelimit.penaltybox_add("test_penalty", client.ip, 10);

          # Check if client is in penalty box (should be true)
          set req.http.X-In-Penalty-1 = std.ratelimit.penaltybox_has("test_penalty", client.ip);

          # Check if another client is in penalty box (should be false)
          set req.http.X-In-Penalty-2 = std.ratelimit.penaltybox_has("test_penalty", "192.168.1.2");

          # Check if client is in a non-existent penalty box (should be false)
          set req.http.X-In-Penalty-3 = std.ratelimit.penaltybox_has("nonexistent_penalty", client.ip);

          return(lookup);
        }
      `,
			run: async (context: VCLContext, subroutines: VCLSubroutines) => {
				// Initialize rate limit module to clear any existing penalty boxes
				RateLimitModule.init();

				// Set client IP
				context.client!.ip = "192.168.1.1";

				// Execute the subroutine
				executeSubroutine(context, subroutines, "vcl_recv");
			},
			assertions: [
				// Check if client is in penalty box
				(context: VCLContext) => {
					return assert(
						context.req.http["X-In-Penalty-1"] === "true",
						`Expected X-In-Penalty-1 to be 'true', got '${context.req.http["X-In-Penalty-1"]}'`,
					);
				},
				// Check if another client is not in penalty box
				(context: VCLContext) => {
					return assert(
						context.req.http["X-In-Penalty-2"] === "false",
						`Expected X-In-Penalty-2 to be 'false', got '${context.req.http["X-In-Penalty-2"]}'`,
					);
				},
				// Check if client is not in non-existent penalty box
				(context: VCLContext) => {
					return assert(
						context.req.http["X-In-Penalty-3"] === "false",
						`Expected X-In-Penalty-3 to be 'false', got '${context.req.http["X-In-Penalty-3"]}'`,
					);
				},
			],
		},
	],
};

// Run the test suite
runTestSuite(rateLimitFunctionsTests);

// Export the test suite
export default rateLimitFunctionsTests;
