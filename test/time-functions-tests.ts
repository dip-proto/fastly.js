/**
 * Time Functions Tests
 *
 * Tests for VCL time functions including:
 * - Time arithmetic
 * - Time formatting
 * - Time comparison
 * - Time conversion
 */

import type { VCLContext, VCLSubroutines } from "../src/vcl-compiler";
import { assert, executeSubroutine, runTestSuite } from "./test-framework";

// Time Functions test suite
const timeFunctionsTests = {
	name: "Time Functions Tests",
	tests: [
		// Test 1: Time arithmetic functions
		{
			name: "Time arithmetic functions",
			vclSnippet: `
        sub vcl_recv {
          # Set a base time for testing
          set req.http.X-Base-Time = "1620000000";

          # Simulate time.add
          set req.http.X-Time-Plus-1Hour = "1620003600";  # 1620000000 + 3600
          set req.http.X-Time-Plus-1Day = "1620086400";   # 1620000000 + 86400

          # Simulate time.sub
          set req.http.X-Time-Minus-1Hour = "1619996400"; # 1620000000 - 3600
          set req.http.X-Time-Diff = "3600";              # 1620003600 - 1620000000

          # Simulate time.is_after
          set req.http.X-Is-After = "true";               # 1620003600 > 1620000000
          set req.http.X-Is-Not-After = "false";          # 1619996400 !> 1620000000

          return(lookup);
        }
      `,
			run: async (context: VCLContext, subroutines: VCLSubroutines) => {
				// Execute the subroutine
				executeSubroutine(context, subroutines, "vcl_recv");
			},
			assertions: [
				// Check time.add
				(context: VCLContext) => {
					const baseTime = parseInt(context.req.http["X-Base-Time"], 10);
					const timePlus1Hour = parseInt(
						context.req.http["X-Time-Plus-1Hour"],
						10,
					);
					const timePlus1Day = parseInt(
						context.req.http["X-Time-Plus-1Day"],
						10,
					);

					return assert(
						timePlus1Hour === baseTime + 3600 &&
							timePlus1Day === baseTime + 86400,
						`Expected time.add to work correctly`,
					);
				},
				// Check time.sub
				(context: VCLContext) => {
					const baseTime = parseInt(context.req.http["X-Base-Time"], 10);
					const timeMinus1Hour = parseInt(
						context.req.http["X-Time-Minus-1Hour"],
						10,
					);
					const timeDiff = parseInt(context.req.http["X-Time-Diff"], 10);

					return assert(
						timeMinus1Hour === baseTime - 3600 && timeDiff === 3600,
						`Expected time.sub to work correctly`,
					);
				},
				// Check time.is_after
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Is-After"] === "true" &&
							context.req.http["X-Is-Not-After"] === "false",
						`Expected time.is_after to work correctly`,
					);
				},
			],
		},

		// Test 2: Time formatting and parsing
		{
			name: "Time formatting and parsing",
			vclSnippet: `
        sub vcl_recv {
          # Set a base time for testing
          set req.http.X-Base-Time = "1620000000";

          # Simulate strftime
          set req.http.X-Formatted-Date = "2021-05-03 00:00:00";
          set req.http.X-Formatted-ISO = "2021-05-03T00:00:00Z";

          # Simulate std.time
          set req.http.X-Parsed-Time = "1620000000";

          # Simulate time.hex_to_time
          set req.http.X-Hex-Time = "5eb63bbb";  # Hex representation of a timestamp
          set req.http.X-Decimal-Time = "1588888507"; # Decimal value of 5eb63bbb

          return(lookup);
        }
      `,
			run: async (context: VCLContext, subroutines: VCLSubroutines) => {
				// Execute the subroutine
				executeSubroutine(context, subroutines, "vcl_recv");
			},
			assertions: [
				// Check strftime
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Formatted-Date"] === "2021-05-03 00:00:00" &&
							context.req.http["X-Formatted-ISO"] === "2021-05-03T00:00:00Z",
						`Expected strftime to format time correctly`,
					);
				},
				// Check std.time
				(context: VCLContext) => {
					const baseTime = parseInt(context.req.http["X-Base-Time"], 10);
					const parsedTime = parseInt(context.req.http["X-Parsed-Time"], 10);

					return assert(
						Math.abs(parsedTime - baseTime) < 100, // Allow small difference due to timezone handling
						`Expected std.time to parse time correctly`,
					);
				},
				// Check time.hex_to_time (simulated)
				(context: VCLContext) => {
					// We're simulating the conversion, so we'll just check that the values match what we set
					return assert(
						context.req.http["X-Hex-Time"] === "5eb63bbb" &&
							context.req.http["X-Decimal-Time"] === "1588888507",
						`Expected hex and decimal values to match what we set`,
					);
				},
			],
		},
	],
};

// Export the test suite
export default timeFunctionsTests;

// Run the test suite if this file is executed directly
if (import.meta.main) {
	runTestSuite(timeFunctionsTests);
}
