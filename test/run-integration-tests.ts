// Runs the standalone integration tests under test/integration/. Each test
// drives the VCL engine through a full restart pipeline and exits non-zero on
// failure, so we run them as separate processes and aggregate the results.

import { readdirSync } from "node:fs";
import { join } from "node:path";

const dir = join(import.meta.dir, "integration");
const tests = readdirSync(dir)
	.filter((f) => f.endsWith(".integration.ts"))
	.sort();

let passed = 0;
let failed = 0;

for (const test of tests) {
	const proc = Bun.spawnSync(["bun", "run", join(dir, test)], {
		stdout: "pipe",
		stderr: "pipe",
	});
	if (proc.exitCode === 0) {
		console.log(`PASS: ${test}`);
		passed++;
	} else {
		console.log(`FAIL: ${test}`);
		console.log(new TextDecoder().decode(proc.stdout).split("\n").slice(-15).join("\n"));
		console.log(new TextDecoder().decode(proc.stderr).split("\n").slice(-15).join("\n"));
		failed++;
	}
}

console.log(
	`\nIntegration Tests Complete\nTotal: ${tests.length}, Passed: ${passed}, Failed: ${failed}`,
);
if (failed > 0) {
	console.log("Some integration tests failed.");
	process.exit(1);
}
console.log("All integration tests passed!");
