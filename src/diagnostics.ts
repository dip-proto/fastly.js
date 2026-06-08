// Structured parse/compile diagnostics so an editor UI can underline the
// offending token and show an inline message instead of reading a stack trace
// off the console. loadVCLContent throws a VCLDiagnosticError carrying these
// fields; its `message` is left identical to the underlying error so existing
// callers that match on the message keep working.

export interface VCLDiagnostic {
	message: string;
	line?: number;
	column?: number;
	sourceFrame?: string;
}

const LOCATION_RE = /at line (\d+),? column (\d+)/;

function buildSourceFrame(source: string, line: number, column: number): string {
	const lines = source.split("\n");
	const start = Math.max(1, line - 2);
	const end = Math.min(lines.length, line + 2);
	const gutter = String(end).length;
	const out: string[] = [];
	for (let n = start; n <= end; n++) {
		const text = lines[n - 1] ?? "";
		const marker = n === line ? ">" : " ";
		out.push(`${marker} ${String(n).padStart(gutter)} | ${text}`);
		if (n === line && column > 0) {
			out.push(`  ${" ".repeat(gutter)} | ${" ".repeat(column - 1)}^`);
		}
	}
	return out.join("\n");
}

export function buildDiagnostic(error: Error, source: string): VCLDiagnostic {
	const match = error.message.match(LOCATION_RE);
	if (!match) {
		return { message: error.message };
	}
	const line = Number(match[1]);
	const column = Number(match[2]);
	return {
		message: error.message,
		line,
		column,
		sourceFrame: buildSourceFrame(source, line, column),
	};
}

export class VCLDiagnosticError extends Error {
	readonly diagnostic: VCLDiagnostic;

	constructor(diagnostic: VCLDiagnostic) {
		super(diagnostic.message);
		this.name = "VCLDiagnosticError";
		this.diagnostic = diagnostic;
	}
}
