/**
 * Backend Name Test
 *
 * Tests the backend name evaluation in the VCL compiler
 */

import type { VCLContext, VCLSubroutines } from "../src/vcl-compiler";
import { assert, executeSubroutine, runTestSuite } from "./test-framework";

// Backend Name Test
const backendNameTest = {
	name: "Backend Name Test",
	tests: [
		{
			name: "Backend Name Evaluation",
			vclSnippet: `
        backend origin_api {
          .host = "api.example.com";
          .port = "443";
          .ssl = true;
        }

        sub vcl_recv {
          # Use a string literal instead of an identifier
          set req.backend = "origin_api";
          return(pass);
        }
      `,
			run: async (context: VCLContext, subroutines: VCLSubroutines) => {
				// Add the backend to the context
				context.backends = {
					...context.backends,
					origin_api: {
						name: "origin_api",
						host: "api.example.com",
						port: 443,
						ssl: true,
						connect_timeout: 1000,
						first_byte_timeout: 15000,
						between_bytes_timeout: 10000,
						max_connections: 200,
						is_healthy: true,
					},
				};

				// Execute the subroutine
				const result = executeSubroutine(context, subroutines, "vcl_recv");

				// Set the state based on the result
				if (result === "pass") {
					context.fastly.state = "pass";
				}
			},
			assertions: [
				// Check that the request is routed to the API backend
				(context: VCLContext) => {
					return assert(
						context.req.backend === "origin_api",
						`Expected backend to be origin_api, got ${context.req.backend}`,
					);
				},
				// Check that the request is passed (not cached)
				(context: VCLContext) => {
					return assert(
						context.fastly.state === "pass",
						`Expected state to be pass, got ${context.fastly.state}`,
					);
				},
			],
		},
	],
};

// Export the test suite
export default backendNameTest;

// Run the test suite if this file is executed directly
if (import.meta.main) {
	runTestSuite(backendNameTest);
}
