/**
 * Backend Assignment Test
 *
 * Tests the backend assignment functionality in the VCL compiler
 */

import type { VCLContext, VCLSubroutines } from "../src/vcl-compiler";
import { assert, executeSubroutine, runTestSuite } from "./test-framework";

// Backend Assignment Test
const backendAssignmentTest = {
	name: "Backend Assignment Test",
	tests: [
		{
			name: "Direct Backend Assignment",
			vclSnippet: `
        backend origin_api {
          .host = "api.example.com";
          .port = "443";
          .ssl = true;
        }
        
        sub vcl_recv {
          set req.backend = origin_api;
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
				executeSubroutine(context, subroutines, "vcl_recv");
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
						context.fastly!.state === "pass",
						`Expected state to be pass, got ${context.fastly!.state}`,
					);
				},
			],
		},
	],
};

// Export the test suite
export default backendAssignmentTest;

// Run the test suite if this file is executed directly
if (import.meta.main) {
	runTestSuite(backendAssignmentTest);
}
