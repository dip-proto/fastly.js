// The shared VCL request lifecycle: recv (with restarts) -> hash -> cache
// lookup -> hit/miss/pass -> fetch -> deliver -> log, plus error handling and
// cache storage. Both the CLI proxy and the browser simulator drive this, so
// the two can never drift on caching or subroutine order. The one thing they
// supply differently is how a backend response is obtained — a real fetch for
// the CLI, a synthetic response for the simulator — injected as getBackendResponse.

import { executeVCL } from "../vcl";
import type { VCLContext, VCLSubroutines } from "../vcl-compiler";
import { seedRequestWorkspace } from "../vcl-limits";

export interface BackendResponse {
	status: number;
	statusText?: string;
	headers: Record<string, string>;
	body: Uint8Array | ArrayBuffer | string;
}

export interface CacheEntry {
	resp: { status: number; statusText: string; http: Record<string, string> };
	body: Uint8Array;
	created: number;
	expires: number;
	staleUntil: number;
	beresp: VCLContext["beresp"];
}

export type CacheOutcome = "hit" | "hit-stale" | "miss" | "pass" | "uncacheable" | "error";

export interface PipelineResponse {
	status: number;
	statusText: string;
	headers: Record<string, string>;
	body: Uint8Array;
}

export interface CacheDecision {
	outcome: CacheOutcome;
	key: string;
	ttl?: number;
	grace?: number;
	staleWhileRevalidate?: number;
	ageSeconds?: number;
	stored: boolean;
}

export interface PipelineResult {
	response: PipelineResponse;
	action: string;
	restarts: number;
	cache: CacheDecision;
}

export interface PipelineOptions {
	subroutines: VCLSubroutines;
	context: VCLContext;
	cache: Map<string, CacheEntry>;
	maxRestarts: number;
	getBackendResponse: (context: VCLContext) => Promise<BackendResponse>;
}

const DEFAULT_TTL = 300;
const DEFAULT_GRACE = 3600;
const DEFAULT_STALE_WHILE_REVALIDATE = 10;

function toBytes(body: Uint8Array | ArrayBuffer | string): Uint8Array {
	if (typeof body === "string") return new TextEncoder().encode(body);
	if (body instanceof ArrayBuffer) return new Uint8Array(body);
	return body;
}

function computeCacheKey(context: VCLContext): string {
	return context.hashData && context.hashData.length > 0
		? context.hashData.join(":")
		: `${context.req.url}:${context.req.http.host || ""}`;
}

function errorResult(context: VCLContext, key: string, restarts: number): PipelineResult {
	return {
		response: {
			status: context.obj.status || 500,
			statusText: "",
			headers: { ...context.obj.http },
			body: toBytes(context.obj.response ?? ""),
		},
		action: "error",
		restarts,
		cache: { outcome: "error", key, stored: false },
	};
}

