/**
 * Integration test for authentication with token validation using restart
 */

import { createVCLContext, executeVCL, loadVCL } from "../../src/vcl";

// Load the VCL file
console.log("Loading authentication VCL file...");
const subroutines = loadVCL(
	"./test/fixtures/restart/auth_token_validation.vcl",
);

// Print the loaded subroutines
console.log("Loaded subroutines:");
console.log(Object.keys(subroutines));

// Test cases for authentication
const testCases = [
	{
		name: "Authentication from query parameter",
		url: "/protected?token=admin_token",
		cookies: {},
		expectedUrl: "/protected",
		expectedRole: "admin",
		expectedRestarts: 3,
		expectedReasons: [
			"auth_from_query",
			"token_whitespace_cleanup",
			"admin_role_assigned",
		],
		expectedStatus: 200,
	},
	{
		name: "Authentication from cookie",
		url: "/protected",
		cookies: { auth_token: "user_token" },
		expectedUrl: "/protected",
		expectedRole: "user",
		expectedRestarts: 3,
		expectedReasons: [
			"auth_from_cookie",
			"token_whitespace_cleanup",
			"user_role_assigned",
		],
		expectedStatus: 200,
	},
	{
		name: "Admin accessing admin area",
		url: "/admin/dashboard",
		cookies: { auth_token: "admin_token" },
		expectedUrl: "/admin/dashboard",
		expectedRole: "admin",
		expectedRestarts: 3,
		expectedReasons: [
			"auth_from_cookie",
			"token_whitespace_cleanup",
			"admin_role_assigned",
		],
		expectedStatus: 200,
	},
	{
		name: "User attempting to access admin area",
		url: "/admin/dashboard",
		cookies: { auth_token: "user_token" },
		expectedUrl: "/admin/dashboard",
		expectedRole: "user",
		expectedRestarts: 3,
		expectedReasons: [
			"auth_from_cookie",
			"token_whitespace_cleanup",
			"user_role_assigned",
		],
		expectedStatus: 403,
	},
	{
		name: "Invalid token",
		url: "/protected",
		cookies: { auth_token: "invalid_token" },
		expectedUrl: "/protected",
		expectedRole: "",
		expectedRestarts: 2,
		expectedReasons: ["auth_from_cookie", "token_whitespace_cleanup"],
		expectedStatus: 403,
	},
	{
		name: "No authentication",
		url: "/protected",
		cookies: {},
		expectedUrl: "/protected",
		expectedRole: "",
		expectedRestarts: 0,
		expectedReasons: [],
		expectedStatus: 401,
	},
];

// Run the tests
function runTests() {
	console.log("Running Authentication Tests\n");

	let passedTests = 0;
	let failedTests = 0;

	for (const testCase of testCases) {
		console.log(`Test: ${testCase.name}`);
		console.log(`Input URL: ${testCase.url}`);
		console.log(`Cookies: ${JSON.stringify(testCase.cookies)}`);

		// Create a context
		const context = createVCLContext();
		context.req.url = testCase.url;
		context.req.method = "GET";
		context.req.http = {
			Host: "example.com",
			"User-Agent": "Mozilla/5.0",
		};

		// Add cookies
		if (Object.keys(testCase.cookies).length > 0) {
			let cookieStr = "";
			for (const [name, value] of Object.entries(testCase.cookies)) {
				if (cookieStr) cookieStr += "; ";
				cookieStr += `${name}=${value}`;
			}
			context.req.http.Cookie = cookieStr;
		}

		// Initialize tracking variables
		let restartCount = 0;
		const restartReasons: string[] = [];
		let finalStatus = 200;

		// Initialize the obj property for error handling
		context.obj = {
			status: 0,
			response: "",
			http: {},
		};

		// Process the request with support for restarts
		const processRequest = async () => {
			// Execute vcl_recv
			console.log(`Executing vcl_recv (restart ${restartCount})...`);
			const recvResult = executeVCL(subroutines, "vcl_recv", context);

			console.log(`vcl_recv returned: ${recvResult}`);

			if (context.req.http["X-Restart-Reason"]) {
				restartReasons.push(context.req.http["X-Restart-Reason"]);
				console.log(`Restart reason: ${context.req.http["X-Restart-Reason"]}`);
			}

			// Handle error action
			if (recvResult === "error") {
				console.log(
					`Error triggered: ${context.obj.status} - ${context.obj.response}`,
				);
				finalStatus = context.obj.status;

				// Execute vcl_error
				executeVCL(subroutines, "vcl_error", context);
				return recvResult;
			}

			// Handle restart action
			if (recvResult === "restart") {
				// Increment the restart counter
				restartCount++;
				context.req.restarts = restartCount;

				// Process the request again
				return await processRequest();
			}

			return recvResult;
		};

		// Start processing the request
		processRequest().then(() => {
			console.log(`Final URL: ${context.req.url}`);
			console.log(`User role: ${context.req.http["X-User-Role"] || "none"}`);
			console.log(`Restart count: ${restartCount}`);
			console.log(`Restart reasons: ${restartReasons.join(", ")}`);
			console.log(`Status code: ${finalStatus}`);

			// Verify the results
			let passed = true;

			if (context.req.url !== testCase.expectedUrl) {
				console.log(
					`FAIL: URL mismatch: expected ${testCase.expectedUrl}, got ${context.req.url}`,
				);
				passed = false;
			}

			if ((context.req.http["X-User-Role"] || "") !== testCase.expectedRole) {
				console.log(
					`FAIL: Role mismatch: expected ${testCase.expectedRole}, got ${context.req.http["X-User-Role"] || "none"}`,
				);
				passed = false;
			}

			if (restartCount !== testCase.expectedRestarts) {
				console.log(
					`FAIL: Restart count mismatch: expected ${testCase.expectedRestarts}, got ${restartCount}`,
				);
				passed = false;
			}

			if (restartReasons.length !== testCase.expectedReasons.length) {
				console.log(
					`FAIL: Restart reasons count mismatch: expected ${testCase.expectedReasons.length}, got ${restartReasons.length}`,
				);
				passed = false;
			} else {
				for (let i = 0; i < restartReasons.length; i++) {
					if (restartReasons[i] !== testCase.expectedReasons[i]) {
						console.log(
							`FAIL: Restart reason mismatch at index ${i}: expected ${testCase.expectedReasons[i]}, got ${restartReasons[i]}`,
						);
						passed = false;
					}
				}
			}

			if (finalStatus !== testCase.expectedStatus) {
				console.log(
					`FAIL: Status code mismatch: expected ${testCase.expectedStatus}, got ${finalStatus}`,
				);
				passed = false;
			}

			if (passed) {
				console.log("PASS: Test passed");
				passedTests++;
			} else {
				console.log("FAIL: Test failed");
				failedTests++;
			}

			console.log("");

			// If this is the last test, print the summary
			if (passedTests + failedTests === testCases.length) {
				console.log("Test Summary");
				console.log(`Total tests: ${testCases.length}`);
				console.log(`Passed: ${passedTests}`);
				console.log(`Failed: ${failedTests}`);

				if (failedTests === 0) {
					console.log("PASS: All tests passed");
				} else {
					console.log("FAIL: Some tests failed");
				}
			}
		});
	}
}

// Run the tests
runTests();
