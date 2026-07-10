// tsc emits declarations with the extensionless relative imports found in the
// source, which consumers using moduleResolution "node16"/"nodenext" reject
// (TS2834). Rewrite relative specifiers in dist/**/*.d.ts to end in ".js".
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

function collectDeclarations(dir: string, out: string[] = []): string[] {
	for (const name of readdirSync(dir)) {
		const path = join(dir, name);
		if (statSync(path).isDirectory()) collectDeclarations(path, out);
		else if (path.endsWith(".d.ts")) out.push(path);
	}
	return out;
}

const relativeSpecifier = /((?:from|import)\s*\(?\s*)"(\.\.?\/[^"]+)"/g;

for (const file of collectDeclarations("dist")) {
	const source = readFileSync(file, "utf-8");
	const fixed = source.replace(relativeSpecifier, (match, prefix, specifier) =>
		specifier.endsWith(".js") ? match : `${prefix}"${specifier}.js"`,
	);
	if (fixed !== source) writeFileSync(file, fixed);
}
