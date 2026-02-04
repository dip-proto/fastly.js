/**
 * Simple VCL Test
 *
 * Tests a very simple VCL configuration with basic routing
 */

import type { VCLContext, VCLSubroutines } from "../src/vcl-compiler";
import { assert, executeSubroutine, runTestSuite } from "./test-framework";

// Simple VCL test
const simpleTest = {
	name: "Simple VCL Test",
	tests: [
		{
			name: "Simple Backend Routing",
			vclFile: "test/fixtures/vcl-files/simple-test.vcl",
			run: async (context: VCLContext, subroutines: VCLSubroutines) => {
				// Set up the context for a request
				context.req.url = "/api/products";
				context.req.method = "GET";

				// Execute the subroutine
				const result = executeSubroutine(context, subroutines, "vcl_recv");

				// Set the state based on the result
				if (result === "pass") {
					context.fastly!.state = "pass";
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
						context.fastly!.state === "pass",
						`Expected state to be pass, got ${context.fastly!.state}`,
					);
				},
			],
		},
	],
};

// Export the test suite
export default simpleTest;

// Run the test suite if this file is executed directly
if (import.meta.main) {
	runTestSuite(simpleTest);
}
