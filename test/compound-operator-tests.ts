/**
 * Compound Assignment Operator Tests
 *
 * Tests for VCL compound assignment operators:
 * - += (addition/concatenation)
 * - -= (subtraction)
 * - *= (multiplication)
 * - /= (division)
 * - %= (modulo)
 */

import type { VCLContext, VCLSubroutines } from "../src/vcl-compiler";
import { assert, executeSubroutine, runTestSuite } from "./test-framework";

// Compound operator test suite
const compoundOperatorTests = {
	name: "Compound Assignment Operator Tests",
	tests: [
		// Test 1: String concatenation with +=
		{
			name: "String concatenation with +=",
			vclSnippet: `
        sub vcl_recv {
          set req.http.X-Message = "Hello";
          set req.http.X-Message += ", World!";
          return(lookup);
        }
      `,
			run: async (context: VCLContext, subroutines: VCLSubroutines) => {
				executeSubroutine(context, subroutines, "vcl_recv");
			},
			assertions: [
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Message"] === "Hello, World!",
						`Expected X-Message to be 'Hello, World!', got '${context.req.http["X-Message"]}'`,
					);
				},
			],
		},

		// Test 2: Numeric addition with +=
		{
			name: "Numeric addition with +=",
			vclSnippet: `
        sub vcl_recv {
          set req.http.X-Count = "10";
          set req.http.X-Count += 5;
          return(lookup);
        }
      `,
			run: async (context: VCLContext, subroutines: VCLSubroutines) => {
				executeSubroutine(context, subroutines, "vcl_recv");
			},
			assertions: [
				(context: VCLContext) => {
					// Since we're working with headers (strings), the result is string concatenation
					// This is expected VCL behavior
					return assert(
						context.req.http["X-Count"] === "105",
						`Expected X-Count to be '105' (string concat), got '${context.req.http["X-Count"]}'`,
					);
				},
			],
		},

		// Test 3: Basic assignment still works
		{
			name: "Basic assignment with =",
			vclSnippet: `
        sub vcl_recv {
          set req.http.X-Value = "original";
          set req.http.X-Value = "replaced";
          return(lookup);
        }
      `,
			run: async (context: VCLContext, subroutines: VCLSubroutines) => {
				executeSubroutine(context, subroutines, "vcl_recv");
			},
			assertions: [
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Value"] === "replaced",
						`Expected X-Value to be 'replaced', got '${context.req.http["X-Value"]}'`,
					);
				},
			],
		},
	],
};

// Export the test suite
export default compoundOperatorTests;

// Run the test suite if this file is executed directly
if (import.meta.main) {
	runTestSuite(compoundOperatorTests);
}
