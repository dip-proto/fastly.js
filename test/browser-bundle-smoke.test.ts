// Browser bundle gate for the browser entry points (src/browser.ts and the
// playground web/main.ts).
//
// The engine in vcl.ts is platform-pure: node:crypto and node:os live only in
// platform-node.ts, which the browser entries do not import. So every browser
// bundle must contain NO node: built-ins and produce NO build warnings. This
// test enforces both strictly for each entry.

const ENTRIES = ["./src/browser.ts", "./web/main.ts"];

// node:buffer is a browser-safe data structure that Bun fully polyfills (the
// engine still encodes hex/base64 via Buffer). The Node-only built-ins that have
// no browser equivalent — node:fs/os/crypto/path/etc. — must never appear.
const ALLOWED = new Set(["node:buffer"]);

let failed = false;

for (const entry of ENTRIES) {
	const build = await Bun.build({ entrypoints: [entry], target: "browser" });

	if (!build.success) {
		console.error(`FAIL: ${entry} did not build`);
		console.error(build.logs.map((l) => String(l)).join("\n"));
		failed = true;
		continue;
	}

	const code = await build.outputs[0]!.text();
	const nodeBuiltins = [...new Set([...code.matchAll(/node:[a-z_]+/g)].map((m) => m[0]))]
		.filter((m) => !ALLOWED.has(m))
		.sort();
	if (nodeBuiltins.length > 0) {
		console.error(`FAIL: ${entry} graph contains node: built-ins: ${nodeBuiltins.join(", ")}`);
		failed = true;
	} else {
		console.log(`PASS: ${entry} has no forbidden node: built-ins`);
	}

	const warnings = build.logs.filter(
		(l) => String(l.level) === "warn" || String(l.level) === "warning",
	);
	if (warnings.length > 0) {
		console.error(`FAIL: ${entry} build warnings: ${warnings.map((w) => w.message).join("; ")}`);
		failed = true;
	} else {
		console.log(`PASS: ${entry} produced no warnings`);
	}

	console.log(`  ${entry} bundle size: ${Math.round(code.length / 1024)} KB`);
}

if (failed) {
	console.error("Browser bundle smoke test failed.");
	process.exit(1);
}
console.log("Browser bundle smoke test passed (clean node-free graphs, no warnings).");
