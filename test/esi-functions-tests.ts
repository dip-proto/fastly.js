/**
 * ESI Functions Tests
 *
 * Tests for VCL Edge Side Includes (ESI) functionality:
 * - ESI tag parsing
 * - ESI include processing
 * - ESI conditional processing
 * - ESI integration with VCL
 */

import type { VCLContext, VCLSubroutines } from "../src/vcl-compiler";
import { processESI } from "../src/vcl-esi";
import { assert, executeSubroutine, runTestSuite } from "./test-framework";

// ESI Functions test suite
const esiFunctionsTests = {
	name: "ESI Functions Tests",
	tests: [
		{
			name: "ESI Parser - Basic Include Tags",
			vclSnippet: `
        sub vcl_recv {
          # Enable ESI processing
          set beresp.do_esi = true;

          # Set a test response with ESI tags
          set req.http.X-Test-ESI = "true";

          return(lookup);
        }
      `,
			run: async (context: VCLContext, subroutines: VCLSubroutines) => {
				// Set up the context
				context.obj.response = `
          <html>
            <head>
              <title>Test Page</title>
            </head>
            <body>
              <h1>Welcome to the Test Page</h1>
              <div class="header">
                <esi:include src="/header" />
              </div>
              <div class="content">
                <p>This is the main content.</p>
              </div>
              <div class="footer">
                <esi:include src="/footer" />
              </div>
            </body>
          </html>
        `;

				// Enable ESI processing
				context.beresp.do_esi = true;
				context.beresp.http["Content-Type"] = "text/html";
				context.resp.http["Content-Type"] = "text/html";

				// Process the ESI tags
				const processed = processESI(context.obj.response, context);
				context.obj.response = processed;

				// Execute the subroutine
				executeSubroutine(context, subroutines, "vcl_recv");
			},
			assertions: [
				// Check that ESI processing was enabled
				(context: VCLContext) => {
					return assert(
						context.beresp.do_esi === true,
						`Expected beresp.do_esi to be true, got ${context.beresp.do_esi}`,
					);
				},
				// Check that the ESI include tags were processed
				(context: VCLContext) => {
					return assert(
						context.obj.response.includes("<header>") &&
							context.obj.response.includes("<footer>") &&
							context.obj.response.includes("<nav>") &&
							context.obj.response.includes("Home") &&
							context.obj.response.includes("About") &&
							context.obj.response.includes("Contact") &&
							context.obj.response.includes("&copy; 2023 Example Company"),
						"ESI include tags were not properly processed",
					);
				},
			],
		},
		{
			name: "ESI Parser - Remove Tags",
			vclSnippet: `
        sub vcl_recv {
          # Enable ESI processing
          set beresp.do_esi = true;

          # Set a test response with ESI remove tags
          set req.http.X-Test-ESI-Remove = "true";

          return(lookup);
        }
      `,
			run: async (context: VCLContext, subroutines: VCLSubroutines) => {
				// Set up the context
				context.obj.response = `
          <html>
            <body>
              <h1>Welcome</h1>
              <esi:remove>
                <div class="debug">
                  Debug information that should be removed
                </div>
              </esi:remove>
              <p>This content should remain.</p>
            </body>
          </html>
        `;

				// Enable ESI processing
				context.beresp.do_esi = true;
				context.beresp.http["Content-Type"] = "text/html";
				context.resp.http["Content-Type"] = "text/html";

				// Process the ESI tags
				const processed = processESI(context.obj.response, context);
				context.obj.response = processed;

				// Execute the subroutine
				executeSubroutine(context, subroutines, "vcl_recv");
			},
			assertions: [
				// Check that the content inside ESI remove tags was removed
				(context: VCLContext) => {
					return assert(
						context.obj.response.includes("<h1>Welcome</h1>") &&
							context.obj.response.includes("<p>This content should remain.</p>") &&
							!context.obj.response.includes("Debug information that should be removed"),
						"ESI remove tags were not properly processed",
					);
				},
			],
		},
		{
			name: "ESI Parser - Comment Tags",
			vclSnippet: `
        sub vcl_recv {
          # Enable ESI processing
          set beresp.do_esi = true;

          # Set a test response with ESI comment tags
          set req.http.X-Test-ESI-Comment = "true";

          return(lookup);
        }
      `,
			run: async (context: VCLContext, subroutines: VCLSubroutines) => {
				// Set up the context
				context.obj.response = `
          <html>
            <body>
              <h1>Welcome</h1>
              <esi:comment text="This is a comment that should be removed" />
              <p>This content should remain.</p>
            </body>
          </html>
        `;

				// Enable ESI processing
				context.beresp.do_esi = true;
				context.beresp.http["Content-Type"] = "text/html";
				context.resp.http["Content-Type"] = "text/html";

				// Process the ESI tags
				const processed = processESI(context.obj.response, context);
				context.obj.response = processed;

				// Execute the subroutine
				executeSubroutine(context, subroutines, "vcl_recv");
			},
			assertions: [
				// Check that the ESI comment tags were removed
				(context: VCLContext) => {
					return assert(
						context.obj.response.includes("<h1>Welcome</h1>") &&
							context.obj.response.includes("<p>This content should remain.</p>") &&
							!context.obj.response.includes("This is a comment that should be removed"),
						"ESI comment tags were not properly processed",
					);
				},
			],
		},
		{
			name: "ESI Parser - Choose/When/Otherwise Tags",
			vclSnippet: `
        sub vcl_recv {
          # Enable ESI processing
          set beresp.do_esi = true;

          # Set a test response with ESI choose/when/otherwise tags
          set req.http.X-Test-ESI-Choose = "true";

          return(lookup);
        }
      `,
			run: async (context: VCLContext, subroutines: VCLSubroutines) => {
				// Set up the context
				context.obj.response = `
          <html>
            <body>
              <h1>Welcome</h1>
              <esi:choose>
                <esi:when test="$(HTTP_COOKIE{user_type}) == 'premium'">
                  <div class="premium-content">
                    Premium content here
                  </div>
                </esi:when>
                <esi:otherwise>
                  <div class="standard-content">
                    Standard content here
                  </div>
                </esi:otherwise>
              </esi:choose>
            </body>
          </html>
        `;

				// Set up a cookie for testing
				context.req.http.Cookie = "user_type=premium";

				// Enable ESI processing
				context.beresp.do_esi = true;
				context.beresp.http["Content-Type"] = "text/html";
				context.resp.http["Content-Type"] = "text/html";

				// Process the ESI tags
				const processed = processESI(context.obj.response, context);
				context.obj.response = processed;

				// Store the premium content result
				context.req.http["X-Premium-Result"] = context.obj.response;

				// Now change the cookie and test again
				context.req.http.Cookie = "user_type=standard";

				// Process the ESI tags again with the standard cookie
				const originalResponse = `
          <html>
            <body>
              <h1>Welcome</h1>
              <esi:choose>
                <esi:when test="$(HTTP_COOKIE{user_type}) == 'premium'">
                  <div class="premium-content">
                    Premium content here
                  </div>
                </esi:when>
                <esi:otherwise>
                  <div class="standard-content">
                    Standard content here
                  </div>
                </esi:otherwise>
              </esi:choose>
            </body>
          </html>
        `;

				const processed2 = processESI(originalResponse, context);
				context.req.http["X-Standard-Result"] = processed2;

				// Execute the subroutine
				executeSubroutine(context, subroutines, "vcl_recv");
			},
			assertions: [
				// Check that the correct branch was chosen for premium user
				(context: VCLContext) => {
					return assert(
						context.obj.response.includes('<div class="premium-content">') &&
							context.obj.response.includes("Premium content here") &&
							!context.obj.response.includes('<div class="standard-content">') &&
							!context.obj.response.includes("Standard content here"),
						"ESI choose/when/otherwise tags were not properly processed for premium user",
					);
				},
				// Check that the correct branch was chosen for standard user
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Standard-Result"]!.includes('<div class="standard-content">') &&
							context.req.http["X-Standard-Result"]!.includes("Standard content here") &&
							!context.req.http["X-Standard-Result"]!.includes('<div class="premium-content">') &&
							!context.req.http["X-Standard-Result"]!.includes("Premium content here"),
						"ESI choose/when/otherwise tags were not properly processed for standard user",
					);
				},
			],
		},
		{
			name: "VCL Integration - Enable ESI Processing",
			vclSnippet: `
        sub vcl_fetch {
          # Enable ESI processing for HTML content
          if (beresp.http.Content-Type ~ "text/html") {
            set beresp.do_esi = true;
          }
          return(deliver);
        }
      `,
			run: async (context: VCLContext, subroutines: VCLSubroutines) => {
				// Set up the context
				context.beresp.http["Content-Type"] = "text/html; charset=utf-8";

				// Execute the subroutine
				executeSubroutine(context, subroutines, "vcl_fetch");
			},
			assertions: [
				// Check that ESI processing was enabled
				(context: VCLContext) => {
					return assert(
						context.beresp.do_esi === true,
						`Expected beresp.do_esi to be true, got ${context.beresp.do_esi}`,
					);
				},
			],
		},
		{
			name: "VCL Integration - Process ESI Tags in Response Body",
			vclSnippet: `
        sub vcl_deliver {
          # ESI processing should already be enabled by this point
          # This is just a placeholder for the test
          set resp.http.X-ESI-Processed = "true";
          return(deliver);
        }
      `,
			run: async (context: VCLContext, subroutines: VCLSubroutines) => {
				// Set up the context
				context.obj.response = `
          <html>
            <body>
              <h1>Welcome</h1>
              <div class="header">
                <esi:include src="/header" />
              </div>
              <div class="content">
                <p>This is the main content.</p>
              </div>
              <div class="footer">
                <esi:include src="/footer" />
              </div>
            </body>
          </html>
        `;

				// Enable ESI processing
				context.beresp.do_esi = true;
				context.beresp.http["Content-Type"] = "text/html; charset=utf-8";
				context.resp.http["Content-Type"] = "text/html; charset=utf-8";

				// Execute the subroutine
				executeSubroutine(context, subroutines, "vcl_deliver");

				// Process ESI tags manually for testing
				context.obj.response = processESI(context.obj.response, context);
			},
			assertions: [
				// Check that ESI tags were processed
				(context: VCLContext) => {
					return assert(
						context.obj.response.includes("<header>") &&
							context.obj.response.includes("<footer>") &&
							context.obj.response.includes("<nav>") &&
							context.obj.response.includes("Home") &&
							context.obj.response.includes("About") &&
							context.obj.response.includes("Contact") &&
							context.obj.response.includes("&copy; 2023 Example Company"),
						"ESI tags were not properly processed in the response body",
					);
				},
			],
		},
	],
};

// Export the test suite
export default esiFunctionsTests;

// Run the test suite if this file is executed directly
if (import.meta.main) {
	runTestSuite(esiFunctionsTests);
}
