// Fastly production limits that the interpreter enforces so a program that would
// be rejected on activation, or fail mid-request, fails here too instead of
// quietly running past a ceiling real Fastly would stop at.
// See https://docs.fastly.com/en/guides/resource-limits

import type {
	VCLCallStatement,
	VCLIfStatement,
	VCLStatement,
	VCLSubroutine,
	VCLSwitchStatement,
} from "./vcl-parser";

// MAX_REQUEST_WORKSPACE_SIZE is the size of the per-request workspace. Request
// headers are assembled into it and the previous copy is never reclaimed, even
// across restarts, so a VCL that rewrites a header many times eventually
// overflows it and Fastly returns "503 Header overflow".
export const MAX_REQUEST_WORKSPACE_SIZE = 256 * 1024;

// BASE_REQUEST_WORKSPACE_OVERHEAD approximates what Fastly has already consumed
// before any user VCL runs (internal structures and injected headers). A
// production service shows ~8.5KB, varying by POP and connection, so we charge a
// conservative 10KB on top of the inbound headers we can see.
export const BASE_REQUEST_WORKSPACE_OVERHEAD = 10 * 1024;

// headerWorkspaceCost is what one header line costs the workspace, measured on a
// production service: the bare header name (any `:subfield` dropped), the value,
// and three bytes of fixed overhead, rounded up (as Fastly rounds every header
// allocation) to an 8 byte boundary.
export function headerWorkspaceCost(name: string, value: string): number {
	const colon = name.indexOf(":");
	const bareName = colon === -1 ? name : name.slice(0, colon);
	return Math.ceil((bareName.length + value.length + 3) / 8) * 8;
}

// seedRequestWorkspace returns what Fastly has already spent when vcl_recv begins:
// the fixed overhead plus every inbound header line, each charged the same way a
// VCL write is.
export function seedRequestWorkspace(httpHeaders: Record<string, string>): number {
	let bytes = BASE_REQUEST_WORKSPACE_OVERHEAD;
	for (const [name, value] of Object.entries(httpHeaders)) {
		bytes += headerWorkspaceCost(name, value);
	}
	return bytes;
}

// MAX_SUBROUTINE_CALL_TREE is the ceiling Fastly enforces on the fully inlined
// subroutine call graph. A subroutine's cost is the sum, over each of its `call`
// statements, of one plus the callee's own cost, so nested calls multiply. Past
// this, activation fails with "Too many sub calls".
export const MAX_SUBROUTINE_CALL_TREE = 25000;

// VCLLimitExceededError is thrown when a program exceeds one of Fastly's hard
// limits. Like UnsupportedFeatureError it is loud on purpose: a limit violation
// is a real failure a debugging playground must surface, not silently absorb.
export class VCLLimitExceededError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "VCLLimitExceededError";
	}
}

// checkCallTreeLimit emulates Fastly's compile-time check on the fully inlined
// subroutine call graph. Fastly inlines every `call`, so a subroutine that calls
// another many times multiplies the callee's whole subtree. When any
// subroutine's expansion exceeds MAX_SUBROUTINE_CALL_TREE, activation fails.
export function checkCallTreeLimit(subroutines: VCLSubroutine[]): void {
	const byName = new Map<string, VCLSubroutine>();
	for (const sub of subroutines) {
		byName.set(sub.name, sub);
	}

	const costs = new Map<string, number>();
	const visiting = new Set<string>();

	const cost = (name: string): number => {
		const cached = costs.get(name);
		if (cached !== undefined) {
			return cached;
		}
		const sub = byName.get(name);
		if (!sub) {
			return 0;
		}
		// Guard against recursive VCL (which Fastly rejects anyway) so the walk
		// always terminates.
		if (visiting.has(name)) {
			return 0;
		}
		visiting.add(name);
		let total = 0;
		for (const call of collectCallStatements(sub.body ?? [])) {
			total += 1 + cost(call.subroutineName);
		}
		visiting.delete(name);
		costs.set(name, total);
		return total;
	};

	// Report deterministically by visiting subroutines in name order.
	for (const name of [...byName.keys()].sort()) {
		const expanded = cost(name);
		if (expanded > MAX_SUBROUTINE_CALL_TREE) {
			throw new VCLLimitExceededError(
				`Too many sub calls: subroutine ${name} expands to ${expanded} calls, exceeding the limit of ${MAX_SUBROUTINE_CALL_TREE}`,
			);
		}
	}
}

// collectCallStatements returns every `call` statement reachable inside a
// statement list, descending into nested if/else and switch blocks.
function collectCallStatements(statements: VCLStatement[]): VCLCallStatement[] {
	const calls: VCLCallStatement[] = [];
	for (const stmt of statements) {
		switch (stmt.type) {
			case "CallStatement":
				calls.push(stmt as VCLCallStatement);
				break;
			case "IfStatement": {
				const ifStmt = stmt as VCLIfStatement;
				calls.push(...collectCallStatements(ifStmt.consequent ?? []));
				// else-if chains parse as a nested if in the alternate branch.
				if (ifStmt.alternate) {
					calls.push(...collectCallStatements(ifStmt.alternate));
				}
				break;
			}
			case "SwitchStatement":
				for (const switchCase of (stmt as VCLSwitchStatement).cases) {
					calls.push(...collectCallStatements(switchCase.body ?? []));
				}
				break;
		}
	}
	return calls;
}
