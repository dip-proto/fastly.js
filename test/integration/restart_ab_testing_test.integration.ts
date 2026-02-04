/**
 * Integration test for A/B testing using restart
 */

import { createVCLContext, executeVCL, loadVCL } from "../../src/vcl";

// Load the VCL file
console.log("Loading A/B testing VCL file...");
const subroutines = loadVCL("./test/fixtures/restart/ab_testing.vcl");

// Print the loaded subroutines
console.log("Loaded subroutines:");
console.log(Object.keys(subroutines));

// Test cases for A/B testing
const testCases = [
	{
		name: "Homepage test with existing cookie (A)",
		url: "/",
		cookies: { AB_Test: "A" },
		randomResult: true,
		expectedVersion: "A",
		expectedBackend: "version_a",
		expectedRestarts: 1,
		expectedReasons: ["homepage_test_assignment"],
	},
	{
		name: "Homepage test with existing cookie (B)",
		url: "/",
		cookies: { AB_Test: "B" },
		randomResult: true,
		expectedVersion: "B",
		expectedBackend: "version_b",
		expectedUrl: "/homepage-b/",
		expectedRestarts: 1,
		expectedReasons: ["homepage_test_assignment"],
	},
	{
		name: "Homepage test with random assignment (A)",
		url: "/",
		cookies: {},
		randomResult: true, // 70% case
		expectedVersion: "A",
		expectedBackend: "version_a",
		expectedRestarts: 1,
		expectedReasons: ["homepage_test_assignment"],
	},
	{
		name: "Homepage test with random assignment (B)",
		url: "/",
		cookies: {},
		randomResult: false, // 30% case
		expectedVersion: "B",
		expectedBackend: "version_b",
		expectedUrl: "/homepage-b/",
		expectedRestarts: 1,
		expectedReasons: ["homepage_test_assignment"],
	},
	{
		name: "Checkout test with user ID cookie (A)",
		url: "/checkout",
		cookies: { user_id: "user123" },
		// strstr returns substring, not index. For "af123":
		// strstr("af123", "a") = "af123", strstr("af123", "f") = "f123"
		// "af123" < "f123" is true (lexicographically), so result is A
		userHashResult: "af123",
		expectedVersion: "A",
		expectedBackend: "version_a",
		expectedRestarts: 1,
		expectedReasons: ["checkout_test_assignment"],
	},
	{
		name: "Checkout test with user ID cookie (B)",
		url: "/checkout",
		cookies: { user_id: "user456" },
		// For hash with no 'f': strstr("abc", "a") = "abc", strstr("abc", "f") = ""
		// "abc" < "" is false (non-empty string > empty string), so result is B
		userHashResult: "abc123",
		expectedVersion: "B",
		expectedBackend: "version_b",
		expectedUrl: "/checkout?version=B",
		expectedRestarts: 1,
		expectedReasons: ["checkout_test_assignment"],
	},
];

// Run the tests
async function runTests() {
	console.log("Running A/B Testing Tests\n");

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

		// Mock the random function on context.std
		(context.std!.random! as any).bool = (numerator: number, denominator: number) => {
			console.log(`Mock randombool called with ${numerator}/${denominator}`);
			return testCase.randomResult;
		};

		// Mock the hash function for user ID based assignment on context.std
		const originalHashSha1 = context.std!.digest!.hash_sha1;
		context.std!.digest!.hash_sha1 = (input: string) => {
			console.log(`Mock hash_sha1 called with ${input}`);
			// Return the test-specific hash result if available
			if (testCase.userHashResult) {
				return testCase.userHashResult;
			}
			return originalHashSha1(input);
		};

		// Set up backends
		context.backends = {
			version_a: { name: "version_a" } as any,
			version_b: { name: "version_b" } as any,
		};

		// Add cookies
		if (Object.keys(testCase.cookies || {}).length > 0) {
			let cookieStr = "";
			for (const [name, value] of Object.entries(testCase.cookies || {})) {
				if (cookieStr) cookieStr += "; ";
				cookieStr += `${name}=${value}`;
			}
			context.req.http.Cookie = cookieStr;
		}

		// Initialize tracking variables
		let restartCount = 0;
		const restartReasons: string[] = [];

		// Initialize tables with correct format for table.lookup
		context.tables = {
			feature_flags: {
				name: "feature_flags",
				entries: {
					homepage_redesign: "active",
					new_checkout: "active",
					personalization: "inactive",
				},
			},
		};

		// Process the request with support for restarts
		const processRequest = async (): Promise<string> => {
			// Execute vcl_recv
			console.log(`Executing vcl_recv (restart ${restartCount})...`);
			const recvResult = executeVCL(subroutines, "vcl_recv", context);

			console.log(`vcl_recv returned: ${recvResult}`);
			console.log(`Current URL: ${context.req.url}`);
			console.log(`Selected backend: ${context.req.backend}`);
			console.log(`AB Test: ${context.req.http["X-AB-Test"]}`);
			console.log(`Selected Version: ${context.req.http["X-Selected-Version"]}`);

			// Capture restart reason only if it's new (not already captured)
			const currentReason = context.req.http["X-Restart-Reason"];
			if (currentReason && !restartReasons.includes(currentReason)) {
				restartReasons.push(currentReason);
				console.log(`Restart reason: ${currentReason}`);
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
		await processRequest();

		console.log(`Final URL: ${context.req.url}`);
		console.log(`Final backend: ${context.req.backend}`);
		console.log(`AB Test: ${context.req.http["X-AB-Test"]}`);
		console.log(`Selected Version: ${context.req.http["X-Selected-Version"]}`);
		console.log(`Restart count: ${restartCount}`);
		console.log(`Restart reasons: ${restartReasons.join(", ")}`);

		// Verify the results
		let passed = true;

		if (testCase.expectedUrl && context.req.url !== testCase.expectedUrl) {
			console.log(`FAIL: URL mismatch: expected ${testCase.expectedUrl}, got ${context.req.url}`);
			passed = false;
		}

		if (context.req.backend !== testCase.expectedBackend) {
			console.log(
				`FAIL: Backend mismatch: expected ${testCase.expectedBackend}, got ${context.req.backend}`,
			);
			passed = false;
		}

		if (context.req.http["X-Selected-Version"] !== testCase.expectedVersion) {
			console.log(
				`FAIL: Version mismatch: expected ${testCase.expectedVersion}, got ${context.req.http["X-Selected-Version"]}`,
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

		if (passed) {
			console.log("PASS: Test passed");
			passedTests++;
		} else {
			console.log("FAIL: Test failed");
			failedTests++;
		}

		console.log("");
	}

	// Print summary
	console.log("Test Summary");
	console.log(`Total tests: ${testCases.length}`);
	console.log(`Passed: ${passedTests}`);
	console.log(`Failed: ${failedTests}`);

	if (failedTests === 0) {
		console.log("PASS: All tests passed");
		process.exit(0);
	} else {
		console.log("FAIL: Some tests failed");
		process.exit(1);
	}
}

// Run the tests
runTests();
