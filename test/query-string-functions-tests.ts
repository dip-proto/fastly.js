/**
 * Query String Functions Tests
 *
 * Tests for VCL query string functions including:
 * - querystring.get
 * - querystring.set
 * - querystring.add
 * - querystring.remove
 * - querystring.clean
 * - querystring.filter
 * - querystring.filter_except
 * - querystring.filtersep
 * - querystring.sort
 */

import type { VCLContext, VCLSubroutines } from "../src/vcl-compiler";
import { assert, executeSubroutine, runTestSuite } from "./test-framework";

// Query String Functions test suite
const queryStringFunctionsTests = {
	name: "Query String Functions Tests",
	tests: [
		// Test 1: Basic parameter extraction with querystring.get
		{
			name: "Basic parameter extraction with querystring.get",
			vclSnippet: `
        sub vcl_recv {
          # Set a sample query string
          set req.http.X-Query-String = "product_id=12345&category=electronics&sort_by=price";

          # Extract specific parameters
          set req.http.X-Product-ID = querystring.get(req.http.X-Query-String, "product_id");
          set req.http.X-Category = querystring.get(req.http.X-Query-String, "category");
          set req.http.X-Sort-By = querystring.get(req.http.X-Query-String, "sort_by");

          # Test non-existent parameter
          set req.http.X-Missing = querystring.get(req.http.X-Query-String, "missing");

          return(lookup);
        }
      `,
			run: async (context: VCLContext, subroutines: VCLSubroutines) => {
				// Execute the subroutine
				executeSubroutine(context, subroutines, "vcl_recv");
			},
			assertions: [
				// Check product_id extraction
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Product-ID"] === "12345",
						`Expected X-Product-ID to be '12345', got '${context.req.http["X-Product-ID"]}'`,
					);
				},
				// Check category extraction
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Category"] === "electronics",
						`Expected X-Category to be 'electronics', got '${context.req.http["X-Category"]}'`,
					);
				},
				// Check sort_by extraction
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Sort-By"] === "price",
						`Expected X-Sort-By to be 'price', got '${context.req.http["X-Sort-By"]}'`,
					);
				},
				// Check missing parameter
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Missing"] === null ||
							context.req.http["X-Missing"] === "" ||
							context.req.http["X-Missing"] === "null",
						`Expected X-Missing to be null or empty, got '${context.req.http["X-Missing"]}'`,
					);
				},
			],
		},

		// Test 2: Adding parameters with querystring.add
		{
			name: "Adding parameters with querystring.add",
			vclSnippet: `
        sub vcl_recv {
          # Test adding to empty query string
          set req.http.X-Empty-QS = "";
          set req.http.X-Result1 = querystring.add(req.http.X-Empty-QS, "page", "1");

          # Test adding to existing query string
          set req.http.X-Existing-QS = "category=electronics&sort=price";
          set req.http.X-Result2 = querystring.add(req.http.X-Existing-QS, "limit", "20");

          # Test adding a parameter that already exists (should add duplicate)
          set req.http.X-Result3 = querystring.add(req.http.X-Result2, "category", "computers");

          # Test building a query string from scratch
          set req.http.X-Built-QS = "";
          set req.http.X-Built-QS = querystring.add(req.http.X-Built-QS, "product", "laptop");
          set req.http.X-Built-QS = querystring.add(req.http.X-Built-QS, "brand", "acme");
          set req.http.X-Built-QS = querystring.add(req.http.X-Built-QS, "price", "500-1000");

          return(lookup);
        }
      `,
			run: async (context: VCLContext, subroutines: VCLSubroutines) => {
				// Execute the subroutine
				executeSubroutine(context, subroutines, "vcl_recv");
			},
			assertions: [
				// Check adding to empty query string
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Result1"] === "page=1",
						`Expected X-Result1 to be 'page=1', got '${context.req.http["X-Result1"]}'`,
					);
				},
				// Check adding to existing query string
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Result2"] === "category=electronics&sort=price&limit=20",
						`Expected X-Result2 to be 'category=electronics&sort=price&limit=20', got '${context.req.http["X-Result2"]}'`,
					);
				},
				// Check adding duplicate parameter
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Result3"] ===
							"category=electronics&sort=price&limit=20&category=computers",
						`Expected X-Result3 to be 'category=electronics&sort=price&limit=20&category=computers', got '${context.req.http["X-Result3"]}'`,
					);
				},
				// Check building query string from scratch
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Built-QS"] === "product=laptop&brand=acme&price=500-1000",
						`Expected X-Built-QS to be 'product=laptop&brand=acme&price=500-1000', got '${context.req.http["X-Built-QS"]}'`,
					);
				},
			],
		},

		// Test 3: Setting parameters with querystring.set
		{
			name: "Setting parameters with querystring.set",
			vclSnippet: `
        sub vcl_recv {
          # Test setting in empty query string
          set req.http.X-Empty-QS = "";
          set req.http.X-Result1 = querystring.set(req.http.X-Empty-QS, "page", "1");

          # Test setting new parameter in existing query string
          set req.http.X-Existing-QS = "category=electronics&sort=price";
          set req.http.X-Result2 = querystring.set(req.http.X-Existing-QS, "limit", "20");

          # Test replacing existing parameter
          set req.http.X-Result3 = querystring.set(req.http.X-Existing-QS, "category", "computers");

          return(lookup);
        }
      `,
			run: async (context: VCLContext, subroutines: VCLSubroutines) => {
				// Execute the subroutine
				executeSubroutine(context, subroutines, "vcl_recv");
			},
			assertions: [
				// Check setting in empty query string
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Result1"] === "page=1",
						`Expected X-Result1 to be 'page=1', got '${context.req.http["X-Result1"]}'`,
					);
				},
				// Check setting new parameter
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Result2"] === "category=electronics&sort=price&limit=20",
						`Expected X-Result2 to be 'category=electronics&sort=price&limit=20', got '${context.req.http["X-Result2"]}'`,
					);
				},
				// Check replacing existing parameter
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Result3"] === "category=computers&sort=price",
						`Expected X-Result3 to be 'category=computers&sort=price', got '${context.req.http["X-Result3"]}'`,
					);
				},
			],
		},

		// Test 4: Removing parameters with querystring.remove
		{
			name: "Removing parameters with querystring.remove",
			vclSnippet: `
        sub vcl_recv {
          # Set up test query string
          set req.http.X-Query-String = "id=123&category=electronics&sort=price&page=1";

          # Remove a parameter
          set req.http.X-Result1 = querystring.remove(req.http.X-Query-String, "sort");

          # Remove a parameter that appears multiple times
          set req.http.X-Duplicate-QS = "id=123&tag=red&tag=blue&tag=green";
          set req.http.X-Result2 = querystring.remove(req.http.X-Duplicate-QS, "tag");

          # Remove a non-existent parameter
          set req.http.X-Result3 = querystring.remove(req.http.X-Query-String, "missing");

          # Remove the only parameter
          set req.http.X-Single-QS = "param=value";
          set req.http.X-Result4 = querystring.remove(req.http.X-Single-QS, "param");

          return(lookup);
        }
      `,
			run: async (context: VCLContext, subroutines: VCLSubroutines) => {
				// Execute the subroutine
				executeSubroutine(context, subroutines, "vcl_recv");
			},
			assertions: [
				// Check removing a parameter
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Result1"] === "id=123&category=electronics&page=1",
						`Expected X-Result1 to be 'id=123&category=electronics&page=1', got '${context.req.http["X-Result1"]}'`,
					);
				},
				// Check removing multiple occurrences of a parameter
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Result2"] === "id=123",
						`Expected X-Result2 to be 'id=123', got '${context.req.http["X-Result2"]}'`,
					);
				},
				// Check removing non-existent parameter
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Result3"] === "id=123&category=electronics&sort=price&page=1",
						`Expected X-Result3 to be unchanged, got '${context.req.http["X-Result3"]}'`,
					);
				},
				// Check removing the only parameter
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Result4"] === "",
						`Expected X-Result4 to be empty, got '${context.req.http["X-Result4"]}'`,
					);
				},
			],
		},

		// Test 5: Cleaning query strings with querystring.clean
		{
			name: "Cleaning query strings with querystring.clean",
			vclSnippet: `
        sub vcl_recv {
          # Test cleaning a query string with empty parameters
          set req.http.X-Original-QS = "id=123&empty=&blank=&valid=yes";
          set req.http.X-Result1 = querystring.clean(req.http.X-Original-QS);

          # Test cleaning a query string with no empty parameters
          set req.http.X-Clean-QS = "id=123&category=electronics&sort=price";
          set req.http.X-Result2 = querystring.clean(req.http.X-Clean-QS);

          return(lookup);
        }
      `,
			run: async (context: VCLContext, subroutines: VCLSubroutines) => {
				// Execute the subroutine
				executeSubroutine(context, subroutines, "vcl_recv");
			},
			assertions: [
				// Check cleaning query string with empty parameters
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Result1"] === "id=123&valid=yes",
						`Expected X-Result1 to be 'id=123&valid=yes', got '${context.req.http["X-Result1"]}'`,
					);
				},
				// Check cleaning query string with no empty parameters
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Result2"] === "id=123&category=electronics&sort=price",
						`Expected X-Result2 to be unchanged, got '${context.req.http["X-Result2"]}'`,
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
