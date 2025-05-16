/**
 * Integration test for URL normalization using restart
 */

import { createVCLContext, executeVCL, loadVCL } from "../../src/vcl";

// Load the VCL file
console.log("Loading URL normalization VCL file...");
const subroutines = loadVCL(
	"./test/fixtures/restart/url_normalization_fixed51.vcl",
);

// Print the loaded subroutines
console.log("Loaded subroutines:");
console.log(Object.keys(subroutines));

// Test cases for URL normalization
const testCases = [
	{
		name: "Double slash removal",
		url: "/path//to/resource",
		expectedUrl: "/path/to/resource/index.html",
		// 2 restarts: double slash removal triggers restart, trailing slash triggers restart
		// index.html is added without restart
		expectedRestarts: 2,
		expectedReasons: [
			"double_slash_removal",
			"add_trailing_slash",
			"add_index_html",
		],
	},
	{
		name: "Add trailing slash and index.html",
		url: "/path/to/directory",
		expectedUrl: "/path/to/directory/index.html",
		// 1 restart: trailing slash triggers restart, index.html added without restart
		expectedRestarts: 1,
		expectedReasons: ["add_trailing_slash", "add_index_html"],
	},
	{
		name: "Already normalized URL",
		url: "/path/to/file.jpg",
		expectedUrl: "/path/to/file.jpg",
		expectedRestarts: 0,
		expectedReasons: [],
	},
];

// Run the tests
function runTests() {
	console.log("=== Running URL Normalization Tests ===\n");

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

		// Initialize tracking variables
		let restartCount = 0;
		const restartReasons: string[] = [];
		const maxRestarts = 10; // Set a maximum restart limit to prevent infinite loops

		// Process the request with support for restarts
		const processRequest = async () => {
			// Check if we've exceeded the maximum number of restarts
			if (restartCount > maxRestarts) {
				console.log(
					`⚠️ Exceeded maximum number of restarts (${maxRestarts}). Aborting.`,
				);
				return "error";
			}

			// Execute vcl_recv
			console.log(`Executing vcl_recv (restart ${restartCount})...`);
			const recvResult = executeVCL(subroutines, "vcl_recv", context);

			console.log(`vcl_recv returned: ${recvResult}`);
			console.log(`Current URL: ${context.req.url}`);

			if (context.req.http["X-Restart-Reason"]) {
				restartReasons.push(context.req.http["X-Restart-Reason"]);
				console.log(`Restart reason: ${context.req.http["X-Restart-Reason"]}`);
			}

			// Handle restart action
			if (recvResult === "restart") {
				// Increment the restart counter
				restartCount++;
				context.req.restarts = restartCount;

				// Update the URL from the X-Current-URL header if it exists
				if (context.req.http["X-Current-URL"]) {
					context.req.url = context.req.http["X-Current-URL"];
				}

				// Process the request again
				return await processRequest();
			}

			return recvResult;
		};

		// Start processing the request
		processRequest().then((result) => {
			console.log(`Final URL: ${context.req.url}`);
			console.log(`Restart count: ${restartCount}`);
			console.log(`Restart reasons: ${restartReasons.join(", ")}`);

			// Verify the results
			let passed = true;

			// Check if we exceeded the maximum number of restarts
			if (result === "error") {
				console.log(
					`❌ Test failed due to exceeding maximum number of restarts`,
				);
				passed = false;
			} else {
				if (context.req.url !== testCase.expectedUrl) {
					console.log(
						`❌ URL mismatch: expected ${testCase.expectedUrl}, got ${context.req.url}`,
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
