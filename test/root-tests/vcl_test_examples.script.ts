/**
 * VCL Test Examples
 *
 * This script provides examples of how to use the VCL implementation.
 */

import { createVCLContext, executeVCL } from "../../src/vcl";
import type { VCLContext, VCLSubroutines } from "../../src/vcl-compiler";

// Example 1: Simple VCL
function example1() {
	console.log("\nExample 1: Simple VCL");

	// Create a context
	const context = createVCLContext();
	context.req.url = "/test";
	context.req.method = "GET";
	context.req.http = {
		Host: "example.com",
		"User-Agent": "Mozilla/5.0",
	};

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
}

// Example 2: Conditional Logic
function example2() {
	console.log("\nExample 2: Conditional Logic");

	// Create a context
	const context = createVCLContext();
	context.req.url = "/api/users";
	context.req.method = "GET";
	context.req.http = {
		Host: "example.com",
		"User-Agent": "Mozilla/5.0",
	};

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

	// Execute the subroutine
	const result = executeVCL(subroutines, "vcl_recv", context);

	// Check the result
	console.log(`Result: ${result}`);
	console.log("Headers:");
	console.log(context.req.http);
}

// Example 3: Regex Matching
function example3() {
	console.log("\nExample 3: Regex Matching");

	// Create a context
	const context = createVCLContext();
	context.req.url = "/users/123";
	context.req.method = "GET";
	context.req.http = {
		Host: "example.com",
		"User-Agent": "Mozilla/5.0",
	};

	// Create a VCL subroutine with regex matching
	const subroutines: VCLSubroutines = {
		vcl_recv: (ctx: VCLContext) => {
			const matches = ctx.req.url.match(/^\/users\/(\d+)$/);
			if (matches && matches.length > 1) {
				ctx.req.http["X-User-ID"] = matches[1]!;
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
}

// Example 4: Error Handling
function example4() {
	console.log("\nExample 4: Error Handling");

	// Create a context
	const context = createVCLContext();
	context.req.url = "/forbidden";
	context.req.method = "GET";
	context.req.http = {
		Host: "example.com",
		"User-Agent": "Mozilla/5.0",
	};

	// Create a VCL subroutine with error handling
	const subroutines: VCLSubroutines = {
		vcl_recv: (ctx: VCLContext) => {
			if (ctx.req.url === "/forbidden") {
				ctx.std!.error(403, "Forbidden");
				return "error";
			}
			return "lookup";
		},
		vcl_error: (ctx: VCLContext) => {
			ctx.obj.http["Content-Type"] = "text/html; charset=utf-8";
			ctx.obj.response = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Error ${ctx.obj.status}</title>
        </head>
        <body>
          <h1>Error ${ctx.obj.status}</h1>
          <p>${ctx.obj.response}</p>
        </body>
        </html>
      `;
			return "deliver";
		},
	};

	// Execute the subroutine
	const result = executeVCL(subroutines, "vcl_recv", context);

	// Check the result
	console.log(`Result: ${result}`);

	// If the result is 'error', execute the error subroutine
	if (result === "error") {
		const errorResult = executeVCL(subroutines, "vcl_error", context);
		console.log(`Error result: ${errorResult}`);
		console.log(`Error status: ${context.obj.status}`);
		console.log(`Error response: ${context.obj.response.substring(0, 100)}...`);
	}
}

// Run all examples
function runExamples() {
	console.log("Running VCL Examples");

	example1();
	example2();
	example3();
	example4();

	console.log("\nAll Examples Complete");
}

// Run the examples
runExamples();
