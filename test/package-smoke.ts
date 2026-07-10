// End-to-end check of the published artifact: packs the tarball, installs it
// into a scratch project, runs the pipeline under plain Node, and type-checks
// a consumer using moduleResolution "nodenext" against the shipped
// declarations. Requires a prior `bun run build`.
import { execSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
const { version } = JSON.parse(readFileSync(join(root, "package.json"), "utf-8")) as {
	version: string;
};

if (!existsSync(join(root, "dist", "index.js"))) {
	console.error("dist/ is missing; run `bun run build` first");
	process.exit(1);
}

const dir = mkdtempSync(join(tmpdir(), "fastly.js-pack-"));
const run = (cmd: string) => execSync(cmd, { cwd: dir, stdio: ["ignore", "pipe", "pipe"] });

const smokeScript = `
import { createVCLContext, loadVCLContent, runPipeline } from "fastly.js";

const subroutines = loadVCLContent(\`
sub vcl_recv { set req.http.X-Test = "recv-ran"; return(lookup); }
sub vcl_deliver { set resp.http.X-Delivered = "yes"; return(deliver); }
\`);

const context = createVCLContext();
context.req.url = "/test";
context.req.method = "GET";
const cache = new Map();
context.cache = cache;

const result = await runPipeline({
	subroutines,
	context,
	cache,
	maxRestarts: 3,
	getBackendResponse: async () => ({
		status: 200,
		statusText: "OK",
		headers: { "content-type": "text/plain" },
		body: new TextEncoder().encode("backend body"),
	}),
});

if (result.response.status !== 200) throw new Error("bad status: " + result.response.status);
if (result.response.headers["X-Delivered"] !== "yes") throw new Error("vcl_deliver did not run");

const browser = await import("fastly.js/browser");
if (typeof browser.runBrowserSimulation !== "function") throw new Error("browser entry broken");
`;

const typesScript = `
import { createVCLContext, loadVCLContent, runPipeline, type VCLContext } from "fastly.js";
import { runBrowserSimulation, type SimulationResult } from "fastly.js/browser";

const context: VCLContext = createVCLContext();
export { context, loadVCLContent, runPipeline, runBrowserSimulation };
export type { SimulationResult };
`;

const consumerTsconfig = {
	compilerOptions: {
		module: "nodenext",
		moduleResolution: "nodenext",
		strict: true,
		noEmit: true,
		skipLibCheck: false,
	},
	include: ["smoke-types.ts"],
};

try {
	run(`npm pack ${root} --silent`);
	writeFileSync(
		join(dir, "package.json"),
		JSON.stringify({ name: "pkgtest", private: true, type: "module" }),
	);
	run(`npm install ./fastly.js-${version}.tgz --silent`);
	writeFileSync(join(dir, "smoke.mjs"), smokeScript);
	writeFileSync(join(dir, "smoke-types.ts"), typesScript);
	writeFileSync(join(dir, "tsconfig.json"), JSON.stringify(consumerTsconfig, null, "\t"));
	run("node smoke.mjs");
	console.log("PASS: Node consumer runs the pipeline from the packed tarball");
	run(`node ${join(root, "node_modules", "typescript", "bin", "tsc")} -p .`);
	console.log("PASS: nodenext consumer type-checks against the shipped declarations");
} catch (error) {
	const err = error as { stdout?: Buffer; stderr?: Buffer; message: string };
	console.error("Package smoke test failed:", err.message);
	if (err.stdout?.length) console.error(err.stdout.toString());
	if (err.stderr?.length) console.error(err.stderr.toString());
	process.exit(1);
} finally {
	rmSync(dir, { recursive: true, force: true });
}