export async function runPipeline(opts: PipelineOptions): Promise<PipelineResult> {
	const { subroutines, context, cache, maxRestarts, getBackendResponse } = opts;
	const now = () => context.platform.now();

	// Seed the workspace with what Fastly has already spent on the inbound request
	// before user VCL runs, so bytes_free is realistic and overflow detection
	// accounts for the size of the request itself.
	context.workspaceBytes = seedRequestWorkspace(context.req.http);

	let action = executeVCL(subroutines, "vcl_recv", context) || "lookup";
	while (action === "restart") {
		if ((context.req.restarts ?? 0) >= maxRestarts) {
			context.std!.error(503, `Maximum number of restarts (${maxRestarts}) reached`);
			executeVCL(subroutines, "vcl_error", context);
			return errorResult(context, "", context.req.restarts ?? 0);
		}
		context.req.restarts = (context.req.restarts ?? 0) + 1;
		action = executeVCL(subroutines, "vcl_recv", context) || "lookup";
	}
	const restarts = context.req.restarts ?? 0;

	if (action === "error") {
		executeVCL(subroutines, "vcl_error", context);
		return errorResult(context, "", restarts);
	}

	let key = "";
	if (action === "lookup") {
		executeVCL(subroutines, "vcl_hash", context);
		key = computeCacheKey(context);

		const cached = cache.get(key);
		if (cached) {
			const at = now();
			const isFresh = at < cached.expires;
			const isStale = !isFresh && at < cached.staleUntil;
			if (isFresh || isStale) {
				context.obj.hits = 1;
				action = executeVCL(subroutines, "vcl_hit", context) || "deliver";
				if (action === "deliver") {
					context.resp = { ...cached.resp, http: { ...cached.resp.http } };
					context.resp.http["X-Cache"] = isFresh ? "HIT" : "HIT-STALE";
					context.resp.http["X-Cache-Hits"] = "1";
					const ageSeconds = Math.floor((at - cached.created) / 1000);
					context.resp.http["X-Cache-Age"] = `${ageSeconds}`;

					executeVCL(subroutines, "vcl_deliver", context);
					executeVCL(subroutines, "vcl_log", context);
					if (isStale) cache.delete(key);

					return {
						response: {
							status: context.resp.status,
							statusText: context.resp.statusText,
							headers: { ...context.resp.http },
							body: cached.body.slice(),
						},
						action,
						restarts,
						cache: { outcome: isFresh ? "hit" : "hit-stale", key, ageSeconds, stored: false },
					};
				}
			} else {
				cache.delete(key);
				action = executeVCL(subroutines, "vcl_miss", context) || "fetch";
			}
		} else {
			action = executeVCL(subroutines, "vcl_miss", context) || "fetch";
		}
	} else if (action === "pass") {
		action = executeVCL(subroutines, "vcl_pass", context) || "fetch";
	}

	const passing = key === "";
	let backendResponse: BackendResponse;
	try {
		backendResponse = await getBackendResponse(context);
	} catch (err) {
		if (!context.obj.status) {
			context.obj.status = 503;
			context.obj.response = err instanceof Error ? err.message : String(err);
			context.obj.http = { "Content-Type": "text/html; charset=utf-8" };
		}
		context.fastly!.error = context.obj.response;
		context.fastly!.state = "error";
		executeVCL(subroutines, "vcl_error", context);
		return errorResult(context, key, restarts);
	}

	context.beresp.status = backendResponse.status;
	context.beresp.statusText = backendResponse.statusText ?? "";
	for (const [name, value] of Object.entries(backendResponse.headers)) {
		context.beresp.http[name.toLowerCase()] = value;
	}

	action = executeVCL(subroutines, "vcl_fetch", context) || "deliver";

	if (context.beresp.ttl === 0) {
		context.beresp.ttl = DEFAULT_TTL;
		context.beresp.grace = DEFAULT_GRACE;
		context.beresp.stale_while_revalidate = DEFAULT_STALE_WHILE_REVALIDATE;
	}

	const body = toBytes(backendResponse.body);

	context.resp.status = context.beresp.status;
	context.resp.statusText = context.beresp.statusText;
	context.resp.http = { ...context.beresp.http };
	context.resp.http["X-Cache"] = "MISS";
	context.resp.http["X-Backend"] = context.req.http["X-Selected-Backend"] || "unknown";

	executeVCL(subroutines, "vcl_deliver", context);

	let stored = false;
	if (action === "deliver" && key && context.beresp.ttl > 0) {
		const at = now();
		const ttlMs = context.beresp.ttl * 1000;
		const graceMs = (context.beresp.grace || 0) * 1000;
		const swrMs = (context.beresp.stale_while_revalidate || 0) * 1000;
		cache.set(key, {
			resp: {
				status: context.resp.status,
				statusText: context.resp.statusText,
				http: { ...context.resp.http },
			},
			body: body.slice(),
			created: at,
			expires: at + ttlMs,
			staleUntil: at + ttlMs + graceMs + swrMs,
			beresp: { ...context.beresp },
		});
		stored = true;
	}

	executeVCL(subroutines, "vcl_log", context);

	return {
		response: {
			status: context.resp.status,
			statusText: context.resp.statusText,
			headers: { ...context.resp.http },
			body,
		},
		action,
		restarts,
		cache: {
			outcome: passing ? "pass" : stored ? "miss" : "uncacheable",
			key,
			ttl: context.beresp.ttl,
			grace: context.beresp.grace,
			staleWhileRevalidate: context.beresp.stale_while_revalidate,
			stored,
		},
	};
}
