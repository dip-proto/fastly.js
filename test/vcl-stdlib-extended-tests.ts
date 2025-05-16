/**
 * VCL Standard Library Extended Tests
 *
 * Tests for the extended standard library functions:
 * - std.* string functions (strlen, strrev, strrep, strpad, atoi, itoa, etc.)
 * - math.* functions (sqrt, pow, sin, cos, is_finite, etc.)
 * - Misc functions (urlencode, urldecode, boltsort.sort, subfield, etc.)
 * - Local variable declaration and assignment
 */

import type { VCLContext, VCLSubroutines } from "../src/vcl-compiler";
import { assert, executeSubroutine, runTestSuite } from "./test-framework";

const stdlibExtendedTests = {
	name: "VCL Standard Library Extended Tests",
	tests: [
		// Test std.* string functions
		{
			name: "std.strlen and std.strrev",
			vclSnippet: `
        sub vcl_recv {
          declare local var.str STRING;
          set var.str = "hello";
          set req.http.X-Strlen = std.strlen(var.str);
          set req.http.X-Strrev = std.strrev(var.str);
          return(lookup);
        }
      `,
			run: async (context: VCLContext, subroutines: VCLSubroutines) => {
				context.req.url = "/test";
				executeSubroutine(context, subroutines, "vcl_recv");
			},
			assertions: [
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Strlen"] === "5",
						`Expected X-Strlen to be '5', got '${context.req.http["X-Strlen"]}'`,
					);
				},
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Strrev"] === "olleh",
						`Expected X-Strrev to be 'olleh', got '${context.req.http["X-Strrev"]}'`,
					);
				},
			],
		},

		// Test std.strrep and std.strpad
		{
			name: "std.strrep and std.strpad",
			vclSnippet: `
        sub vcl_recv {
          set req.http.X-Strrep = std.strrep("ab", 3);
          set req.http.X-Strpad = std.strpad("5", 3, "0");
          return(lookup);
        }
      `,
			run: async (context: VCLContext, subroutines: VCLSubroutines) => {
				context.req.url = "/test";
				executeSubroutine(context, subroutines, "vcl_recv");
			},
			assertions: [
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Strrep"] === "ababab",
						`Expected X-Strrep to be 'ababab', got '${context.req.http["X-Strrep"]}'`,
					);
				},
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Strpad"] === "005",
						`Expected X-Strpad to be '005', got '${context.req.http["X-Strpad"]}'`,
					);
				},
			],
		},

		// Test std.atoi and std.itoa
		{
			name: "std.atoi and std.itoa",
			vclSnippet: `
        sub vcl_recv {
          set req.http.X-Atoi = std.atoi("42");
          set req.http.X-Itoa = std.itoa(255, 16);
          set req.http.X-Atoi-Float = std.atoi("3.14");
          return(lookup);
        }
      `,
			run: async (context: VCLContext, subroutines: VCLSubroutines) => {
				context.req.url = "/test";
				executeSubroutine(context, subroutines, "vcl_recv");
			},
			assertions: [
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Atoi"] === "42",
						`Expected X-Atoi to be '42', got '${context.req.http["X-Atoi"]}'`,
					);
				},
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Itoa"] === "ff",
						`Expected X-Itoa to be 'ff', got '${context.req.http["X-Itoa"]}'`,
					);
				},
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Atoi-Float"] === "3",
						`Expected X-Atoi-Float to be '3', got '${context.req.http["X-Atoi-Float"]}'`,
					);
				},
			],
		},

		// Test std.replace_prefix and std.replace_suffix
		{
			name: "std.replace_prefix and std.replace_suffix",
			vclSnippet: `
        sub vcl_recv {
          set req.http.X-Replace-Prefix = std.replace_prefix("/api/v1/users", "/api/v1", "/api/v2");
          set req.http.X-Replace-Suffix = std.replace_suffix("file.txt", ".txt", ".json");
          return(lookup);
        }
      `,
			run: async (context: VCLContext, subroutines: VCLSubroutines) => {
				context.req.url = "/test";
				executeSubroutine(context, subroutines, "vcl_recv");
			},
			assertions: [
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Replace-Prefix"] === "/api/v2/users",
						`Expected X-Replace-Prefix to be '/api/v2/users', got '${context.req.http["X-Replace-Prefix"]}'`,
					);
				},
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Replace-Suffix"] === "file.json",
						`Expected X-Replace-Suffix to be 'file.json', got '${context.req.http["X-Replace-Suffix"]}'`,
					);
				},
			],
		},

		// Test std.basename and std.dirname
		{
			name: "std.basename and std.dirname",
			vclSnippet: `
        sub vcl_recv {
          set req.http.X-Basename = std.basename("/path/to/file.txt");
          set req.http.X-Dirname = std.dirname("/path/to/file.txt");
          return(lookup);
        }
      `,
			run: async (context: VCLContext, subroutines: VCLSubroutines) => {
				context.req.url = "/test";
				executeSubroutine(context, subroutines, "vcl_recv");
			},
			assertions: [
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Basename"] === "file.txt",
						`Expected X-Basename to be 'file.txt', got '${context.req.http["X-Basename"]}'`,
					);
				},
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Dirname"] === "/path/to",
						`Expected X-Dirname to be '/path/to', got '${context.req.http["X-Dirname"]}'`,
					);
				},
			],
		},

		// Test math functions
		{
			name: "math.sqrt and math.pow",
			vclSnippet: `
        sub vcl_recv {
          set req.http.X-Sqrt = math.sqrt(16.0);
          set req.http.X-Pow = math.pow(2.0, 3.0);
          return(lookup);
        }
      `,
			run: async (context: VCLContext, subroutines: VCLSubroutines) => {
				context.req.url = "/test";
				executeSubroutine(context, subroutines, "vcl_recv");
			},
			assertions: [
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Sqrt"] === "4",
						`Expected X-Sqrt to be '4', got '${context.req.http["X-Sqrt"]}'`,
					);
				},
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Pow"] === "8",
						`Expected X-Pow to be '8', got '${context.req.http["X-Pow"]}'`,
					);
				},
			],
		},

		// Test math trigonometric functions
		{
			name: "math.sin and math.cos",
			vclSnippet: `
        sub vcl_recv {
          set req.http.X-Sin = math.sin(0.0);
          set req.http.X-Cos = math.cos(0.0);
          return(lookup);
        }
      `,
			run: async (context: VCLContext, subroutines: VCLSubroutines) => {
				context.req.url = "/test";
				executeSubroutine(context, subroutines, "vcl_recv");
			},
			assertions: [
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Sin"] === "0",
						`Expected X-Sin to be '0', got '${context.req.http["X-Sin"]}'`,
					);
				},
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Cos"] === "1",
						`Expected X-Cos to be '1', got '${context.req.http["X-Cos"]}'`,
					);
				},
			],
		},

		// Test math.is_nan and math.is_finite
		{
			name: "math.is_finite",
			vclSnippet: `
        sub vcl_recv {
          set req.http.X-Is-Finite = if(math.is_finite(42.0), "true", "false");
          return(lookup);
        }
      `,
			run: async (context: VCLContext, subroutines: VCLSubroutines) => {
				context.req.url = "/test";
				executeSubroutine(context, subroutines, "vcl_recv");
			},
			assertions: [
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Is-Finite"] === "true",
						`Expected X-Is-Finite to be 'true', got '${context.req.http["X-Is-Finite"]}'`,
					);
				},
			],
		},

		// Test misc functions
		{
			name: "urlencode and urldecode",
			vclSnippet: `
        sub vcl_recv {
          set req.http.X-Encoded = urlencode("hello world");
          set req.http.X-Decoded = urldecode("hello%20world");
          return(lookup);
        }
      `,
			run: async (context: VCLContext, subroutines: VCLSubroutines) => {
				context.req.url = "/test";
				executeSubroutine(context, subroutines, "vcl_recv");
			},
			assertions: [
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Encoded"] === "hello%20world",
						`Expected X-Encoded to be 'hello%20world', got '${context.req.http["X-Encoded"]}'`,
					);
				},
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Decoded"] === "hello world",
						`Expected X-Decoded to be 'hello world', got '${context.req.http["X-Decoded"]}'`,
					);
				},
			],
		},

		// Test boltsort.sort
		{
			name: "boltsort.sort",
			vclSnippet: `
        sub vcl_recv {
          set req.http.X-Sorted = boltsort.sort("/path?z=1&a=2&m=3");
          return(lookup);
        }
      `,
			run: async (context: VCLContext, subroutines: VCLSubroutines) => {
				context.req.url = "/test";
				executeSubroutine(context, subroutines, "vcl_recv");
			},
			assertions: [
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Sorted"] === "/path?a=2&m=3&z=1",
						`Expected X-Sorted to be '/path?a=2&m=3&z=1', got '${context.req.http["X-Sorted"]}'`,
					);
				},
			],
		},

		// Test subfield
		{
			name: "subfield extraction",
			vclSnippet: `
        sub vcl_recv {
          set req.http.X-Subfield = subfield("a=1; b=2; c=3", "b", ";");
          return(lookup);
        }
      `,
			run: async (context: VCLContext, subroutines: VCLSubroutines) => {
				context.req.url = "/test";
				executeSubroutine(context, subroutines, "vcl_recv");
			},
			assertions: [
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Subfield"] === "2",
						`Expected X-Subfield to be '2', got '${context.req.http["X-Subfield"]}'`,
					);
				},
			],
		},

		// Test http_status_matches
		{
			name: "http_status_matches",
			vclSnippet: `
        sub vcl_recv {
          set req.http.X-Match-200 = if(http_status_matches(200, "2xx"), "true", "false");
          set req.http.X-Match-404 = if(http_status_matches(404, "4xx"), "true", "false");
          set req.http.X-Match-Exact = if(http_status_matches(500, "500"), "true", "false");
          return(lookup);
        }
      `,
			run: async (context: VCLContext, subroutines: VCLSubroutines) => {
				context.req.url = "/test";
				executeSubroutine(context, subroutines, "vcl_recv");
			},
			assertions: [
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Match-200"] === "true",
						`Expected X-Match-200 to be 'true', got '${context.req.http["X-Match-200"]}'`,
					);
				},
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Match-404"] === "true",
						`Expected X-Match-404 to be 'true', got '${context.req.http["X-Match-404"]}'`,
					);
				},
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Match-Exact"] === "true",
						`Expected X-Match-Exact to be 'true', got '${context.req.http["X-Match-Exact"]}'`,
					);
				},
			],
		},

		// Test randomint
		{
			name: "randomint generation",
			vclSnippet: `
        sub vcl_recv {
          declare local var.rand INTEGER;
          set var.rand = randomint(1, 100);
          set req.http.X-Random = if(var.rand >= 1 && var.rand <= 100, "valid", "invalid");
          return(lookup);
        }
      `,
			run: async (context: VCLContext, subroutines: VCLSubroutines) => {
				context.req.url = "/test";
				executeSubroutine(context, subroutines, "vcl_recv");
			},
			assertions: [
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Random"] === "valid",
						`Expected X-Random to be 'valid', got '${context.req.http["X-Random"]}'`,
					);
				},
			],
		},

		// Test randomstr
		{
			name: "randomstr generation",
			vclSnippet: `
        sub vcl_recv {
          declare local var.str STRING;
          set var.str = randomstr(10);
          set req.http.X-Random-Len = std.strlen(var.str);
          return(lookup);
        }
      `,
			run: async (context: VCLContext, subroutines: VCLSubroutines) => {
				context.req.url = "/test";
				executeSubroutine(context, subroutines, "vcl_recv");
			},
			assertions: [
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Random-Len"] === "10",
						`Expected X-Random-Len to be '10', got '${context.req.http["X-Random-Len"]}'`,
					);
				},
			],
		},
	],
};

// Export the test suite
export default stdlibExtendedTests;

// Run the test suite if this file is executed directly
if (import.meta.main) {
	runTestSuite(stdlibExtendedTests);
}
