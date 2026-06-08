// Headless browser simulator: run VCL against a synthetic request and backend
// response with no network, capturing diagnostics, the execution trace, and the
// run's logs. The result is plain, renderable data so a UI can show it directly.
// It drives the same runPipeline the CLI uses, so caching and subroutine order
// can never drift between the two.

import { type VCLDiagnostic, VCLDiagnosticError } from "../diagnostics";
import {
	getPlatform,
	setDefaultPlatform,
	type TraceEvent,
	UnsupportedFeatureError,
	type VCLPlatform,
} from "../platform";
import { browserPlatform } from "../platform-browser";
import { createVCLContext, loadVCLContent } from "../vcl";
import { type CacheDecision, type CacheEntry, runPipeline } from "./pipeline";

const MAX_RESTARTS = 3;

export interface SimRequest {
	method?: string;
	url: string;
	headers?: Record<string, string>;
}

export interface SimBackendResponse {
	status: number;
	statusText?: string;
	headers?: Record<string, string>;
	body?: string;
}

export interface SimPlatformOptions {
	now?: number;
	randomSeed?: number;
	hostname?: string;
	env?: Record<string, string>;
}

export interface SimulationOptions {
	vcl: string;
	request: SimRequest;
	backendResponse: SimBackendResponse;
	cacheState?: Map<string, CacheEntry>;
	platformOptions?: SimPlatformOptions;
	maxRestarts?: number;
}

export interface SimResponse {
	status: number;
	statusText: string;
	headers: Record<string, string>;
	body: string;
}

export type SimErrorKind = "compile" | "unsupported" | "runtime";

export interface SimulationResult {
	ok: boolean;
	diagnostics: VCLDiagnostic[];
	trace: TraceEvent[];
	logs: string[];
	response?: SimResponse;
	cacheDecision?: CacheDecision;
	cacheState: Map<string, CacheEntry>;
	error?: { kind: SimErrorKind; message: string };
}

// A small deterministic PRNG so a seeded run reproduces exactly.
function seededRandomBytes(seed: number): (length: number) => Uint8Array {
	let state = seed >>> 0 || 1;
	return (length: number) => {
		const out = new Uint8Array(length);
		for (let i = 0; i < length; i++) {
			state = (state * 1103515245 + 12345) & 0x7fffffff;
			out[i] = (state >>> 16) & 0xff;
		}
		return out;
	};
}

function buildPlatform(
	options: SimPlatformOptions | undefined,
	trace: TraceEvent[],
	logs: string[],
): VCLPlatform {
	const env = options?.env ?? {};
	return {
		...browserPlatform,
		now: () => options?.now ?? browserPlatform.now(),
		randomBytes:
			options?.randomSeed !== undefined
				? seededRandomBytes(options.randomSeed)
				: browserPlatform.randomBytes,
		hostname: () => options?.hostname ?? "localhost",
		env: (name: string) => env[name],
		log: (record) => logs.push(record.message),
		onTrace: (event) => trace.push(event),
	};
}

export async function runBrowserSimulation(options: SimulationOptions): Promise<SimulationResult> {
	const trace: TraceEvent[] = [];
	const logs: string[] = [];
	const cacheState = options.cacheState ?? new Map<string, CacheEntry>();
	const platform = buildPlatform(options.platformOptions, trace, logs);

	const previous = (() => {
		try {
			return getPlatform();
		} catch {
			return null;
		}
	})();
	setDefaultPlatform(platform);

	try {
		let subroutines: ReturnType<typeof loadVCLContent>;
		try {
			subroutines = loadVCLContent(options.vcl);
		} catch (err) {
			if (err instanceof VCLDiagnosticError) {
				return { ok: false, diagnostics: [err.diagnostic], trace, logs, cacheState };
			}
			throw err;
		}

		const context = createVCLContext(platform);
		context.cache = cacheState;
		context.req.url = options.request.url;
		context.req.method = options.request.method ?? "GET";
		for (const [name, value] of Object.entries(options.request.headers ?? {})) {
			context.req.http[name.toLowerCase()] = value;
		}

		const backend = options.backendResponse;
		const getBackendResponse = async () => {
			context.req.http["X-Selected-Backend"] = "synthetic";
			return {
				status: backend.status,
				statusText: backend.statusText ?? "",
				headers: backend.headers ?? {},
				body: backend.body ?? "",
			};
		};

		const result = await runPipeline({
			subroutines,
			context,
			cache: cacheState,
			maxRestarts: options.maxRestarts ?? MAX_RESTARTS,
			getBackendResponse,
		});

		return {
			ok: true,
			diagnostics: [],
			trace,
			logs,
			response: {
				status: result.response.status,
				statusText: result.response.statusText,
				headers: result.response.headers,
				body: new TextDecoder().decode(result.response.body),
			},
			cacheDecision: result.cache,
			cacheState,
		};
	} catch (err) {
		if (err instanceof UnsupportedFeatureError) {
			return {
				ok: false,
				diagnostics: [],
				trace,
				logs,
				cacheState,
				error: { kind: "unsupported", message: err.message },
			};
		}
		return {
			ok: false,
			diagnostics: [],
			trace,
			logs,
			cacheState,
			error: { kind: "runtime", message: err instanceof Error ? err.message : String(err) },
		};
	} finally {
		if (previous) setDefaultPlatform(previous);
	}
}
