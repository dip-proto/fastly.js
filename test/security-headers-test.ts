/**
 * Security Headers Test
 *
 * Tests the security headers functionality in the VCL compiler
 */

import type { VCLContext, VCLSubroutines } from "../src/vcl-compiler";
import { assert, executeSubroutine, runTestSuite } from "./test-framework";

// Security Headers Test
const securityHeadersTest = {
	name: "Security Headers Test",
	tests: [
		{
			name: "Security Headers Assignment",
			vclSnippet: `
        sub vcl_deliver {
          set resp.http.X-Content-Type-Options = "nosniff";
          set resp.http.X-Frame-Options = "SAMEORIGIN";
          set resp.http.X-XSS-Protection = "1; mode=block";
          return(deliver);
        }
      `,
			run: async (context: VCLContext, subroutines: VCLSubroutines) => {
				// Execute the subroutine
				const result = executeSubroutine(context, subroutines, "vcl_deliver");

				// Set the state based on the result
				if (result === "deliver") {
					context.fastly!.state = "deliver";
				}
			},
			assertions: [
				// Check that the security headers are set
				(context: VCLContext) => {
					return assert(
						context.resp.http["X-Content-Type-Options"] === "nosniff",
						`Expected X-Content-Type-Options to be nosniff, got ${context.resp.http["X-Content-Type-Options"]}`,
					);
				},
				(context: VCLContext) => {
					return assert(
						context.resp.http["X-Frame-Options"] === "SAMEORIGIN",
						`Expected X-Frame-Options to be SAMEORIGIN, got ${context.resp.http["X-Frame-Options"]}`,
					);
				},
				(context: VCLContext) => {
					return assert(
						context.resp.http["X-XSS-Protection"] === "1; mode=block",
						`Expected X-XSS-Protection to be 1; mode=block, got ${context.resp.http["X-XSS-Protection"]}`,
					);
				},
			],
		},
	],
};

// Export the test suite
export default securityHeadersTest;

// Run the test suite if this file is executed directly
if (import.meta.main) {
	runTestSuite(securityHeadersTest);
}
