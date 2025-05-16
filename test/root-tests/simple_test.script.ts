/**
 * Simple VCL Test
 *
 * This script tests the VCL parser and execution with a simple VCL file.
 */

import { createVCLContext, executeVCL, loadVCL } from "../../src/vcl";

// Load the VCL file
console.log("Loading VCL file...");
const subroutines = loadVCL("./test/fixtures/vcl-root-files/simple_test.vcl");

// Print the loaded subroutines
console.log("Loaded subroutines:");
console.log(Object.keys(subroutines));

// Create a VCL context
const context = createVCLContext();

// Test 1: Default path
console.log("\nTest 1: Default path");
context.req.url = "/home";
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

// Test 2: API path
console.log("\nTest 2: API path");
context.req.url = "/api/users";
context.req.method = "GET";
context.req.http = {
	Host: "example.com",
	"User-Agent": "Mozilla/5.0",
};

// Execute vcl_recv
const recvResult2 = executeVCL(subroutines, "vcl_recv", context);
console.log(`vcl_recv returned: ${recvResult2}`);
console.log("Request headers:");
console.log(context.req.http);

// Test 3: Static path
console.log("\nTest 3: Static path");
context.req.url = "/static/css/style.css";
context.req.method = "GET";
context.req.http = {
	Host: "example.com",
	"User-Agent": "Mozilla/5.0",
};

// Execute vcl_recv
const recvResult3 = executeVCL(subroutines, "vcl_recv", context);
console.log(`vcl_recv returned: ${recvResult3}`);
console.log("Request headers:");
console.log(context.req.http);

// Test 4: Deliver
console.log("\nTest 4: Deliver");
context.resp.status = 200;
context.resp.statusText = "OK";
context.resp.http = {
	"Content-Type": "text/html",
	"Content-Length": "1024",
};

// Execute vcl_deliver
const deliverResult = executeVCL(subroutines, "vcl_deliver", context);
console.log(`vcl_deliver returned: ${deliverResult}`);
console.log("Response headers:");
console.log(context.resp.http);
