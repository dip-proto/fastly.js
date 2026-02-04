import { spawn } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

const testDir = path.join(__dirname, "root-tests");
const testFiles = fs
	.readdirSync(testDir)
	.filter((file) => file.endsWith(".ts"))
	.map((file) => path.join(testDir, file));

console.log("Running Root Tests\n");
console.log(`Found ${testFiles.length} test files to run\n`);

function runTestFile(file: string): Promise<boolean> {
	return new Promise((resolve) => {
		console.log(`Running test: ${path.basename(file)}`);
		const proc = spawn("bun", ["run", file], { stdio: "inherit" });
		proc.on("close", (code) => {
			const success = code === 0;
			console.log(`Test ${path.basename(file)} ${success ? "passed" : "failed"}\n`);
			resolve(success);
		});
	});
}

async function runAllTests(): Promise<void> {
	let passed = 0;
	let failed = 0;

	for (const file of testFiles) {
		if (await runTestFile(file)) {
			passed++;
		} else {
			failed++;
		}
	}

	console.log("Root Tests Complete");
	console.log(`Total: ${testFiles.length}, Passed: ${passed}, Failed: ${failed}`);

	if (failed > 0) {
		console.log("Some root tests failed.");
		process.exit(1);
	}
	console.log("All root tests passed!");
}

runAllTests().catch((error) => {
	console.error("Error running tests:", error);
	process.exit(1);
});
