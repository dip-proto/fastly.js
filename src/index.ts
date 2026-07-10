// Package entry for Node and Bun: installs the Node platform (node:crypto,
// node:os), then exposes the engine and the request pipeline.
import "./platform-node";

export type { VCLDiagnostic } from "./diagnostics";
export { VCLDiagnosticError } from "./diagnostics";
export { loadVCL } from "./node-loader";
export type { TraceEvent, VCLPlatform } from "./platform";
export { UnsupportedFeatureError } from "./platform";
export type {
	BackendResponse,
	CacheDecision,
	CacheEntry,
	CacheOutcome,
	PipelineOptions,
	PipelineResponse,
	PipelineResult,
} from "./runtime/pipeline";
export { runPipeline } from "./runtime/pipeline";
export { createVCLContext, executeVCL, executeVCLByName, loadVCLContent } from "./vcl";
export type { VCLContext, VCLSubroutines } from "./vcl-compiler";
