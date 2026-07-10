// Browser engine entry: installs the browser platform (noble-backed crypto, Web
// Crypto randomness), then re-exports the engine. node:crypto/node:os never
// enter this graph because the engine in vcl.ts is platform-pure.
import "./platform-browser";

export type { VCLDiagnostic } from "./diagnostics";
export { VCLDiagnosticError } from "./diagnostics";
export type { TraceEvent, VCLPlatform } from "./platform";
export { UnsupportedFeatureError } from "./platform";
export type {
	SimBackendResponse,
	SimErrorKind,
	SimPlatformOptions,
	SimRequest,
	SimResponse,
	SimulationOptions,
	SimulationResult,
} from "./runtime/browser";
export { runBrowserSimulation } from "./runtime/browser";
export type { BackendResponse, CacheDecision, CacheEntry, CacheOutcome } from "./runtime/pipeline";
export { createVCLContext, executeVCL, executeVCLByName, loadVCLContent } from "./vcl";
export type { VCLContext, VCLSubroutines } from "./vcl-compiler";
