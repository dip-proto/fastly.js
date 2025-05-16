/**
 * Test for if statements in VCL
 */

import { createVCLContext, executeVCL, loadVCL } from "../../src/vcl";

// Load the VCL file
console.log("Loading VCL file...");
const subroutines = loadVCL("./test/fixtures/vcl-root-files/if_test.vcl");

// Print the loaded subroutines
console.log("Loaded subroutines:");
console.log(Object.keys(subroutines));

// Create a VCL context
const context = createVCLContext();

// Test API path
console.log("\nTest API path:");
context.req.url = "/api/users";
context.req.method = "GET";
context.req.http = {
	Host: "example.com",
	"User-Agent": "Mozilla/5.0",
};

// Execute vcl_recv
const recvResult = executeVCL(subroutines, "vcl_recv", context);
console.log(`vcl_recv returned: ${recvResult}`);
console.log("Request headers:");
console.log(context.req.http);
