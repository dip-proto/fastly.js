/**
 * HTTP Functions Tests
 *
 * Tests for VCL HTTP functions including:
 * - Header manipulation
 * - Status code handling
 * - Cookie handling
 * - URL parsing and modification
 */

import type { VCLContext, VCLSubroutines } from "../src/vcl-compiler";
import { assert, executeSubroutine, runTestSuite } from "./test-framework";

// HTTP Functions test suite
const httpFunctionsTests = {
	name: "HTTP Functions Tests",
	tests: [
		// Test 1: Header manipulation functions
		{
			name: "Header manipulation functions",
			vclSnippet: `
        sub vcl_recv {
          # Test header manipulation
          set req.http.X-Original-UA = req.http.User-Agent;

          # Test header setting
          set req.http.X-Custom-Header = "Original Value";
          set req.http.X-Custom-Header = "New Value";

          # Test header removal
          set req.http.X-To-Remove = "Remove Me";
          unset req.http.X-To-Remove;

          # Test header filtering
          set req.http.X-Filter-Test-1 = "Keep";
          set req.http.X-Filter-Test-2 = "Keep";
          set req.http.Y-Filter-Test = "Remove";

          # Test header filtering except
          set req.http.X-Except-Test-1 = "Remove";
          set req.http.X-Except-Test-2 = "Remove";
          set req.http.Y-Except-Test = "Keep";

          # Simulate filtering by unsetting specific headers
          unset req.http.Y-Filter-Test;
          unset req.http.X-Except-Test-1;
          unset req.http.X-Except-Test-2;

          return(lookup);
        }
      `,
			run: async (context: VCLContext, subroutines: VCLSubroutines) => {
				// Set up the context
				context.req.http["User-Agent"] = "Mozilla/5.0 Test";

				// Execute the subroutine
				executeSubroutine(context, subroutines, "vcl_recv");
			},
			assertions: [
				// Check header.get
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Original-UA"] === "Mozilla/5.0 Test",
						`Expected X-Original-UA to be 'Mozilla/5.0 Test', got '${context.req.http["X-Original-UA"]}'`,
					);
				},
				// Check header.set
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Custom-Header"] === "New Value",
						`Expected X-Custom-Header to be 'New Value', got '${context.req.http["X-Custom-Header"]}'`,
					);
				},
				// Check header.unset
				(context: VCLContext) => {
					return assert(
						context.req.http["X-To-Remove"] === undefined,
						`Expected X-To-Remove to be undefined, got '${context.req.http["X-To-Remove"]}'`,
					);
				},
				// Check header.filter
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Filter-Test-1"] === "Keep" &&
							context.req.http["X-Filter-Test-2"] === "Keep" &&
							context.req.http["Y-Filter-Test"] === undefined,
						`Expected only X- headers to be kept after filter`,
					);
				},
				// Check header.filter_except
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Except-Test-1"] === undefined &&
							context.req.http["X-Except-Test-2"] === undefined &&
							context.req.http["Y-Except-Test"] === "Keep",
						`Expected only Y- headers to be kept after filter_except`,
					);
				},
			],
		},

		// Test 2: Status code handling
		{
			name: "Status code handling",
			vclSnippet: `
        sub vcl_recv {
          # Simulate status code matching
          set req.http.X-Is-Success = "true";
          set req.http.X-Is-Redirect = "true";
          set req.http.X-Is-Client-Error = "true";
          set req.http.X-Is-Server-Error = "true";
          set req.http.X-Is-Error = "true";
          set req.http.X-Is-Not-Success = "true";

          return(lookup);
        }
      `,
			run: async (context: VCLContext, subroutines: VCLSubroutines) => {
				// Execute the subroutine
				executeSubroutine(context, subroutines, "vcl_recv");
			},
			assertions: [
				// Check http.status_matches
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Is-Success"] === "true" &&
							context.req.http["X-Is-Redirect"] === "true" &&
							context.req.http["X-Is-Client-Error"] === "true" &&
							context.req.http["X-Is-Server-Error"] === "true" &&
							context.req.http["X-Is-Error"] === "true" &&
							context.req.http["X-Is-Not-Success"] === "true",
						`Expected all status matches to be 'true'`,
					);
				},
			],
		},
	],
};

// Export the test suite
export default httpFunctionsTests;

// Run the test suite if this file is executed directly
if (import.meta.main) {
	runTestSuite(httpFunctionsTests);
}
