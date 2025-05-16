/**
 * Basic VCL Tests
 *
 * Tests for basic VCL functionality including:
 * - Subroutine execution
 * - Variable assignment
 * - Conditional statements
 * - Return statements
 */

import type { VCLContext, VCLSubroutines } from "../src/vcl-compiler";
import { assert, executeSubroutine, runTestSuite } from "./test-framework";

// Basic VCL test suite
const basicVCLTests = {
	name: "Basic VCL Tests",
	tests: [
		// Test 1: Simple subroutine execution
		{
			name: "Simple subroutine execution",
			vclSnippet: `
        sub vcl_recv {
          set req.http.X-Test = "Hello, World!";
          return(lookup);
        }
      `,
			run: async (context: VCLContext, subroutines: VCLSubroutines) => {
				// Set up the context
				context.req.url = "/";
				context.req.method = "GET";

				// Execute the subroutine
				const result = executeSubroutine(context, subroutines, "vcl_recv");

				// Verify the result
				if (result !== "lookup") {
					throw new Error(`Expected 'lookup', got '${result}'`);
				}
			},
			assertions: [
				// Check if the header was set correctly
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Test"] === "Hello, World!",
						`Expected X-Test header to be 'Hello, World!', got '${context.req.http["X-Test"]}'`,
					);
				},
			],
		},

		// Test 2: Conditional statements
		{
			name: "Conditional statements",
			vclSnippet: `
        sub vcl_recv {
          if (req.url ~ "^/api/") {
            set req.http.X-API = "true";
            return(pass);
          } else if (req.url ~ "^/static/") {
            set req.http.X-Static = "true";
            return(lookup);
          } else {
            set req.http.X-Default = "true";
            return(lookup);
          }
        }
      `,
			run: async (context: VCLContext, subroutines: VCLSubroutines) => {
				// Test API path
				context.req.url = "/api/users";
				const apiResult = executeSubroutine(context, subroutines, "vcl_recv");
				if (apiResult !== "pass") {
					throw new Error(`Expected 'pass' for API path, got '${apiResult}'`);
				}

				// Test static path
				context.req.url = "/static/css/style.css";
				const staticResult = executeSubroutine(
					context,
					subroutines,
					"vcl_recv",
				);
				if (staticResult !== "lookup") {
					throw new Error(
						`Expected 'lookup' for static path, got '${staticResult}'`,
					);
				}

				// Test default path
				context.req.url = "/home";
				const defaultResult = executeSubroutine(
					context,
					subroutines,
					"vcl_recv",
				);
				if (defaultResult !== "lookup") {
					throw new Error(
						`Expected 'lookup' for default path, got '${defaultResult}'`,
					);
				}
			},
			assertions: [
				// Check if the headers were set correctly
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Default"] === "true",
						`Expected X-Default header to be 'true', got '${context.req.http["X-Default"]}'`,
					);
				},
			],
		},

		// Test 3: Variable declaration and assignment
		{
			name: "Variable declaration and assignment",
			vclSnippet: `
        sub vcl_recv {
          declare local var.test_string STRING;
          declare local var.test_int INTEGER;
          declare local var.test_bool BOOL;

          set var.test_string = "test";
          set var.test_int = 42;
          set var.test_bool = true;

          set req.http.X-String = var.test_string;
          set req.http.X-Int = var.test_int;
          set req.http.X-Bool = if(var.test_bool, "true", "false");

          return(lookup);
        }
      `,
			run: async (context: VCLContext, subroutines: VCLSubroutines) => {
				// Execute the subroutine
				executeSubroutine(context, subroutines, "vcl_recv");
			},
			assertions: [
				// Check if the variables were set correctly
				(context: VCLContext) => {
					return assert(
						context.req.http["X-String"] === "test",
						`Expected X-String header to be 'test', got '${context.req.http["X-String"]}'`,
					);
				},
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Int"] === "42",
						`Expected X-Int header to be '42', got '${context.req.http["X-Int"]}'`,
					);
				},
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Bool"] === "true",
						`Expected X-Bool header to be 'true', got '${context.req.http["X-Bool"]}'`,
					);
				},
			],
		},

		// Test 4: Multiple subroutines
		{
			name: "Multiple subroutines",
			vclSnippet: `
        sub vcl_recv {
          set req.http.X-Recv = "true";
          return(lookup);
        }

        sub vcl_deliver {
          set resp.http.X-Deliver = "true";
          return(deliver);
        }
      `,
			run: async (context: VCLContext, subroutines: VCLSubroutines) => {
				// Execute the recv subroutine
				executeSubroutine(context, subroutines, "vcl_recv");

				// Execute the deliver subroutine
				executeSubroutine(context, subroutines, "vcl_deliver");
			},
			assertions: [
				// Check if both headers were set correctly
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Recv"] === "true",
						`Expected X-Recv header to be 'true', got '${context.req.http["X-Recv"]}'`,
					);
				},
				(context: VCLContext) => {
					return assert(
						context.resp.http["X-Deliver"] === "true",
						`Expected X-Deliver header to be 'true', got '${context.resp.http["X-Deliver"]}'`,
					);
				},
			],
		},

		// Test 5: Regular expressions with capture groups
		{
			name: "Regular expressions",
			vclSnippet: `
        sub vcl_recv {
          # Test capture groups from regex
          if (req.url ~ "^/users/([0-9]+)") {
            set req.http.X-User-ID = re.group.1;
            set req.http.X-Full-Match = re.group.0;
            return(lookup);
          }

          # Test multiple capture groups
          if (req.url ~ "^/products/([a-z]+)-([0-9]+)") {
            set req.http.X-Product-Type = re.group.1;
            set req.http.X-Product-ID = re.group.2;
            return(lookup);
          }

          return(lookup);
        }
      `,
			run: async (context: VCLContext, subroutines: VCLSubroutines) => {
				// Test user URL - should capture the user ID
				context.req.url = "/users/123";

				// Execute the subroutine
				executeSubroutine(context, subroutines, "vcl_recv");
			},
			assertions: [
				// Verify that re.group.1 correctly captured the user ID
				(context: VCLContext) => {
					return assert(
						context.req.http["X-User-ID"] === "123",
						`Expected X-User-ID to be '123', got '${context.req.http["X-User-ID"]}'`,
					);
				},
				// Verify that re.group.0 contains the full match
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Full-Match"] === "/users/123",
						`Expected X-Full-Match to be '/users/123', got '${context.req.http["X-Full-Match"]}'`,
					);
				},
			],
		},
	],
};

// Export the test suite
export default basicVCLTests;

// Run the test suite if this file is executed directly
if (import.meta.main) {
	runTestSuite(basicVCLTests);
}
