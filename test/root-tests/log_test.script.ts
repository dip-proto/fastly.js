/**
 * Test for log statements in VCL
 */

import { createVCLContext, executeVCL, loadVCL } from "../../src/vcl";

// Load the VCL file
console.log("Loading VCL file...");
const subroutines = loadVCL("./test/fixtures/vcl-root-files/log_test.vcl");

// Print the loaded subroutines
console.log("Loaded subroutines:");
console.log(Object.keys(subroutines));

// Create a VCL context
const context = createVCLContext();

// Set up the context
context.req.url = "/test";
context.req.method = "GET";
context.req.http = {
	Host: "example.com",
	"User-Agent": "Mozilla/5.0",
};

// Execute vcl_recv
console.log("\nExecuting vcl_recv...");
const recvResult = executeVCL(subroutines, "vcl_recv", context);
console.log(`vcl_recv returned: ${recvResult}`);
