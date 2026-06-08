// Smoke test for the browser engine entry point (src/browser.ts).
//
// It bundles the engine for a browser target and checks which Node built-ins
// remain in the graph. Phase 0 of the web-app plan eliminated node:fs and
// node:path from the engine; this test guards that they stay gone. The crypto
// and os built-ins are still expected until the platform/crypto abstraction
// lands in Phases 1-2, so they are reported but not yet failed on.

const ELIMINATED = ["node:fs", "node:path"];
const KNOWN_REMAINING = ["node:crypto", "node:os", "node:buffer"];
const TRANSITIVE_EXTRAS = ["node:util", "node:events", "node:stream"];

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
const present = new Set([...code.matchAll(/node:[a-z_]+/g)].map((m) => m[0]));

for (const mod of ELIMINATED) {
	if (present.has(mod)) {
		console.error(`FAIL: ${mod} reappeared in the browser graph (Phase 0 regression)`);
		failed = true;
	} else {
		console.log(`PASS: ${mod} absent from browser graph`);
	}
}

const remaining = [...present].sort();
console.log(`Remaining node: built-ins (tracked for Phases 1-2): ${remaining.join(", ")}`);
console.log(`Browser bundle size: ${Math.round(code.length / 1024)} KB`);

const unexpected = remaining.filter(
	(m) => !KNOWN_REMAINING.includes(m) && !TRANSITIVE_EXTRAS.includes(m),
);
if (unexpected.length > 0) {
	console.warn(`NOTE: new node: built-ins entered the graph: ${unexpected.join(", ")}`);
}

if (failed) {
	console.error("Browser bundle smoke test failed.");
	process.exit(1);
}
console.log("Browser bundle smoke test passed.");
