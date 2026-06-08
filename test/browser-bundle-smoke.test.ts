// Browser bundle gate for the engine entry (src/browser.ts).
//
// The engine in vcl.ts is platform-pure: node:crypto and node:os live only in
// platform-node.ts, which the browser entry does not import. So the browser
// bundle must contain NO node: built-ins and produce NO build warnings. This
// test enforces both strictly.
//
// Runtime caveat (tracked for Phase 2): the browser bundle still has no crypto
// implementation registered — src/browser.ts will import a browser platform in
// Phase 2. This test checks the module graph, not runtime crypto behaviour.

const build = await Bun.build({
	entrypoints: ["./src/browser.ts"],
	target: "browser",
});

let failed = false;

if (!build.success) {
	console.error("FAIL: browser bundle did not build");
	console.error(build.logs.map((l) => String(l)).join("\n"));
	process.exit(1);
}

const code = await build.outputs[0]!.text();
const nodeBuiltins = [...new Set([...code.matchAll(/node:[a-z_]+/g)].map((m) => m[0]))].sort();

if (nodeBuiltins.length > 0) {
	console.error(`FAIL: browser graph contains node: built-ins: ${nodeBuiltins.join(", ")}`);
	failed = true;
} else {
	console.log("PASS: browser graph has no node: built-ins");
}

const warnings = build.logs.filter((l) => String(l.level) === "warn" || String(l.level) === "warning");
if (warnings.length > 0) {
	console.error(`FAIL: browser build warnings: ${warnings.map((w) => w.message).join("; ")}`);
	failed = true;
} else {
	console.log("PASS: browser build produced no warnings");
}

console.log(`Browser bundle size: ${Math.round(code.length / 1024)} KB`);

if (failed) {
	console.error("Browser bundle smoke test failed.");
	process.exit(1);
}
console.log("Browser bundle smoke test passed (clean node-free graph, no warnings).");
