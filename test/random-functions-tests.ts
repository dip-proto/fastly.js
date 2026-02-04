/**
 * Random Functions Tests
 *
 * Tests for VCL random functions including:
 * - randombool
 * - randombool_seeded
 * - randomint
 * - randomint_seeded
 * - randomstr
 */

import type { VCLContext, VCLSubroutines } from "../src/vcl-compiler";
import { assert, executeSubroutine, runTestSuite } from "./test-framework";

// Random Functions test suite
const randomFunctionsTests = {
	name: "Random Functions Tests",
	tests: [
		// Test 1: Basic random boolean generation
		{
			name: "Basic random boolean generation",
			vclSnippet: `
        sub vcl_recv {
          # Test randombool with different probabilities
          set req.http.X-Always-False = if(std.random.randombool(0.0), "true", "false");
          set req.http.X-Always-True = if(std.random.randombool(1.0), "true", "false");
          set req.http.X-Random-50 = if(std.random.randombool(0.5), "true", "false");

          return(lookup);
        }
      `,
			run: async (context: VCLContext, subroutines: VCLSubroutines) => {
				// Execute the subroutine
				executeSubroutine(context, subroutines, "vcl_recv");
			},
			assertions: [
				// Check always false
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Always-False"] === "false",
						`Expected X-Always-False to be 'false', got '${context.req.http["X-Always-False"]}'`,
					);
				},
				// Check always true
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Always-True"] === "true",
						`Expected X-Always-True to be 'true', got '${context.req.http["X-Always-True"]}'`,
					);
				},
				// Check random 50% is either true or false
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Random-50"] === "true" ||
							context.req.http["X-Random-50"] === "false",
						`Expected X-Random-50 to be 'true' or 'false', got '${context.req.http["X-Random-50"]}'`,
					);
				},
			],
		},

		// Test 2: Seeded random boolean generation
		{
			name: "Seeded random boolean generation",
			vclSnippet: `
        sub vcl_recv {
          # Test randombool_seeded with different seeds
          set req.http.X-Seed1-Result = if(std.random.randombool_seeded(0.5, "seed1"), "true", "false");
          set req.http.X-Seed2-Result = if(std.random.randombool_seeded(0.5, "seed2"), "true", "false");
          
          # Test consistency with the same seed
          set req.http.X-Seed1-Again = if(std.random.randombool_seeded(0.5, "seed1"), "true", "false");

          return(lookup);
        }
      `,
			run: async (context: VCLContext, subroutines: VCLSubroutines) => {
				// Execute the subroutine
				executeSubroutine(context, subroutines, "vcl_recv");
			},
			assertions: [
				// Check consistency with the same seed
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Seed1-Result"] === context.req.http["X-Seed1-Again"],
						`Expected X-Seed1-Result to equal X-Seed1-Again, got '${context.req.http["X-Seed1-Result"]}' and '${context.req.http["X-Seed1-Again"]}'`,
					);
				},
			],
		},

		// Test 3: Random integer generation
		{
			name: "Random integer generation",
			vclSnippet: `
        sub vcl_recv {
          # Test randomint with different ranges
          set req.http.X-Random-1-10 = std.random.randomint(1, 10);
          set req.http.X-Random-0-0 = std.random.randomint(0, 0);
          set req.http.X-Random-Negative = std.random.randomint(-10, -1);

          return(lookup);
        }
      `,
			run: async (context: VCLContext, subroutines: VCLSubroutines) => {
				// Execute the subroutine
				executeSubroutine(context, subroutines, "vcl_recv");
			},
			assertions: [
				// Check range 1-10
				(context: VCLContext) => {
					const value = parseInt(context.req.http["X-Random-1-10"]!, 10);
					return assert(
						value >= 1 && value <= 10,
						`Expected X-Random-1-10 to be between 1 and 10, got '${value}'`,
					);
				},
				// Check range 0-0
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Random-0-0"] === "0",
						`Expected X-Random-0-0 to be 0, got '${context.req.http["X-Random-0-0"]}'`,
					);
				},
				// Check negative range
				(context: VCLContext) => {
					const value = parseInt(context.req.http["X-Random-Negative"]!, 10);
					return assert(
						value >= -10 && value <= -1,
						`Expected X-Random-Negative to be between -10 and -1, got '${value}'`,
					);
				},
			],
		},

		// Test 4: Seeded random integer generation
		{
			name: "Seeded random integer generation",
			vclSnippet: `
        sub vcl_recv {
          # Test randomint_seeded with different seeds
          set req.http.X-Seed1-Int = std.random.randomint_seeded(1, 100, "seed1");
          set req.http.X-Seed2-Int = std.random.randomint_seeded(1, 100, "seed2");
          
          # Test consistency with the same seed
          set req.http.X-Seed1-Int-Again = std.random.randomint_seeded(1, 100, "seed1");

          return(lookup);
        }
      `,
			run: async (context: VCLContext, subroutines: VCLSubroutines) => {
				// Execute the subroutine
				executeSubroutine(context, subroutines, "vcl_recv");
			},
			assertions: [
				// Check consistency with the same seed
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Seed1-Int"] === context.req.http["X-Seed1-Int-Again"],
						`Expected X-Seed1-Int to equal X-Seed1-Int-Again, got '${context.req.http["X-Seed1-Int"]}' and '${context.req.http["X-Seed1-Int-Again"]}'`,
					);
				},
			],
		},

		// Test 5: Random string generation
		{
			name: "Random string generation",
			vclSnippet: `
        sub vcl_recv {
          # Test randomstr with different lengths
          set req.http.X-Random-Str-10 = std.random.randomstr(10);
          set req.http.X-Random-Str-5 = std.random.randomstr(5);
          
          # Test randomstr with custom charset
          set req.http.X-Random-Hex = std.random.randomstr(8, "0123456789ABCDEF");
          set req.http.X-Random-Digits = std.random.randomstr(6, "0123456789");

          return(lookup);
        }
      `,
			run: async (context: VCLContext, subroutines: VCLSubroutines) => {
				// Execute the subroutine
				executeSubroutine(context, subroutines, "vcl_recv");
			},
			assertions: [
				// Check string length 10
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Random-Str-10"]!.length === 10,
						`Expected X-Random-Str-10 to have length 10, got '${context.req.http["X-Random-Str-10"]!.length}'`,
					);
				},
				// Check string length 5
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Random-Str-5"]!.length === 5,
						`Expected X-Random-Str-5 to have length 5, got '${context.req.http["X-Random-Str-5"]!.length}'`,
					);
				},
				// Check hex charset
				(context: VCLContext) => {
					return assert(
						/^[0-9A-F]{8}$/.test(context.req.http["X-Random-Hex"]!),
						`Expected X-Random-Hex to be 8 hex characters, got '${context.req.http["X-Random-Hex"]}'`,
					);
				},
				// Check digits charset
				(context: VCLContext) => {
					return assert(
						/^[0-9]{6}$/.test(context.req.http["X-Random-Digits"]!),
						`Expected X-Random-Digits to be 6 digits, got '${context.req.http["X-Random-Digits"]}'`,
					);
				},
			],
		},
	],
};

// Export the test suite
export default randomFunctionsTests;

// Run the test suite if this file is executed directly
if (import.meta.main) {
	runTestSuite(randomFunctionsTests);
}
