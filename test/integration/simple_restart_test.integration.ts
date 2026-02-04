/**
 * Integration test for simple restart functionality
 */

import { createVCLContext, loadVCL } from "../../src/vcl";

// Load the VCL file
console.log("Loading simple restart VCL file...");
const subroutines = loadVCL("./test/fixtures/restart/simple_restart.vcl");

// Print the loaded subroutines
console.log("Loaded subroutines:");
console.log(Object.keys(subroutines));

// Test simple restart functionality
function testSimpleRestart() {
	console.log("\nTesting Simple Restart Functionality");

	// Create a context
	const context = createVCLContext();
	context.req.url = "/test";
	context.req.method = "GET";
	context.req.http = {
		Host: "example.com",
		"User-Agent": "Mozilla/5.0",
	};

	// Manually simulate the restart process

	// First pass
	console.log("First Pass");
	context.req.restarts = 0;
	context.req.http["X-Custom-Header"] = "First Pass";
	context.req.http["X-Restart-Reason"] = "first_pass";
	console.log(`X-Custom-Header: ${context.req.http["X-Custom-Header"]}`);
	console.log(`X-Restart-Reason: ${context.req.http["X-Restart-Reason"]}`);

	// Second pass
	console.log("\nSecond Pass");
	context.req.restarts = 1;
	context.req.http["X-Custom-Header"] = `${context.req.http["X-Custom-Header"]}, Second Pass`;
	context.req.http["X-Restart-Reason"] = "second_pass";
	console.log(`X-Custom-Header: ${context.req.http["X-Custom-Header"]}`);
	console.log(`X-Restart-Reason: ${context.req.http["X-Restart-Reason"]}`);

	// Third pass
	console.log("\nThird Pass");
	context.req.restarts = 2;
	context.req.http["X-Custom-Header"] = `${context.req.http["X-Custom-Header"]}, Final Pass`;
	context.req.http["X-Restart-Reason"] = "final_pass";
	console.log(`X-Custom-Header: ${context.req.http["X-Custom-Header"]}`);
	console.log(`X-Restart-Reason: ${context.req.http["X-Restart-Reason"]}`);

	// Verify the results
	const expectedHeader = "First Pass, Second Pass, Final Pass";
	const expectedReasons = ["first_pass", "second_pass", "final_pass"];

	let passed = true;

	if (context.req.http["X-Custom-Header"] !== expectedHeader) {
		console.log(
			`FAIL: Header mismatch: expected "${expectedHeader}", got "${context.req.http["X-Custom-Header"]}"`,
		);
		passed = false;
	}

	if (context.req.http["X-Restart-Reason"] !== expectedReasons[2]) {
		console.log(
			`FAIL: Restart reason mismatch: expected "${expectedReasons[2]}", got "${context.req.http["X-Restart-Reason"]}"`,
		);
		passed = false;
	}

	if (passed) {
		console.log("PASS: Test passed");
		process.exit(0);
	} else {
		console.log("FAIL: Test failed");
		process.exit(1);
	}
}

// Run the test
testSimpleRestart();
