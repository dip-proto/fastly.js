// Phase 0 partial-graph smoke test for the browser engine entry (src/browser.ts).
//
// This is NOT a browser-readiness check. The engine still pulls in node:crypto
// and node:os, and Bun's browser polyfill for node:crypto is missing
// timingSafeEqual (see KNOWN_WARNINGS) — so digest functions would still
// misbehave in a real browser. That is expected until the platform/crypto
// abstraction lands in Phases 1-2.
//
// What this test does guard:
//   - node:fs and node:path stay out of the browser graph (the Phase 0 win),
//   - no NEW node: built-in sneaks into the graph,
//   - no NEW build warning appears beyond the ones we already know about.
// The full browser-readiness gate (zero node: built-ins, zero warnings) arrives
// once the crypto/os work is done.

const ELIMINATED = ["node:fs", "node:path"];
const KNOWN_REMAINING = ["node:crypto", "node:os", "node:buffer"];
const TRANSITIVE_EXTRAS = ["node:util", "node:events", "node:stream"];
// Warnings we have already triaged as Phase 1-2 work. Anything outside this set
// is a regression and fails the test.
const KNOWN_WARNINGS = [`node:crypto" doesn't have a matching export named "timingSafeEqual`];

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

const unexpectedModules = remaining.filter(
	(m) => !KNOWN_REMAINING.includes(m) && !TRANSITIVE_EXTRAS.includes(m),
);
if (unexpectedModules.length > 0) {
	console.error(
		`FAIL: new node: built-ins entered the browser graph: ${unexpectedModules.join(", ")}`,
	);
	failed = true;
}

const warnings = build.logs.filter((l) => l.level === "warn" || l.level === "warning");
for (const w of warnings) {
	console.log(`Build warning (tracked for Phases 1-2): ${w.message}`);
}
const unexpectedWarnings = warnings.filter(
	(w) => !KNOWN_WARNINGS.some((known) => w.message.includes(known)),
);
if (unexpectedWarnings.length > 0) {
	console.error(
		`FAIL: new browser build warning(s): ${unexpectedWarnings.map((w) => w.message).join("; ")}`,
	);
	failed = true;
}

if (failed) {
	console.error("Browser bundle partial-graph smoke test failed.");
	process.exit(1);
}
console.log(
	"Browser bundle partial-graph smoke test passed (node:fs/node:path absent; known gaps tracked).",
);
