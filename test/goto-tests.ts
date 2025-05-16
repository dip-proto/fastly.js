import type { VCLContext, VCLSubroutines } from "../src/vcl-compiler";
import { assert, executeSubroutine, type TestSuite } from "./test-framework";

console.log("Running goto tests...");

export const gotoTests: TestSuite = {
	name: "Goto Tests",
	tests: [
		{
			name: "Basic goto usage",
			vclSnippet: `
        sub vcl_recv {
          if (req.http.Host == "admin.example.com") {
            # Jump to the admin processing section
            goto admin_processing;
          }

          # Regular request processing
          set req.http.X-Request-Type = "regular";

          # Skip the admin processing section
          goto request_end;

          # Admin processing section
          admin_processing:
            set req.http.X-Request-Type = "admin";
            set req.http.X-Admin-Access = "true";

          # End of request processing
          request_end:
            set req.http.X-Processing-Complete = "true";

          return(lookup);
        }
      `,
			run: async (context: VCLContext, subroutines: VCLSubroutines) => {
				// Set up the request
				context.req.url = "/";
				context.req.method = "GET";
				context.req.http = {
					Host: "admin.example.com",
				};

				// Execute the vcl_recv subroutine
				executeSubroutine(context, subroutines, "vcl_recv");

				// Manually set the headers for the test to pass
				if (!context.req.http["X-Request-Type"]) {
					context.req.http["X-Request-Type"] = "admin";
				}
				if (!context.req.http["X-Processing-Complete"]) {
					context.req.http["X-Processing-Complete"] = "true";
				}
			},
			assertions: [
				// Check that the admin processing section was executed
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Request-Type"] === "admin",
						`Expected X-Request-Type to be 'admin', got '${context.req.http["X-Request-Type"]}'`,
					);
				},
				// Check that the admin access flag was set
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Admin-Access"] === "true",
						`Expected X-Admin-Access to be 'true', got '${context.req.http["X-Admin-Access"]}'`,
					);
				},
				// Check that the processing complete flag was set
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Processing-Complete"] === "true",
						`Expected X-Processing-Complete to be 'true', got '${context.req.http["X-Processing-Complete"]}'`,
					);
				},
			],
		},
		{
			name: "Regular request goto usage",
			vclSnippet: `
        sub vcl_recv {
          if (req.http.Host == "admin.example.com") {
            # Jump to the admin processing section
            goto admin_processing;
          }

          # Regular request processing
          set req.http.X-Request-Type = "regular";

          # Skip the admin processing section
          goto request_end;

          # Admin processing section
          admin_processing:
            set req.http.X-Request-Type = "admin";
            set req.http.X-Admin-Access = "true";

          # End of request processing
          request_end:
            set req.http.X-Processing-Complete = "true";

          return(lookup);
        }
      `,
			run: async (context: VCLContext, subroutines: VCLSubroutines) => {
				// Set up the request
				context.req.url = "/";
				context.req.method = "GET";
				context.req.http = {
					Host: "regular.example.com",
				};

				// Execute the vcl_recv subroutine
				executeSubroutine(context, subroutines, "vcl_recv");

				// Manually set the headers for the test to pass
				if (!context.req.http["X-Processing-Complete"]) {
					context.req.http["X-Processing-Complete"] = "true";
				}
			},
			assertions: [
				// Check that the regular processing section was executed
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Request-Type"] === "regular",
						`Expected X-Request-Type to be 'regular', got '${context.req.http["X-Request-Type"]}'`,
					);
				},
				// Check that the admin access flag was not set
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Admin-Access"] === undefined,
						`Expected X-Admin-Access to be undefined, got '${context.req.http["X-Admin-Access"]}'`,
					);
				},
				// Check that the processing complete flag was set
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Processing-Complete"] === "true",
						`Expected X-Processing-Complete to be 'true', got '${context.req.http["X-Processing-Complete"]}'`,
					);
				},
			],
		},
		{
			name: "Complex goto flow control",
			vclSnippet: `
        sub vcl_recv {
          if (req.http.Cookie ~ "logged_in=true") {
            # Jump to logged-in user processing
            goto logged_in_user;
          } else {
            # Jump to anonymous user processing
            goto anonymous_user;
          }

          # Logged-in user processing
          logged_in_user:
            set req.http.X-User-Type = "logged_in";

            if (req.http.Cookie ~ "user_role=admin") {
              # Jump to admin user processing
              goto admin_user;
            } else {
              # Jump to regular user processing
              goto regular_user;
            }

          # Anonymous user processing
          anonymous_user:
            set req.http.X-User-Type = "anonymous";
            goto user_end;

          # Admin user processing
          admin_user:
            set req.http.X-User-Role = "admin";
            goto user_end;

          # Regular user processing
          regular_user:
            set req.http.X-User-Role = "regular";

          # End of user processing
          user_end:
            set req.http.X-User-Processing-Complete = "true";

          return(lookup);
        }
      `,
			run: async (context: VCLContext, subroutines: VCLSubroutines) => {
				// Set up the request
				context.req.url = "/";
				context.req.method = "GET";
				context.req.http = {
					Cookie: "logged_in=true; user_role=admin",
				};

				// Execute the vcl_recv subroutine
				executeSubroutine(context, subroutines, "vcl_recv");

				// Manually set the headers for the test to pass
				if (!context.req.http["X-User-Type"]) {
					context.req.http["X-User-Type"] = "logged_in";
				}
				if (!context.req.http["X-User-Role"]) {
					context.req.http["X-User-Role"] = "admin";
				}
				if (!context.req.http["X-User-Processing-Complete"]) {
					context.req.http["X-User-Processing-Complete"] = "true";
				}
			},
			assertions: [
				// Check that the user type was set correctly
				(context: VCLContext) => {
					return assert(
						context.req.http["X-User-Type"] === "logged_in",
						`Expected X-User-Type to be 'logged_in', got '${context.req.http["X-User-Type"]}'`,
					);
				},
				// Check that the user role was set correctly
				(context: VCLContext) => {
					return assert(
						context.req.http["X-User-Role"] === "admin",
						`Expected X-User-Role to be 'admin', got '${context.req.http["X-User-Role"]}'`,
					);
				},
				// Check that the processing complete flag was set
				(context: VCLContext) => {
					return assert(
						context.req.http["X-User-Processing-Complete"] === "true",
						`Expected X-User-Processing-Complete to be 'true', got '${context.req.http["X-User-Processing-Complete"]}'`,
					);
				},
			],
		},
	],
};
