/**
 * VCL Test Suite
 *
 * This script tests the VCL implementation with various VCL code snippets.
 */

import { createVCLContext, executeVCL } from "../../src/vcl";
import type { VCLContext, VCLSubroutines } from "../../src/vcl-compiler";

// Create a test context
function createTestContext(): VCLContext {
	const context = createVCLContext();
	context.req.url = "/test";
	context.req.method = "GET";
	context.req.http = {
		Host: "example.com",
		"User-Agent": "Mozilla/5.0",
	};
	return context;
}

// Test 1: Set a header
function testSetHeader() {
	console.log("\nTest 1: Set a header");

	const context = createTestContext();

	// Create a simple VCL subroutine
	const subroutines: VCLSubroutines = {
		vcl_recv: (ctx: VCLContext) => {
			// Set a header
			ctx.req.http["X-Test"] = "Hello, World!";
			return "lookup";
		},
	};

	// Execute the subroutine
	const result = executeVCL(subroutines, "vcl_recv", context);

	// Check the result
	console.log(`Result: ${result}`);
	console.log("Headers:");
	console.log(context.req.http);

	// Verify the header was set
	if (context.req.http["X-Test"] === "Hello, World!") {
		console.log("PASS");
	} else {
		console.log("FAIL");
	}
}

// Test 2: Conditional logic
function testConditionalLogic() {
	console.log("\nTest 2: Conditional logic");

	// Test API path
	const apiContext = createTestContext();
	apiContext.req.url = "/api/users";

	// Test static path
	const staticContext = createTestContext();
	staticContext.req.url = "/static/css/style.css";

	// Test default path
	const defaultContext = createTestContext();
	defaultContext.req.url = "/home";

	// Create a VCL subroutine with conditional logic
	const subroutines: VCLSubroutines = {
		vcl_recv: (ctx: VCLContext) => {
			if (ctx.req.url.startsWith("/api/")) {
				ctx.req.http["X-API"] = "true";
				return "pass";
			} else if (ctx.req.url.match(/\.(jpg|jpeg|png|gif|css|js)$/)) {
				ctx.req.http["X-Static"] = "true";
				return "lookup";
			} else {
				ctx.req.http["X-Default"] = "true";
				return "lookup";
			}
		},
	};

	// Execute the subroutine for API path
	console.log("\nAPI Path:");
	const apiResult = executeVCL(subroutines, "vcl_recv", apiContext);
	console.log(`Result: ${apiResult}`);
	console.log("Headers:");
	console.log(apiContext.req.http);

	// Execute the subroutine for static path
	console.log("\nStatic Path:");
	const staticResult = executeVCL(subroutines, "vcl_recv", staticContext);
	console.log(`Result: ${staticResult}`);
	console.log("Headers:");
	console.log(staticContext.req.http);

	// Execute the subroutine for default path
	console.log("\nDefault Path:");
	const defaultResult = executeVCL(subroutines, "vcl_recv", defaultContext);
	console.log(`Result: ${defaultResult}`);
	console.log("Headers:");
	console.log(defaultContext.req.http);

	// Verify the results
	let passed = true;

	if (apiResult !== "pass" || !apiContext.req.http["X-API"]) {
		console.log("FAIL: API path test");
		passed = false;
	}

	if (staticResult !== "lookup" || !staticContext.req.http["X-Static"]) {
		console.log("FAIL: Static path test");
		passed = false;
	}

	if (defaultResult !== "lookup" || !defaultContext.req.http["X-Default"]) {
		console.log("FAIL: Default path test");
		passed = false;
	}

	if (passed) {
		console.log("PASS: All conditional logic tests");
	}
}

// Test 3: Regex matching
function testRegexMatching() {
	console.log("\nTest 3: Regex matching");

	const context = createTestContext();
	context.req.url = "/users/123";

	// Create a VCL subroutine with regex matching
	const subroutines: VCLSubroutines = {
		vcl_recv: (ctx: VCLContext) => {
			if (ctx.req.url.match(/^\/users\/(\d+)$/)) {
				const matches = ctx.req.url.match(/^\/users\/(\d+)$/);
				if (matches && matches.length > 1) {
					ctx.req.http["X-User-ID"] = matches[1];
				}
			}
			return "lookup";
		},
	};

	// Execute the subroutine
	const result = executeVCL(subroutines, "vcl_recv", context);

	// Check the result
	console.log(`Result: ${result}`);
	console.log("Headers:");
	console.log(context.req.http);

	// Verify the user ID was extracted
	if (context.req.http["X-User-ID"] === "123") {
		console.log("PASS");
	} else {
		console.log("FAIL");
	}
}

// Run all tests
function runTests() {
	console.log("Running VCL Test Suite");

	testSetHeader();
	testConditionalLogic();
	testRegexMatching();

	console.log("\nAll Tests Complete");
}

// Run the tests
runTests();
