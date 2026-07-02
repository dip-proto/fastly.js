/**
 * Query String Functions Tests
 *
 * Tests for VCL query string functions including:
 * - querystring.get
 * - querystring.set
 * - querystring.add
 * - querystring.remove
 * - querystring.clean
 * - querystring.filter / filter_except / filtersep
 * - querystring.sort
 *
 * Expected values verified against Fastly semantics: functions operate on a
 * full URL (everything before "?" is preserved), remove() strips the whole
 * query string, clean() keeps empty values but drops empty names, and get()
 * returns not-set for absent parameters or inputs without a query string.
 */

import type { VCLContext, VCLSubroutines } from "../src/vcl-compiler";
import { assert, executeSubroutine, runTestSuite } from "./test-framework";

const queryStringFunctionsTests = {
	name: "Query String Functions Tests",
	tests: [
		{
			name: "Basic parameter extraction with querystring.get",
			vclSnippet: `
        sub vcl_recv {
          set req.http.X-URL = "/products?product_id=12345&category=electronics&sort_by=price";

          set req.http.X-Product-ID = querystring.get(req.http.X-URL, "product_id");
          set req.http.X-Category = querystring.get(req.http.X-URL, "category");
          set req.http.X-Sort-By = querystring.get(req.http.X-URL, "sort_by");

          # Absent parameter: not set
          set req.http.X-Missing = querystring.get(req.http.X-URL, "missing");

          # No query string at all: not set
          set req.http.X-No-Query = querystring.get("product_id=12345", "product_id");

          return(lookup);
        }
      `,
			run: async (context: VCLContext, subroutines: VCLSubroutines) => {
				executeSubroutine(context, subroutines, "vcl_recv");
			},
			assertions: [
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Product-ID"] === "12345",
						`Expected X-Product-ID to be '12345', got '${context.req.http["X-Product-ID"]}'`,
					);
				},
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Category"] === "electronics",
						`Expected X-Category to be 'electronics', got '${context.req.http["X-Category"]}'`,
					);
				},
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Sort-By"] === "price",
						`Expected X-Sort-By to be 'price', got '${context.req.http["X-Sort-By"]}'`,
					);
				},
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Missing"] === undefined,
						`Expected X-Missing to be unset, got '${context.req.http["X-Missing"]}'`,
					);
				},
				(context: VCLContext) => {
					return assert(
						context.req.http["X-No-Query"] === undefined,
						`Expected X-No-Query to be unset (input has no "?"), got '${context.req.http["X-No-Query"]}'`,
					);
				},
			],
		},

		{
			name: "Adding parameters with querystring.add",
			vclSnippet: `
        sub vcl_recv {
          # Add to a URL without a query string
          set req.http.X-Result1 = querystring.add("/p", "page", "1");

          # Add to an existing query string
          set req.http.X-Result2 = querystring.add("/p?category=electronics&sort=price", "limit", "20");

          # Adding a duplicate name groups it with the first occurrence
          set req.http.X-Result3 = querystring.add(req.http.X-Result2, "category", "computers");

          # Build a query string from scratch
          set req.http.X-Built = querystring.add("/p", "product", "laptop");
          set req.http.X-Built = querystring.add(req.http.X-Built, "brand", "acme");
          set req.http.X-Built = querystring.add(req.http.X-Built, "price", "500-1000");

          return(lookup);
        }
      `,
			run: async (context: VCLContext, subroutines: VCLSubroutines) => {
				executeSubroutine(context, subroutines, "vcl_recv");
			},
			assertions: [
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Result1"] === "/p?page=1",
						`Expected X-Result1 to be '/p?page=1', got '${context.req.http["X-Result1"]}'`,
					);
				},
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Result2"] === "/p?category=electronics&sort=price&limit=20",
						`Expected X-Result2 to be '/p?category=electronics&sort=price&limit=20', got '${context.req.http["X-Result2"]}'`,
					);
				},
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Result3"] ===
							"/p?category=electronics&category=computers&sort=price&limit=20",
						`Expected duplicates grouped at first occurrence, got '${context.req.http["X-Result3"]}'`,
					);
				},
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Built"] === "/p?product=laptop&brand=acme&price=500-1000",
						`Expected X-Built to be '/p?product=laptop&brand=acme&price=500-1000', got '${context.req.http["X-Built"]}'`,
					);
				},
			],
		},

		{
			name: "Setting parameters with querystring.set",
			vclSnippet: `
        sub vcl_recv {
          # Set on a URL without a query string
          set req.http.X-Result1 = querystring.set("/p", "page", "1");

          # Set a new parameter on an existing query string
          set req.http.X-Result2 = querystring.set("/p?category=electronics&sort=price", "limit", "20");

          # Replace an existing parameter
          set req.http.X-Result3 = querystring.set("/p?category=electronics&sort=price", "category", "computers");

          return(lookup);
        }
      `,
			run: async (context: VCLContext, subroutines: VCLSubroutines) => {
				executeSubroutine(context, subroutines, "vcl_recv");
			},
			assertions: [
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Result1"] === "/p?page=1",
						`Expected X-Result1 to be '/p?page=1', got '${context.req.http["X-Result1"]}'`,
					);
				},
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Result2"] === "/p?category=electronics&sort=price&limit=20",
						`Expected X-Result2 to be '/p?category=electronics&sort=price&limit=20', got '${context.req.http["X-Result2"]}'`,
					);
				},
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Result3"] === "/p?category=computers&sort=price",
						`Expected X-Result3 to be '/p?category=computers&sort=price', got '${context.req.http["X-Result3"]}'`,
					);
				},
			],
		},

		{
			name: "Removing the query string with querystring.remove",
			vclSnippet: `
        sub vcl_recv {
          # remove() strips the entire query string
          set req.http.X-Result1 = querystring.remove("/p?id=123&tag=red");

          # No query string: unchanged
          set req.http.X-Result2 = querystring.remove("/p");

          # Removing individual parameters is filter's job
          set req.http.X-Result3 = querystring.filter("/p?id=123&tag=red&sort=price", "tag" + querystring.filtersep() + "sort");
          set req.http.X-Result4 = querystring.filter_except("/p?id=123&tag=red&sort=price", "id" + querystring.filtersep() + "sort");

          return(lookup);
        }
      `,
			run: async (context: VCLContext, subroutines: VCLSubroutines) => {
				executeSubroutine(context, subroutines, "vcl_recv");
			},
			assertions: [
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Result1"] === "/p",
						`Expected X-Result1 to be '/p', got '${context.req.http["X-Result1"]}'`,
					);
				},
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Result2"] === "/p",
						`Expected X-Result2 to be '/p', got '${context.req.http["X-Result2"]}'`,
					);
				},
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Result3"] === "/p?id=123",
						`Expected X-Result3 to be '/p?id=123', got '${context.req.http["X-Result3"]}'`,
					);
				},
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Result4"] === "/p?id=123&sort=price",
						`Expected X-Result4 to be '/p?id=123&sort=price', got '${context.req.http["X-Result4"]}'`,
					);
				},
			],
		},

		{
			name: "Cleaning query strings with querystring.clean",
			vclSnippet: `
        sub vcl_recv {
          # clean() keeps empty values but drops empty names and empty pairs
          set req.http.X-Result1 = querystring.clean("/p?id=123&empty=&blank=&valid=yes");
          set req.http.X-Result2 = querystring.clean("/p?id=123&&=c&valid=yes");
          set req.http.X-Result3 = querystring.clean("/p?id=123&category=electronics&sort=price");
          set req.http.X-Result4 = querystring.sort("/p?c=3&a=1&b=2");

          return(lookup);
        }
      `,
			run: async (context: VCLContext, subroutines: VCLSubroutines) => {
				executeSubroutine(context, subroutines, "vcl_recv");
			},
			assertions: [
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Result1"] === "/p?id=123&empty=&blank=&valid=yes",
						`Expected empty values kept, got '${context.req.http["X-Result1"]}'`,
					);
				},
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Result2"] === "/p?id=123&valid=yes",
						`Expected empty names and pairs dropped, got '${context.req.http["X-Result2"]}'`,
					);
				},
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Result3"] === "/p?id=123&category=electronics&sort=price",
						`Expected X-Result3 to be unchanged, got '${context.req.http["X-Result3"]}'`,
					);
				},
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Result4"] === "/p?a=1&b=2&c=3",
						`Expected sorted query string, got '${context.req.http["X-Result4"]}'`,
					);
				},
			],
		},
	],
};

// Export the test suite
export default queryStringFunctionsTests;

// Run the test suite if this file is executed directly
if (import.meta.main) {
	runTestSuite(queryStringFunctionsTests);
}
