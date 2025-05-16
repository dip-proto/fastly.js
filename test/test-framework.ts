import * as fs from "node:fs";
import * as path from "node:path";
import { createVCLContext, executeVCL, loadVCL } from "../src/vcl";
import type { VCLContext, VCLSubroutines } from "../src/vcl-compiler";

interface TestResult {
	name: string;
	success: boolean;
	message?: string;
	error?: Error;
	duration: number;
}

interface TestSuite {
	name: string;
	tests: Test[];
	setup?: () => Promise<void>;
	teardown?: () => Promise<void>;
}

interface Test {
	name: string;
	vclFile?: string;
	vclSnippet?: string;
	run: (context: VCLContext, subroutines: VCLSubroutines) => Promise<void>;
	assertions: Array<
		(context: VCLContext) => boolean | { success: boolean; message: string }
	>;
}

export async function runTestSuite(suite: TestSuite): Promise<TestResult[]> {
	console.log(`\nRunning Test Suite: ${suite.name}\n`);

	const results: TestResult[] = [];

	if (suite.setup) {
		try {
			await suite.setup();
		} catch (error) {
			console.error(`Error in setup: ${error.message}`);
			return [
				{
					name: "Setup",
					success: false,
					message: `Setup failed: ${error.message}`,
					error,
					duration: 0,
				},
			];
		}
	}

	for (const test of suite.tests) {
		const result = await runTest(test);
		results.push(result);

		if (result.success) {
			console.log(`PASS: ${result.name} (${result.duration}ms)`);
		} else {
			console.log(`FAIL: ${result.name} (${result.duration}ms)`);
			console.log(`   Error: ${result.message}`);
		}
	}

	if (suite.teardown) {
		try {
			await suite.teardown();
		} catch (error) {
			console.error(`Error in teardown: ${error.message}`);
			results.push({
				name: "Teardown",
				success: false,
				message: `Teardown failed: ${error.message}`,
				error,
				duration: 0,
			});
		}
	}

	const successCount = results.filter((r) => r.success).length;
	console.log(`\nTest Suite Summary: ${suite.name}`);
	console.log(
		`Total: ${results.length}, Passed: ${successCount}, Failed: ${results.length - successCount}`,
	);

	return results;
}

async function runTest(test: Test): Promise<TestResult> {
	const startTime = Date.now();

	try {
		const context = createVCLContext();
		let subroutines: VCLSubroutines = {};

		if (test.vclFile) {
			const vclPath = path.join(process.cwd(), test.vclFile);
			console.log(`Loading VCL file: ${vclPath}`);
			subroutines = loadVCL(vclPath);
		} else if (test.vclSnippet) {
			const tempFile = `./test/temp_${Date.now()}.vcl`;
			try {
				fs.writeFileSync(tempFile, test.vclSnippet);
				subroutines = loadVCL(tempFile);
			} finally {
				if (fs.existsSync(tempFile)) {
					fs.unlinkSync(tempFile);
				}
			}
		}

		await test.run(context, subroutines);

		for (const assertion of test.assertions) {
			const result = assertion(context);
			const success = typeof result === "boolean" ? result : result.success;
			const message =
				typeof result === "boolean" ? "Assertion failed" : result.message;

			if (!success) {
				return {
					name: test.name,
					success: false,
					message,
					duration: Date.now() - startTime,
				};
			}
		}

		return {
			name: test.name,
			success: true,
			duration: Date.now() - startTime,
		};
	} catch (error) {
		return {
			name: test.name,
			success: false,
			message: error.message,
			error,
			duration: Date.now() - startTime,
		};
	}
}

export function createMockRequest(
	url: string = "/",
	method: string = "GET",
	headers: Record<string, string> = {},
): VCLContext {
	const context = createVCLContext();
	context.req.url = url;
	context.req.method = method;
	context.req.http = { ...headers };
	return context;
}

const DEFAULT_SUBROUTINE_RETURNS: Record<string, string> = {
	vcl_recv: "lookup",
	vcl_deliver: "deliver",
	vcl_fetch: "deliver",
	vcl_error: "deliver",
};

export function executeSubroutine(
	context: VCLContext,
	subroutines: VCLSubroutines,
	subroutineName: string,
): string {
	if (!subroutines[subroutineName]) {
		console.log(
			`Subroutine ${subroutineName} not found, using default behavior`,
		);
		const defaultReturn = DEFAULT_SUBROUTINE_RETURNS[subroutineName];
		if (defaultReturn) {
			subroutines[subroutineName] = () => defaultReturn;
		}
	}
	return executeVCL(subroutines, subroutineName, context);
}

export function assert(
	condition: boolean,
	message: string,
): { success: boolean; message: string } {
	return { success: condition, message: condition ? "Success" : message };
}

function cleanupTempFiles(): void {
	try {
		const testDir = path.join(process.cwd(), "test");
		if (fs.existsSync(testDir)) {
			const files = fs.readdirSync(testDir);
			for (const file of files) {
				if (file.startsWith("temp_") && file.endsWith(".vcl")) {
					const filePath = path.join(testDir, file);
					console.log(`Cleaning up temporary file: ${filePath}`);
					fs.unlinkSync(filePath);
				}
			}
		}
	} catch (error) {
		console.error(`Error cleaning up temporary files: ${error.message}`);
	}
}

export async function runAllTests(suites: TestSuite[]): Promise<void> {
	console.log("Running All Test Suites\n");
	cleanupTempFiles();

	let totalTests = 0;
	let passedTests = 0;

	try {
		for (const suite of suites) {
			const results = await runTestSuite(suite);
			totalTests += results.length;
			passedTests += results.filter((r) => r.success).length;
		}
	} finally {
		cleanupTempFiles();
	}

	console.log("\nAll Tests Complete");
	console.log(
		`Total: ${totalTests}, Passed: ${passedTests}, Failed: ${totalTests - passedTests}`,
	);

	if (totalTests === passedTests) {
		console.log("All tests passed!");
	} else {
		console.log("Some tests failed.");
		process.exit(1);
	}
}
