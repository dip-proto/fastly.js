// Minimal static server for the playground. Run `bun run web` to build and serve.
import { join } from "node:path";

const DIR = import.meta.dir;
const PORT = 5173;

Bun.serve({
	port: PORT,
	async fetch(req) {
		const url = new URL(req.url);
		const path = url.pathname === "/" ? "/index.html" : url.pathname;
		const file = Bun.file(join(DIR, path));
		if (await file.exists()) return new Response(file);
		return new Response("Not found", { status: 404 });
	},
});

console.log(`Playground at http://localhost:${PORT}`);
