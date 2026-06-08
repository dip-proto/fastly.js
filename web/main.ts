import { runBrowserSimulation, type SimulationResult } from "../src/runtime/browser";
import type { CacheEntry } from "../src/runtime/pipeline";

// The cache lives across runs so MISS -> HIT is visible by clicking Run twice.
let cacheState = new Map<string, CacheEntry>();

const $ = <T extends HTMLElement = HTMLElement>(id: string): T => document.getElementById(id) as T;

function escape(s: string): string {
	return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

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

// --- shareable state -------------------------------------------------------

interface PlaygroundState {
	vcl: string;
	method: string;
	url: string;
	reqHeaders: string;
	beStatus: string;
	beHeaders: string;
	beBody: string;
}

function collectState(): PlaygroundState {
	return {
		vcl: $<HTMLTextAreaElement>("vcl").value,
		method: $<HTMLInputElement>("method").value,
		url: $<HTMLInputElement>("url").value,
		reqHeaders: $<HTMLTextAreaElement>("req-headers").value,
		beStatus: $<HTMLInputElement>("be-status").value,
		beHeaders: $<HTMLTextAreaElement>("be-headers").value,
		beBody: $<HTMLTextAreaElement>("be-body").value,
	};
}

function applyState(s: PlaygroundState) {
	$<HTMLTextAreaElement>("vcl").value = s.vcl;
	$<HTMLInputElement>("method").value = s.method;
	$<HTMLInputElement>("url").value = s.url;
	$<HTMLTextAreaElement>("req-headers").value = s.reqHeaders;
	$<HTMLInputElement>("be-status").value = s.beStatus;
	$<HTMLTextAreaElement>("be-headers").value = s.beHeaders;
	$<HTMLTextAreaElement>("be-body").value = s.beBody;
}

function encodeState(s: PlaygroundState): string {
	return btoa(unescape(encodeURIComponent(JSON.stringify(s))));
}

function decodeState(hash: string): PlaygroundState | null {
	try {
		const parsed = JSON.parse(decodeURIComponent(escape(atob(hash))));
		if (parsed && typeof parsed.vcl === "string") return parsed;
	} catch {
		// corrupt/invalid hash — fall back to defaults
	}
	return null;
}

function writeHash() {
	history.replaceState(null, "", `#${encodeState(collectState())}`);
}

// --- rendering -------------------------------------------------------------

function setCacheBadge() {
	$("cache-count").textContent = `${cacheState.size}`;
}

function renderCacheTable() {
	const box = $("cache-table");
	if (cacheState.size === 0) {
		box.innerHTML = '<span class="muted">empty</span>';
		return;
	}
	const now = Date.now();
	box.innerHTML = [...cacheState.entries()]
		.map(([key, e]) => {
			const state = now < e.expires ? "fresh" : now < e.staleUntil ? "stale" : "expired";
			const age = Math.max(0, Math.floor((now - e.created) / 1000));
			const ttl = Math.round((e.expires - e.created) / 1000);
			return `<div class="cache-row"><span class="badge state-${state}">${state}</span><span class="ckey">${escape(key)}</span><span class="muted">ttl ${ttl}s · age ${age}s · ${e.resp.status}</span></div>`;
		})
		.join("");
}

function renderTrace(trace: SimulationResult["trace"], vcl: string) {
	const lines = vcl.split("\n");
	$("trace").innerHTML =
		trace
			.map((e) => {
				if (e.statement) {
					const src = (lines[e.statement.line - 1] ?? "").trim();
					return `<div class="trace-stmt"><span class="ln">${e.statement.line}</span>${escape(src)}</div>`;
				}
				if (e.returnAction) {
					return `<div class="trace-ret">└ return(${escape(e.returnAction)})</div>`;
				}
				return `<div class="trace-sub">▸ ${escape(e.subroutine)}</div>`;
			})
			.join("") || '<span class="muted">(no trace)</span>';
}

function render(result: SimulationResult) {
	const errBox = $("errors");
	const okPanes = $("ok-panes");

	if (!result.ok) {
		okPanes.style.display = "none";
		errBox.style.display = "block";
		if (result.diagnostics.length > 0) {
			const d = result.diagnostics[0]!;
			const loc = d.line !== undefined ? ` · Line ${d.line}, Column ${d.column}` : "";
			$("error-kind").textContent = `Compile error${loc}`;
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

		renderTrace(result.trace, $<HTMLTextAreaElement>("vcl").value);
		$("logs").textContent = result.logs.length ? result.logs.join("\n") : "(no logs)";
	}

	renderCacheTable();
	setCacheBadge();
}

// --- actions ---------------------------------------------------------------

async function run() {
	const button = $<HTMLButtonElement>("run");
	button.disabled = true;
	button.textContent = "Running…";
	writeHash();
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
	renderCacheTable();
	setCacheBadge();
}

function flash(el: HTMLElement, text: string) {
	const prev = el.textContent;
	el.textContent = text;
	setTimeout(() => {
		el.textContent = prev;
	}, 1200);
}

async function copyLink() {
	writeHash();
	try {
		await navigator.clipboard.writeText(location.href);
		flash($("share"), "Copied!");
	} catch {
		flash($("share"), "URL updated");
	}
}

const DEFAULTS = collectState();

function resetExample() {
	applyState(DEFAULTS);
	clearCache();
	history.replaceState(null, "", location.pathname);
}

// --- boot ------------------------------------------------------------------

const restored = location.hash.length > 1 ? decodeState(location.hash.slice(1)) : null;
if (restored) applyState(restored);

$("run").addEventListener("click", run);
$("clear").addEventListener("click", clearCache);
$("reset").addEventListener("click", resetExample);
$("share").addEventListener("click", copyLink);
setCacheBadge();
renderCacheTable();
