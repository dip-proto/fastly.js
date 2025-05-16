/**
 * Test script for backend error handling
 */

import { createVCLContext, executeVCL } from "../../src/vcl";

// Create a VCL context
const context = createVCLContext();

// Create a simple VCL subroutine for testing
const testSubroutines = {
	vcl_error: (ctx: any) => {
		console.log(`Executing vcl_error with status: ${ctx.obj.status}`);

		// Custom error page for backend failures
		if (ctx.obj.status === 503) {
			ctx.std.synthetic(`
<!DOCTYPE html>
<html>
<head>
    <title>Service Unavailable</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f8f8f8;
            color: #333;
        }
        .container {
            max-width: 800px;
            margin: 0 auto;
            background-color: white;
            border-radius: 5px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
            padding: 20px;
            text-align: center;
        }
        h1 {
            color: #d9534f;
        }
        .icon {
            font-size: 72px;
            margin: 20px 0;
        }
        .error-details {
            background-color: #f5f5f5;
            padding: 10px;
            border-radius: 3px;
            margin-top: 20px;
            text-align: left;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Service Unavailable</h1>
        <div class="icon">🔧</div>
        <p>The service is temporarily unavailable. Please try again later.</p>
        <div class="error-details">
            <p><strong>Error:</strong> ${ctx.obj.response}</p>
            <p><strong>Request:</strong> ${ctx.req.method} ${ctx.req.url}</p>
        </div>
    </div>
</body>
</html>
      `);
			return "deliver";
		}

		return "deliver";
	},
};

console.log("Backend Error Handling Test\n");

// Set up test backends
console.log("Setting up test backends");
context.std.backend.add("main", "neverssl.com", 80, false);
context.std.backend.add("api", "httpbin.org", 80, false);
context.std.backend.add("static", "example.com", 80, false);

// Create directors
context.std.director.add("main_director", "random");
context.std.director.add("fallback_director", "fallback");

// Add backends to directors
context.std.director.add_backend("main_director", "main", 2);
context.std.director.add_backend("main_director", "static", 1);
context.std.director.add_backend("fallback_director", "main", 1);
context.std.director.add_backend("fallback_director", "api", 1);

console.log(`Backends: ${Object.keys(context.backends).join(", ")}`);
console.log(`Directors: ${Object.keys(context.directors).join(", ")}`);

// Test 1: Non-existent backend
console.log("\nTest 1: Non-existent backend");
context.req.url = "/non-existent-backend";
context.req.method = "GET";

try {
	// Try to set a non-existent backend
	if (!context.std.backend.set_current("non_existent_backend")) {
		throw new Error(
			`Backend 'non_existent_backend' not found or not available`,
		);
	}
} catch (error) {
	console.log(`Error: ${error.message}`);
	context.std.error(503, `Service Unavailable: ${error.message}`);

	// Execute vcl_error
	const errorAction = executeVCL(testSubroutines, "vcl_error", context);
	console.log(`vcl_error action: ${errorAction}`);
	console.log(`Response status: ${context.obj.status}`);
	console.log(
		`Synthetic response length: ${context.obj.response.length} characters`,
	);
}

// Test 2: Unhealthy backend
console.log("\nTest 2: Unhealthy backend");
context.req.url = "/unhealthy-backend";
context.req.method = "GET";

// Mark the API backend as unhealthy
context.backends.api.is_healthy = false;

try {
	// Try to set an unhealthy backend
	if (!context.std.backend.set_current("api")) {
		console.log("Backend set successfully, checking health...");

		// Check if the backend is healthy
		if (!context.std.backend.is_healthy("api")) {
			throw new Error(`Backend 'api' is not healthy`);
		}
	} else {
		throw new Error(`Backend 'api' not found or not available`);
	}
} catch (error) {
	console.log(`Error: ${error.message}`);
	context.std.error(503, `Service Unavailable: ${error.message}`);

	// Execute vcl_error
	const errorAction = executeVCL(testSubroutines, "vcl_error", context);
	console.log(`vcl_error action: ${errorAction}`);
	console.log(`Response status: ${context.obj.status}`);
	console.log(
		`Synthetic response length: ${context.obj.response.length} characters`,
	);
}

// Test 3: Fallback director
console.log("\nTest 3: Fallback director");
context.req.url = "/fallback-test";
context.req.method = "GET";

// Mark the main backend as unhealthy
context.backends.main.is_healthy = false;

try {
	// Try to use the main director
	const selectedBackend = context.std.director.select_backend("main_director");

	if (selectedBackend) {
		console.log(`Selected backend: ${selectedBackend.name}`);
		context.req.backend = selectedBackend.name;
		context.current_backend = selectedBackend;
	} else {
		console.log(
			"No healthy backend in main_director, trying fallback_director",
		);

		// Try fallback director
		const fallbackBackend =
			context.std.director.select_backend("fallback_director");

		if (fallbackBackend) {
			console.log(`Selected fallback backend: ${fallbackBackend.name}`);
			context.req.backend = fallbackBackend.name;
			context.current_backend = fallbackBackend;
		} else {
			throw new Error("No available backends");
		}
	}

	// Check if the selected backend is healthy
	if (
		context.current_backend &&
		!context.std.backend.is_healthy(context.current_backend.name)
	) {
		throw new Error(`Backend '${context.current_backend.name}' is not healthy`);
	}

	console.log(`Using backend: ${context.current_backend.name}`);
} catch (error) {
	console.log(`Error: ${error.message}`);
	context.std.error(503, `Service Unavailable: ${error.message}`);

	// Execute vcl_error
	const errorAction = executeVCL(testSubroutines, "vcl_error", context);
	console.log(`vcl_error action: ${errorAction}`);
	console.log(`Response status: ${context.obj.status}`);
	console.log(
		`Synthetic response length: ${context.obj.response.length} characters`,
	);
}

console.log("\nAll backend error handling tests completed!");
