import { existsSync, readFileSync } from "node:fs";
import "./platform-node";
import { loadVCLContent } from "./vcl";
import type { VCLSubroutines } from "./vcl-compiler";

export function loadVCL(filePath: string): VCLSubroutines {
	if (!existsSync(filePath)) {
		throw new Error(`VCL file not found: ${filePath}`);
	}
	const content = readFileSync(filePath, "utf-8");
	return loadVCLContent(content);
}
