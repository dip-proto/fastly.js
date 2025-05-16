/**
 * Test script for VCL error handling and synthetic responses
 */

import { createVCLContext, executeVCL } from "../../src/vcl";

// Create a VCL context
const context = createVCLContext();

// Create a simple VCL subroutine for testing
const testSubroutines = {
	vcl_error: (ctx: any) => {
		console.log(`Executing vcl_error with status: ${ctx.obj.status}`);

		// Custom error pages based on status code
		if (ctx.obj.status === 403) {
			ctx.std.synthetic(`
<!DOCTYPE html>
<html>
<head>
    <title>Access Denied</title>
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
    </style>
</head>
<body>
    <div class="container">
        <h1>Access Denied</h1>
        <div class="icon">🚫</div>
        <p>You do not have permission to access this resource.</p>
        <p>Please contact the administrator if you believe this is an error.</p>
    </div>
</body>
</html>
      `);
			return "deliver";
		}

		// 404 Not Found
		if (ctx.obj.status === 404) {
			ctx.std.synthetic(`
<!DOCTYPE html>
<html>
<head>
    <title>Page Not Found</title>
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
            color: #5bc0de;
        }
        .icon {
            font-size: 72px;
            margin: 20px 0;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Page Not Found</h1>
        <div class="icon">🔍</div>
        <p>The page you are looking for does not exist or has been moved.</p>
        <p><a href="/">Go to homepage</a></p>
    </div>
</body>
</html>
      `);
			return "deliver";
		}

		// Default error page for other status codes
		ctx.std.synthetic(`
<!DOCTYPE html>
<html>
<head>
    <title>Error ${ctx.obj.status}</title>
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
            color: #f0ad4e;
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
        <h1>Error ${ctx.obj.status}</h1>
        <div class="icon">⚠️</div>
        <p>${ctx.obj.response}</p>
        <div class="error-details">
            <p><strong>Status:</strong> ${ctx.obj.status}</p>
            <p><strong>URL:</strong> ${ctx.req.url}</p>
        </div>
    </div>
</body>
</html>
    `);
		return "deliver";
	},
};

console.log("Error Handling and Synthetic Responses Test\n");

// Test 1: Error function with status code and message
console.log("Test 1: Error function with status code and message");
context.req.url = "/forbidden";
context.std.error(403, "Access Denied");
console.log(`Error status: ${context.obj.status}`);
console.log(`Error message: ${context.obj.response}`);
console.log(`Fastly error: ${context.fastly.error}`);
console.log(`Fastly state: ${context.fastly.state}`);

// Execute vcl_error
const errorAction1 = executeVCL(testSubroutines, "vcl_error", context);
console.log(`vcl_error action: ${errorAction1}`);
console.log(
	`Synthetic response length: ${context.obj.response.length} characters`,
);
console.log(`Content-Type: ${context.obj.http["content-type"]}`);

// Test 2: Error function with only status code
console.log("\nTest 2: Error function with only status code");
context.req.url = "/not-found";
context.std.error(404);
console.log(`Error status: ${context.obj.status}`);
console.log(`Error message: ${context.obj.response}`);

// Execute vcl_error
const errorAction2 = executeVCL(testSubroutines, "vcl_error", context);
console.log(`vcl_error action: ${errorAction2}`);
console.log(
	`Synthetic response length: ${context.obj.response.length} characters`,
);

// Test 3: Error function with server error
console.log("\nTest 3: Error function with server error");
context.req.url = "/server-error";
context.std.error(500, "Internal Server Error");
console.log(`Error status: ${context.obj.status}`);
console.log(`Error message: ${context.obj.response}`);

// Execute vcl_error
const errorAction3 = executeVCL(testSubroutines, "vcl_error", context);
console.log(`vcl_error action: ${errorAction3}`);
console.log(
	`Synthetic response length: ${context.obj.response.length} characters`,
);

// Test 4: Synthetic function
console.log("\nTest 4: Synthetic function");
context.obj.status = 200;
context.obj.http["content-type"] = "text/html; charset=utf-8";
context.std.synthetic("<h1>Hello, World!</h1>");
console.log(`Synthetic response: ${context.obj.response}`);
console.log(`Content-Type: ${context.obj.http["content-type"]}`);

console.log("\nAll error handling tests completed!");
