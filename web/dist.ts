// Builds a standalone, minified copy of the playground into web/site — drop
// that folder on any static host. Run `bun run web:dist`.
import { rm } from "node:fs/promises";
import { join } from "node:path";

const SRC = import.meta.dir;
const OUT = join(SRC, "site");

await rm(OUT, { recursive: true, force: true });

const result = await Bun.build({
	entrypoints: [join(SRC, "main.ts")],
	outdir: OUT,
	target: "browser",
	minify: true,
	sourcemap: "linked",
});

if (!result.success) {
	for (const log of result.logs) console.error(log);
	process.exit(1);
}

// The dev page loads ./dist/main.js; in the standalone folder the bundle sits
// next to index.html, so point the script tag at ./main.js.
const html = await Bun.file(join(SRC, "index.html")).text();
await Bun.write(join(OUT, "index.html"), html.replace("./dist/main.js", "./main.js"));

const bytes = Bun.file(join(OUT, "main.js")).size;
console.log(`Built web/site (${Math.round(bytes / 1024)} KB bundle) — deploy that folder.`);
