// Node engine entry: registers the Node platform, then re-exports the engine.
// Import this (or node-loader) from any Node-side consumer so crypto, the clock,
// randomness, the hostname, the environment, and logging are wired up. The pure
// engine in vcl.ts never imports platform-node, which keeps node:crypto and
// node:os out of the browser bundle.
import "./platform-node";

export * from "./vcl";
