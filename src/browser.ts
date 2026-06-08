// Browser engine entry: installs the browser platform (noble-backed crypto, Web
// Crypto randomness), then re-exports the engine. node:crypto/node:os never
// enter this graph because the engine in vcl.ts is platform-pure.
import "./platform-browser";

export { UnsupportedFeatureError } from "./platform";
export { createVCLContext, executeVCL, executeVCLByName, loadVCLContent } from "./vcl";
export type { VCLContext, VCLSubroutines } from "./vcl-compiler";
