import { runBrowserSimulation, type SimulationResult } from "../src/runtime/browser";
import type { CacheEntry } from "../src/runtime/pipeline";

// The cache lives across runs so MISS -> HIT is visible by clicking Run twice.
let cacheState = new Map<string, CacheEntry>();

const $ = <T extends HTMLElement = HTMLElement>(id: string): T => document.getElementById(id) as T;

function parseHeaderLines(text: string): Record<string, string> {
	const out: Record<string, string> = {};
	for (const line of text.split("\n")) {
		const idx = line.indexOf(":");
		if (idx === -1) continue;
		const key = line.slice(0, idx).trim();
		if (!key) continue;
		out[key] = line.slice(idx + 1).trim();
	}
	return out;
}

function escape(s: string): string {
	return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function headerList(headers: Record<string, string>): string {
	const rows = Object.entries(headers);
	if (rows.length === 0) return '<span class="muted">(none)</span>';
	return rows
		.map(
			([k, v]) =>
				`<div class="kv"><span class="k">${escape(k)}</span><span class="v">${escape(v)}</span></div>`,
		)
		.join("");
}

function setCacheBadge() {
	$("cache-count").textContent = `${cacheState.size} entr${cacheState.size === 1 ? "y" : "ies"}`;
}

function render(result: SimulationResult) {
	const errBox = $("errors");
	const okPanes = $("ok-panes");

	if (!result.ok) {
		okPanes.style.display = "none";
		errBox.style.display = "block";
		if (result.diagnostics.length > 0) {
			const d = result.diagnostics[0]!;
			$("error-kind").textContent = "Compile error";
			$("error-message").textContent = d.message;
			$("error-frame").textContent = d.sourceFrame ?? "";
			$("error-frame").style.display = d.sourceFrame ? "block" : "none";
		} else if (result.error) {
			$("error-kind").textContent =
				result.error.kind === "unsupported" ? "Unsupported feature" : "Runtime error";
			$("error-message").textContent = result.error.message;
			$("error-frame").style.display = "none";
		}
	} else {
		errBox.style.display = "none";
		okPanes.style.display = "block";

		const resp = result.response!;
		$("resp-status").textContent = `${resp.status} ${resp.statusText}`.trim();
		$("resp-headers").innerHTML = headerList(resp.headers);
		$("resp-body").textContent = resp.body;

		const cd = result.cacheDecision!;
		const badge = $("cache-outcome");
		badge.textContent = cd.outcome.toUpperCase();
		badge.className = `badge outcome-${cd.outcome}`;
		$("cache-detail").innerHTML = headerList({
			key: cd.key || "(none)",
			ttl: cd.ttl !== undefined ? `${cd.ttl}s` : "—",
			grace: cd.grace !== undefined ? `${cd.grace}s` : "—",
			stored: String(cd.stored),
			...(cd.ageSeconds !== undefined ? { age: `${cd.ageSeconds}s` } : {}),
		});

		$("trace").innerHTML =
			result.trace
				.map((e) => {
					const arrow = e.returnAction ? ` → ${escape(e.returnAction)}` : "";
					return `<div class="trace-row">${escape(e.subroutine)}<span class="muted">${arrow}</span></div>`;
				})
				.join("") || '<span class="muted">(no trace)</span>';

		$("logs").textContent = result.logs.length ? result.logs.join("\n") : "(no logs)";
	}

	setCacheBadge();
}

async function run() {
	const button = $<HTMLButtonElement>("run");
	button.disabled = true;
	button.textContent = "Running…";
	try {
		const result = await runBrowserSimulation({
			vcl: $<HTMLTextAreaElement>("vcl").value,
			request: {
				method: $<HTMLInputElement>("method").value || "GET",
				url: $<HTMLInputElement>("url").value || "/",
				headers: parseHeaderLines($<HTMLTextAreaElement>("req-headers").value),
			},
			backendResponse: {
				status: Number($<HTMLInputElement>("be-status").value) || 200,
				headers: parseHeaderLines($<HTMLTextAreaElement>("be-headers").value),
				body: $<HTMLTextAreaElement>("be-body").value,
			},
			cacheState,
		});
		cacheState = result.cacheState;
		render(result);
	} finally {
		button.disabled = false;
		button.textContent = "Run";
	}
}

function clearCache() {
	cacheState = new Map();
	setCacheBadge();
}

$("run").addEventListener("click", run);
$("clear").addEventListener("click", clearCache);
setCacheBadge();
