/**
 * Integration test for backend failover using restart
 */

import { createVCLContext, executeVCL, loadVCL } from "../../src/vcl";

// Load the VCL file
console.log("Loading backend failover VCL file...");
const subroutines = loadVCL(
	"./test/fixtures/restart/backend_failover_fixed.vcl",
);

// Print the loaded subroutines
console.log("Loaded subroutines:");
console.log(Object.keys(subroutines));

// Test cases for backend failover
const testCases = [
	{
		name: "API request with primary backend unhealthy",
		url: "/api/data",
		backendHealth: { primary: false, secondary: true, tertiary: true },
		expectedBackend: "secondary",
		expectedRestarts: 1,
		expectedReasons: ["initial_backend_unhealthy"],
		expectedStatus: 200,
	},
	{
		name: "Static content with backend pool",
		url: "/images/logo.png",
		backendHealth: { primary: false, secondary: true, tertiary: true },
		expectedBackend: "secondary", // Since primary is unhealthy, it should failover
		expectedRestarts: 1,
		expectedReasons: ["initial_backend_unhealthy"],
		expectedStatus: 200,
	},
	{
		name: "Backend 5xx error triggering failover",
		url: "/error-page",
		backendHealth: { primary: true, secondary: true, tertiary: true }, // All healthy
		backendStatus: 503, // But primary returns 503
		// VCL logic causes 2 restarts: vcl_fetch returns restart, then vcl_recv at restart 1
		// sees X-Backend-Status matching 5xx and returns restart again
		expectedBackend: "tertiary",
		expectedRestarts: 2,
		expectedReasons: ["backend_5xx_error"],
		expectedStatus: 200,
	},
];

// Run the tests
function runTests() {
	console.log("=== Running Backend Failover Tests ===\n");

	let passedTests = 0;
	let failedTests = 0;

	for (const testCase of testCases) {
		console.log(`Test: ${testCase.name}`);
		console.log(`Input URL: ${testCase.url}`);

		// Create a context
		const context = createVCLContext();
		context.req.url = testCase.url;
		context.req.method = "GET";
		context.req.http = {
			Host: "example.com",
			"User-Agent": "Mozilla/5.0",
		};

		// Set up backends
		context.backends = {
			primary: { name: "primary" },
			secondary: { name: "secondary" },
			tertiary: { name: "tertiary" },
			backend_pool: { name: "backend_pool" },
		};

		// Get backend health from test case or use defaults
		const backendHealth: Record<string, boolean> = (testCase as any)
			.backendHealth || {
			primary: false, // Primary is unhealthy by default
			secondary: true, // Secondary is healthy
			tertiary: true, // Tertiary is healthy
		};

		// Mock the backend health check function on context.std
		context.std.backend = {
			is_healthy: (backend: any) => {
				if (typeof backend === "string") {
					return backendHealth[backend] || false;
				}
				return false;
			},
		};

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

		// Initialize beresp for fetch
		context.beresp = {
			status: testCase.backendStatus || 200,
			statusText: "",
			http: {},
			ttl: 0,
			grace: 0,
			stale_while_revalidate: 0,
			do_esi: false,
		};

		// Process the request with support for restarts
		const processRequest = async () => {
			// Execute vcl_recv
			console.log(`Executing vcl_recv (restart ${restartCount})...`);
			const recvResult = executeVCL(subroutines, "vcl_recv", context);

			console.log(`vcl_recv returned: ${recvResult}`);
			console.log(`Selected backend: ${context.req.backend}`);

			// Only capture restart reason if it's new (not already captured)
			const currentReason = context.req.http["X-Restart-Reason"];
			if (currentReason && !restartReasons.includes(currentReason)) {
				restartReasons.push(currentReason);
				console.log(`Restart reason: ${currentReason}`);
			}

			// If we have a backend status code set, simulate a backend response
			if (
				testCase.backendStatus &&
				recvResult === "lookup" &&
				restartCount === 0
			) {
				console.log(
					`Simulating backend response with status ${testCase.backendStatus}`,
				);

				// Execute vcl_fetch
				const fetchResult = executeVCL(subroutines, "vcl_fetch", context);
				console.log(`vcl_fetch returned: ${fetchResult}`);

				if (fetchResult === "restart") {
					// Increment the restart counter
					restartCount++;
					context.req.restarts = restartCount;

					// Set the restart reason
					context.req.http["X-Restart-Reason"] = "backend_5xx_error";

					// Process the request again
					return await processRequest();
				}
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
			console.log(`Final backend: ${context.req.backend}`);
			console.log(`Restart count: ${restartCount}`);
			console.log(`Restart reasons: ${restartReasons.join(", ")}`);
			console.log(`Status code: ${finalStatus}`);

			// Verify the results
			let passed = true;

			if (context.req.backend !== testCase.expectedBackend) {
				console.log(
					`❌ Backend mismatch: expected ${testCase.expectedBackend}, got ${context.req.backend}`,
				);
				passed = false;
			}

			if (restartCount !== testCase.expectedRestarts) {
				console.log(
					`❌ Restart count mismatch: expected ${testCase.expectedRestarts}, got ${restartCount}`,
				);
				passed = false;
			}

			if (restartReasons.length !== testCase.expectedReasons.length) {
				console.log(
					`❌ Restart reasons count mismatch: expected ${testCase.expectedReasons.length}, got ${restartReasons.length}`,
				);
				passed = false;
			} else {
				for (let i = 0; i < restartReasons.length; i++) {
					if (restartReasons[i] !== testCase.expectedReasons[i]) {
						console.log(
							`❌ Restart reason mismatch at index ${i}: expected ${testCase.expectedReasons[i]}, got ${restartReasons[i]}`,
						);
						passed = false;
					}
				}
			}

			if (finalStatus !== testCase.expectedStatus) {
				console.log(
					`❌ Status code mismatch: expected ${testCase.expectedStatus}, got ${finalStatus}`,
				);
				passed = false;
			}

			if (passed) {
				console.log("✅ Test passed");
				passedTests++;
			} else {
				console.log("❌ Test failed");
				failedTests++;
			}

			console.log("\n---\n");

			// If this is the last test, print the summary
			if (passedTests + failedTests === testCases.length) {
				console.log("=== Test Summary ===");
				console.log(`Total tests: ${testCases.length}`);
				console.log(`Passed: ${passedTests}`);
				console.log(`Failed: ${failedTests}`);

				if (failedTests === 0) {
					console.log("✅ All tests passed");
					process.exit(0);
				} else {
					console.log("❌ Some tests failed");
					process.exit(1);
				}
			}
		});
	}
}

// Run the tests
runTests();
