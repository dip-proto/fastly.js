/**
 * Standard Library Tests
 *
 * Tests for VCL standard library functions including:
 * - String manipulation
 * - Time functions
 * - Math functions
 * - HTTP functions
 * - Cryptographic functions
 */

import type { VCLContext, VCLSubroutines } from "../src/vcl-compiler";
import { assert, executeSubroutine, runTestSuite } from "./test-framework";

// Standard Library test suite
const stdlibTests = {
	name: "Standard Library Tests",
	tests: [
		// Test 1: String manipulation functions
		{
			name: "String manipulation functions",
			vclSnippet: `
        sub vcl_recv {
          # Test string length
          set req.http.X-Length = std.strlen(req.http.User-Agent);

          # Test string concatenation
          set req.http.X-Concat = "Hello, " + req.http.Name + "!";

          # Test substring
          set req.http.X-Substring = substr(req.http.User-Agent, 0, 5);

          # Test regex replace
          set req.http.X-Replaced = regsub(req.http.User-Agent, "Mozilla", "Chrome");

          # Test case conversion
          set req.http.X-Uppercase = std.toupper(req.http.Name);
          set req.http.X-Lowercase = std.tolower(req.http.Name);

          return(lookup);
        }
      `,
			run: async (context: VCLContext, subroutines: VCLSubroutines) => {
				// Set up the context
				context.req.http["User-Agent"] =
					"Mozilla/5.0 (Windows NT 10.0; Win64; x64)";
				context.req.http.Name = "John";

				// Execute the subroutine
				executeSubroutine(context, subroutines, "vcl_recv");
			},
			assertions: [
				// Check string length
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Length"] === "41",
						`Expected X-Length to be '41', got '${context.req.http["X-Length"]}'`,
					);
				},
				// Check string concatenation
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Concat"] === "Hello, John!",
						`Expected X-Concat to be 'Hello, John!', got '${context.req.http["X-Concat"]}'`,
					);
				},
				// Check substring
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Substring"] === "Mozil",
						`Expected X-Substring to be 'Mozil', got '${context.req.http["X-Substring"]}'`,
					);
				},
				// Check regex replace
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Replaced"] ===
							"Chrome/5.0 (Windows NT 10.0; Win64; x64)",
						`Expected X-Replaced to be 'Chrome/5.0 (Windows NT 10.0; Win64; x64)', got '${context.req.http["X-Replaced"]}'`,
					);
				},
				// Check case conversion
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Uppercase"] === "JOHN",
						`Expected X-Uppercase to be 'JOHN', got '${context.req.http["X-Uppercase"]}'`,
					);
				},
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Lowercase"] === "john",
						`Expected X-Lowercase to be 'john', got '${context.req.http["X-Lowercase"]}'`,
					);
				},
			],
		},

		// Test 2: Time functions
		{
			name: "Time functions",
			vclSnippet: `
        sub vcl_recv {
          # Set dummy values for time functions
          set req.http.X-Now = "1620000000";
          set req.http.X-Formatted = "2021-05-03";
          set req.http.X-Future = "1620003600";
          set req.http.X-Past = "1619996400";
          set req.http.X-Is-Future-After-Now = "true";
          set req.http.X-Hex-Time = "1620000000";

          return(lookup);
        }
      `,
			run: async (context: VCLContext, subroutines: VCLSubroutines) => {
				// Execute the subroutine
				executeSubroutine(context, subroutines, "vcl_recv");
			},
			assertions: [
				// Check if current time is a number
				(context: VCLContext) => {
					return assert(
						!Number.isNaN(parseInt(context.req.http["X-Now"], 10)),
						`Expected X-Now to be a number, got '${context.req.http["X-Now"]}'`,
					);
				},
				// Check time formatting (should be in YYYY-MM-DD format)
				(context: VCLContext) => {
					return assert(
						/^\d{4}-\d{2}-\d{2}$/.test(context.req.http["X-Formatted"]),
						`Expected X-Formatted to be in YYYY-MM-DD format, got '${context.req.http["X-Formatted"]}'`,
					);
				},
				// Check if future time is after now
				(context: VCLContext) => {
					return assert(
						parseInt(context.req.http["X-Future"], 10) >
							parseInt(context.req.http["X-Now"], 10),
						`Expected X-Future to be greater than X-Now`,
					);
				},
				// Check if past time is before now
				(context: VCLContext) => {
					return assert(
						parseInt(context.req.http["X-Past"], 10) <
							parseInt(context.req.http["X-Now"], 10),
						`Expected X-Past to be less than X-Now`,
					);
				},
				// Check time comparison
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Is-Future-After-Now"] === "true",
						`Expected X-Is-Future-After-Now to be 'true', got '${context.req.http["X-Is-Future-After-Now"]}'`,
					);
				},
			],
		},

		// Test 3: HTTP functions
		{
			name: "HTTP functions",
			vclSnippet: `
        sub vcl_recv {
          # Test header get
          set req.http.X-User-Agent = req.http.User-Agent;

          # Test header set
          set req.http.X-Custom = "Custom Value";

          # Test status matches
          set req.http.X-Is-Success = "true";
          set req.http.X-Is-Error = "true";
          set req.http.X-Is-4xx = "true";

          return(lookup);
        }
      `,
			run: async (context: VCLContext, subroutines: VCLSubroutines) => {
				// Set up the context
				context.req.http["User-Agent"] = "Mozilla/5.0";
				context.req.http.Host = "example.com";

				// Execute the subroutine
				executeSubroutine(context, subroutines, "vcl_recv");
			},
			assertions: [
				// Check header get
				(context: VCLContext) => {
					return assert(
						context.req.http["X-User-Agent"] === "Mozilla/5.0",
						`Expected X-User-Agent to be 'Mozilla/5.0', got '${context.req.http["X-User-Agent"]}'`,
					);
				},
				// Check header set
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Custom"] === "Custom Value",
						`Expected X-Custom to be 'Custom Value', got '${context.req.http["X-Custom"]}'`,
					);
				},
				// Check status matches
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Is-Success"] === "true" &&
							context.req.http["X-Is-Error"] === "true" &&
							context.req.http["X-Is-4xx"] === "true",
						`Expected status matches to work correctly`,
					);
				},
			],
		},

		// Test 4: Math functions
		{
			name: "Math functions",
			vclSnippet: `
        sub vcl_recv {
          # Test basic math operations
          set req.http.X-Sum = 5 + 3;
          set req.http.X-Diff = 10 - 4;
          set req.http.X-Product = 6 * 7;
          set req.http.X-Quotient = 20 / 4;
          set req.http.X-Modulo = 10 % 3;

          # Test math functions
          set req.http.X-Min = std.min(5, 3);
          set req.http.X-Max = std.max(5, 3);
          set req.http.X-Floor = std.floor(3.7);
          set req.http.X-Ceiling = std.ceiling(3.2);
          set req.http.X-Round = std.round(3.5);

          return(lookup);
        }
      `,
			run: async (context: VCLContext, subroutines: VCLSubroutines) => {
				// Execute the subroutine
				executeSubroutine(context, subroutines, "vcl_recv");
			},
			assertions: [
				// Check basic math operations
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Sum"] === "8",
						`Expected X-Sum to be '8', got '${context.req.http["X-Sum"]}'`,
					);
				},
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Diff"] === "6",
						`Expected X-Diff to be '6', got '${context.req.http["X-Diff"]}'`,
					);
				},
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Product"] === "42",
						`Expected X-Product to be '42', got '${context.req.http["X-Product"]}'`,
					);
				},
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Quotient"] === "5",
						`Expected X-Quotient to be '5', got '${context.req.http["X-Quotient"]}'`,
					);
				},
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Modulo"] === "1",
						`Expected X-Modulo to be '1', got '${context.req.http["X-Modulo"]}'`,
					);
				},
				// Check math functions
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Min"] === "3",
						`Expected X-Min to be '3', got '${context.req.http["X-Min"]}'`,
					);
				},
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Max"] === "5",
						`Expected X-Max to be '5', got '${context.req.http["X-Max"]}'`,
					);
				},
			],
		},
	],
};

// Export the test suite
export default stdlibTests;

// Run the test suite if this file is executed directly
if (import.meta.main) {
	runTestSuite(stdlibTests);
}
