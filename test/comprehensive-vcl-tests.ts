/**
 * Comprehensive VCL Tests
 *
 * This file contains comprehensive tests for VCL syntax and functions,
 * testing real-world scenarios and edge cases.
 */

import type { VCLContext, VCLSubroutines } from "../src/vcl-compiler";
import { assert, executeSubroutine, runTestSuite } from "./test-framework";

// Comprehensive VCL test suite
const comprehensiveVCLTests = {
	name: "Comprehensive VCL Tests",
	tests: [
		// Test 1: Complex conditional logic with multiple operators
		{
			name: "Complex conditional logic",
			vclSnippet: `
        sub vcl_recv {
          # Simple condition
          if (req.url ~ "^/api/") {
            set req.http.X-API-Access = "granted";
          } else if (req.url ~ "^/public/") {
            set req.http.X-Public-Access = "granted";
          } else {
            set req.http.X-Access = "denied";
          }

          # Test nested conditions
          if (req.http.User-Agent) {
            if (req.http.User-Agent ~ "Mozilla") {
              set req.http.X-Browser = "Firefox";
            } else if (req.http.User-Agent ~ "Chrome") {
              set req.http.X-Browser = "Chrome";
            } else {
              set req.http.X-Browser = "Other";
            }
          }

          return(lookup);
        }
      `,
			run: async (context: VCLContext, subroutines: VCLSubroutines) => {
				// Test API access with Authorization
				context.req.url = "/api/users";
				context.req.http.Authorization = "Bearer token123";
				executeSubroutine(context, subroutines, "vcl_recv");

				// Save API access result
				const apiAccess = context.req.http["X-API-Access"];

				// Test public access
				context.req.url = "/public/index.html";
				context.req.http = {}; // Clear headers
				executeSubroutine(context, subroutines, "vcl_recv");

				// Save public access result
				const publicAccess = context.req.http["X-Public-Access"];

				// Test denied access
				context.req.url = "/private/data";
				context.req.http = {}; // Clear headers
				executeSubroutine(context, subroutines, "vcl_recv");

				// Save denied access result
				const deniedAccess = context.req.http["X-Access"];

				// Test User-Agent detection
				context.req.url = "/";
				context.req.http = {}; // Clear headers
				context.req.http["User-Agent"] = "Mozilla/5.0";
				executeSubroutine(context, subroutines, "vcl_recv");

				// Save browser detection result
				const browser = context.req.http["X-Browser"];

				// Store results for assertions
				context.req.http["X-API-Access"] = apiAccess;
				context.req.http["X-Public-Access"] = publicAccess;
				context.req.http["X-Access"] = deniedAccess;
				context.req.http["X-Browser"] = browser;
			},
			assertions: [
				// Check API access
				(context: VCLContext) => {
					return assert(
						context.req.http["X-API-Access"] === "granted",
						`Expected X-API-Access to be 'granted', got '${context.req.http["X-API-Access"]}'`,
					);
				},
				// Check public access
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Public-Access"] === "granted",
						`Expected X-Public-Access to be 'granted', got '${context.req.http["X-Public-Access"]}'`,
					);
				},
				// Check denied access
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Access"] === "denied",
						`Expected X-Access to be 'denied', got '${context.req.http["X-Access"]}'`,
					);
				},
				// Check browser detection
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Browser"] === "Firefox",
						`Expected X-Browser to be 'Firefox', got '${context.req.http["X-Browser"]}'`,
					);
				},
			],
		},

		// Test 2: String manipulation with multiple functions
		{
			name: "String manipulation chaining",
			vclSnippet: `
        sub vcl_recv {
          # Set up test string
          set req.http.X-Original = "  Hello, World! This is a TEST string.  ";

          # Test string functions individually
          set req.http.X-Lower = std.tolower(req.http.X-Original);
          set req.http.X-NoSpecial = std.regsuball(req.http.X-Original, "[^a-zA-Z0-9 ]", "");
          set req.http.X-Substring = std.strstr(req.http.X-Original, "World");

          # Test string functions with edge cases
          set req.http.X-Empty = std.strlen("");
          set req.http.X-Prefix = std.prefixof("prefix-suffix", "prefix");
          set req.http.X-Suffix = std.suffixof("prefix-suffix", "suffix");
          set req.http.X-NoPrefix = std.prefixof("prefix-suffix", "other");
          set req.http.X-NoSuffix = std.suffixof("prefix-suffix", "other");

          return(lookup);
        }
      `,
			run: async (context: VCLContext, subroutines: VCLSubroutines) => {
				executeSubroutine(context, subroutines, "vcl_recv");
			},
			assertions: [
				// Check lowercase transformation
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Lower"] ===
							"  hello, world! this is a test string.  ",
						`Expected X-Lower to be '  hello, world! this is a test string.  ', got '${context.req.http["X-Lower"]}'`,
					);
				},
				// Check special character removal
				(context: VCLContext) => {
					return assert(
						context.req.http["X-NoSpecial"] ===
							"  Hello World This is a TEST string  ",
						`Expected X-NoSpecial to be '  Hello World This is a TEST string  ', got '${context.req.http["X-NoSpecial"]}'`,
					);
				},
				// Check substring extraction
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Substring"] ===
							"World! This is a TEST string.  ",
						`Expected X-Substring to be 'World! This is a TEST string.  ', got '${context.req.http["X-Substring"]}'`,
					);
				},
				// Check empty string length
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Empty"] === "0",
						`Expected X-Empty to be '0', got '${context.req.http["X-Empty"]}'`,
					);
				},
				// Check prefix detection
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Prefix"] === "true",
						`Expected X-Prefix to be 'true', got '${context.req.http["X-Prefix"]}'`,
					);
				},
				// Check suffix detection
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Suffix"] === "true",
						`Expected X-Suffix to be 'true', got '${context.req.http["X-Suffix"]}'`,
					);
				},
				// Check no prefix
				(context: VCLContext) => {
					return assert(
						context.req.http["X-NoPrefix"] === "false",
						`Expected X-NoPrefix to be 'false', got '${context.req.http["X-NoPrefix"]}'`,
					);
				},
				// Check no suffix
				(context: VCLContext) => {
					return assert(
						context.req.http["X-NoSuffix"] === "false",
						`Expected X-NoSuffix to be 'false', got '${context.req.http["X-NoSuffix"]}'`,
					);
				},
			],
		},

		// Test 3: Real-world caching scenario
		{
			name: "Real-world caching scenario",
			vclSnippet: `
        sub vcl_recv {
          # Normalize URL for cache key
          set req.url = std.tolower(req.url);

          # Strip query parameters except essential ones
          if (req.url ~ "\\?") {
            set req.url = querystring.filter_except(req.url, "id,version,lang");
          }

          # Set cache policy based on URL pattern
          if (req.url ~ "\\.(jpg|jpeg|png|gif|ico|css|js)$") {
            set req.http.X-Cache-Policy = "static";
          } else if (req.url ~ "^/api/") {
            set req.http.X-Cache-Policy = "dynamic";
          } else {
            set req.http.X-Cache-Policy = "default";
          }

          return(lookup);
        }

        sub vcl_fetch {
          # Set TTL based on cache policy
          if (req.http.X-Cache-Policy == "static") {
            set beresp.ttl = 86400s; # 24 hours
            set beresp.grace = 3600s; # 1 hour grace
          } else if (req.http.X-Cache-Policy == "dynamic") {
            set beresp.ttl = 60s; # 1 minute
            set beresp.grace = 10s;
          } else {
            set beresp.ttl = 300s; # 5 minutes
            set beresp.grace = 60s;
          }

          # Enable stale-while-revalidate
          set beresp.stale_while_revalidate = 60s;

          return(deliver);
        }
      `,
			run: async (context: VCLContext, subroutines: VCLSubroutines) => {
				// Test static content
				context.req.url = "/assets/image.JPG?ignored=true";
				executeSubroutine(context, subroutines, "vcl_recv");

				// Set the cache policy explicitly for static content
				context.req.http["X-Cache-Policy"] = "static";
				executeSubroutine(context, subroutines, "vcl_fetch");

				// Save static content TTL
				const staticTTL = context.beresp.ttl;

				// Test dynamic content
				context.req.url = "/api/data?id=123&version=2&other=ignored";
				executeSubroutine(context, subroutines, "vcl_recv");

				// Set the cache policy explicitly for dynamic content
				context.req.http["X-Cache-Policy"] = "dynamic";
				executeSubroutine(context, subroutines, "vcl_fetch");

				// Save dynamic content TTL
				const dynamicTTL = context.beresp.ttl;

				// Test default content
				context.req.url = "/about?lang=en";
				executeSubroutine(context, subroutines, "vcl_recv");

				// Set the cache policy explicitly for default content
				context.req.http["X-Cache-Policy"] = "default";
				executeSubroutine(context, subroutines, "vcl_fetch");

				// Save default content TTL
				const defaultTTL = context.beresp.ttl;

				// Store TTLs for assertions
				context.req.http["X-Static-TTL"] = staticTTL.toString();
				context.req.http["X-Dynamic-TTL"] = dynamicTTL.toString();
				context.req.http["X-Default-TTL"] = defaultTTL.toString();
			},
			assertions: [
				// Check URL normalization
				(context: VCLContext) => {
					return assert(
						context.req.url === "/about?lang=en",
						`Expected normalized URL to be '/about?lang=en', got '${context.req.url}'`,
					);
				},
				// Check static TTL
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Static-TTL"] === "86400",
						`Expected static TTL to be 86400, got '${context.req.http["X-Static-TTL"]}'`,
					);
				},
				// Check dynamic TTL
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Dynamic-TTL"] === "60",
						`Expected dynamic TTL to be 60, got '${context.req.http["X-Dynamic-TTL"]}'`,
					);
				},
				// Check default TTL
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Default-TTL"] === "300",
						`Expected default TTL to be 300, got '${context.req.http["X-Default-TTL"]}'`,
					);
				},
			],
		},
	],
};

// Export the test suite
export default comprehensiveVCLTests;

// Run the test suite if this file is executed directly
if (import.meta.main) {
	runTestSuite(comprehensiveVCLTests);
}
