# Plan: Running Fastly.JS in the Browser

## What we want

Today Fastly.JS is a CLI. You point `bun run index.ts` at one or more VCL
files, it spins up a proxy on `127.0.0.1:8000`, and every request that hits it
is run through the VCL pipeline before being forwarded to a real backend.

The goal is to also ship Fastly.JS as a web application: something you can open
in a browser, paste VCL into, throw a request at, and watch the pipeline
execute — without installing Bun, without a terminal, without a server.

This document is a plan for getting there. It is deliberately honest about the
parts that are easy (most of the engine already runs anywhere) and the parts
that are not (anything that touches the filesystem, Node's crypto module, or a
real network socket).

## The shape of the problem

The codebase splits cleanly into two layers, even though that split isn't
expressed in the directory structure yet:

1. **The VCL engine** — the parser (`src/vcl-parser*.ts`), the compiler and
   interpreter (`src/vcl-compiler.ts`, ~2700 lines), and the standard library
   (`src/vcl-std.ts`, `src/vcl-strings.ts`, `src/vcl-digest.ts`, and the rest of
   the `vcl-*.ts` modules). This layer takes VCL source plus a request context
   and produces a transformed context. It is almost pure computation.

2. **The runtime** — `index.ts`. This reads files off disk, stands up a
   `Bun.serve` listener, selects backends, and uses `fetch` to proxy to real
   upstreams. This is the part that is bound to a specific host environment.

The engine is what we want in the browser. The runtime is what we have to
replace. So the work divides into three efforts: making the engine
runtime-agnostic *behind a platform interface*, building a browser runtime to
sit underneath it, and building a UI on top.

## The host boundary, formalized

The first version of this plan listed host dependencies one by one (`fs`,
`crypto`, `process`, …) and treated "browser support" as "Node APIs removed."
That undersells the problem. The browser version also needs **reproducible
runs** (a playground where the same inputs always produce the same trace) and
**UI-friendly logging and errors** (no `console.error` as the primary UX). Both
fall out naturally if, instead of scattering host calls, the engine takes its
host capabilities through a single injected interface:

```ts
interface VCLPlatform {
  crypto: CryptoProvider;        // sync hash / hmac / cipher / verify / constant-time eq
  now(): number;                 // pinnable in the playground for determinism
  randomBytes(length: number): Uint8Array;
  hostname(): string;            // replaces node:os.hostname(); configurable
  env(name: string): string | undefined;  // replaces process.env
  log(record: LogRecord): void;  // structured, not console.*
}
```

Every ambient thing the engine reaches for today — the clock (TOTP, time
functions), randomness, the hostname (`server.hostname`), environment variables
(`vcl-testing.ts`), and logging — flows through this. The CLI constructs a
platform backed by Node/Bun; the browser constructs one backed by Web APIs and
UI sinks; the playground constructs one with a pinned clock and seeded RNG so
runs are deterministic and shareable.

This is the central change the rest of the plan builds on.

## What already works in a browser

A good chunk of the engine has no host dependencies at all. The parser and the
interpreter are plain TypeScript. The third-party dependencies are friendly:

- `js-xxhash` is pure JS.
- `uuid` ships a browser build.
- `libsodium-wrappers` is a WASM module that runs in the browser (it already
  initializes asynchronously via `sodium.ready`, which the digest module waits
  on — see the initialization note below).

So the parser, the compiler, control flow, string functions, math, tables,
query-string handling, ESI, the WAF/rate-limit logic, and directors are all
portable as-is or nearly so.

## What does not work, and why

A survey of the source turned up a finite, enumerable list of host
dependencies. Each one is either absorbed by the platform interface above or
confined to a CLI-only module.

### 1. `node:crypto` (the big one)

`src/vcl-digest.ts` leans on `node:crypto` heavily — `createHash`,
`createHmac`, `createCipheriv` / `createDecipheriv` (AES-CBC and AES-GCM),
`createVerify` (RSA signature verification), and `timingSafeEqual`. It also
implements AWS Signature v4 (`awsv4_hmac`) using a mix of libsodium and
`node:crypto`. There are scattered uses elsewhere: `src/vcl-misc.ts`
(`createHash("sha256")`), `src/vcl-uuid.ts` (only `crypto.getRandomValues`,
which is the easy case — that maps straight to `globalThis.crypto` or the
platform's `randomBytes`), `src/csrf-protection.ts` (`createHash`), and three
inline `require("node:crypto")` calls inside `src/vcl-compiler.ts` for
MD5/SHA-256 (these inline requires are also a tree-shaking hazard for bundlers
and need to go).

The catch that makes this more than a find-and-replace: **Node's crypto API is
synchronous, and the browser's Web Crypto API (`crypto.subtle`) is async.** VCL
functions like `digest.hash_sha256()` are called synchronously deep inside the
interpreter's expression evaluation. We cannot simply `await crypto.subtle.digest`
from there without making the entire interpreter async, which would be a large
and risky change.

The answer is the `CryptoProvider` on the platform interface — a **synchronous**
facade backed by pure-JS / WASM implementations rather than Web Crypto:

- Hashing (MD5, SHA-1, SHA-224/256/384/512): `@noble/hashes` (pure JS, fully
  synchronous, no async warm-up — preferable to `hash-wasm` for exactly that
  reason).
- HMAC: `@noble/hashes/hmac`, synchronous.
- AES-CBC / AES-GCM: `@noble/ciphers`, synchronous.
- RSA signature verification (`createVerify`): the awkward case — see the RSA
  section below.
- `timingSafeEqual`: a small constant-time comparison over byte arrays.

The CLI's `CryptoProvider` delegates to `node:crypto` (fastest, already proven).
The browser's is backed by the noble libraries. The rest of the engine talks
only to the provider, never to `node:crypto`.

`Buffer` is the companion problem — it appears ~80 times across the digest,
binary, utf8, and std modules, and the browser has no `Buffer`. We make this a
**conscious boundary**, not an accident: either pull in the `buffer` polyfill
(fast to land) or migrate those call sites to `Uint8Array` +
`TextEncoder`/`TextDecoder` and a small set of hex/base64 helpers (cleaner
long-term). Start with the polyfill, migrate incrementally, and track which
modules still assume `Buffer`.

### 2. `node:fs`

`src/vcl.ts` exposes `loadVCL(filePath)` (reads a file, the only `fs` user)
alongside `loadVCLContent(content)` (takes a string). In the browser there is
no filesystem and no need for one: VCL arrives as a string from a textarea, a
file picker, or a URL fetch. The fix is to make `loadVCLContent` the canonical
entry point and move `loadVCL` plus its `fs` import into a CLI-only module so it
never enters the browser bundle.

### 3. `node:path`

`src/vcl-std.ts` imports `node:path` only for `basename` and `dirname` (lines
191/198). These operate on VCL string values and can become a few lines of
POSIX-style string handling — no `node:path` needed in either build.

### 4. `process.env` / `process.argv` / `process.exit`

`src/vcl-testing.ts` reads `process.env`; `index.ts` reads `process.argv` and
calls `process.exit`. The `argv`/`exit` uses are CLI-only and stay in the CLI
runtime. `process.env` becomes `platform.env(name)`.

### 5. `node:os.hostname()`

One use in `src/vcl-compiler.ts` for `server.hostname`. Becomes
`platform.hostname()`; the browser always provides a configured value.

### 6. `console.*` in engine paths

`console.*` calls appear in several engine modules (`vcl.ts`, `vcl-compiler.ts`,
`vcl-std.ts`, `vcl-security.ts`, `vcl-esi.ts`, `vcl-waf.ts`, `utils.ts`). In a
browser playground these should not be the user-facing output channel. Route
them through `platform.log(record)` so the UI can render structured, filterable
diagnostics instead of dumping to the devtools console.

### 7. `Bun.serve` and the proxy

`index.ts` is the whole HTTP server. None of this translates to the browser, and
it shouldn't — it gets replaced by a browser runtime (below).

### 8. The backend-fetch problem (the conceptual one)

This is the most important design decision in the whole effort. The CLI proxies
to real backends with `fetch`. A browser **cannot** fetch arbitrary third-party
origins — CORS will block it, and a local dev proxy is exactly the kind of thing
browsers refuse to let a page do.

This means the browser version cannot be a transparent proxy. That's fine,
because a transparent proxy isn't what makes a browser version useful. What's
useful is a **playground / simulator**: you bring the VCL and you bring (a
description of) the request and the backend response, and the tool shows you
exactly what the pipeline does. Three modes, in increasing ambition:

- **Simulator (default).** The user supplies a synthetic request and a synthetic
  backend response, and the engine runs the pipeline against them — no network
  at all. This is the headline feature and works completely offline.
- **Same-origin fetch (optional).** For backends that send permissive CORS
  headers, or same-origin requests, actually `fetch` the upstream and feed the
  real response into `vcl_fetch`.
- **Proxied fetch (optional, later).** Route backend requests through a small
  user-supplied CORS proxy. This reintroduces a server component, so it's
  explicitly opt-in and out of scope for the first cut.

The first cut targets the simulator, which sidesteps CORS entirely.

## Modeling the pipeline faithfully

The headline simulator flow is the cache-miss path:

```text
vcl_recv → vcl_hash → vcl_miss/pass → vcl_fetch → vcl_deliver → vcl_log
```

But a playground that only models a miss is barely a playground. To be worth
using, the simulator has to model Fastly's actual state machine:

- `vcl_hit` and `vcl_pass`, not just `vcl_miss`.
- `vcl_error` and synthetic responses.
- `restart` handling (the CLI already loops on this with `MAX_RESTARTS`).
- A real cache object with lookup/store, so behavior depends on prior requests.
- Backend health and director selection (the engine already has directors,
  probes, and `is_healthy`).
- **Multiple sequential requests against the same simulated cache**, so a user
  can run "request 1 → MISS, request 2 → HIT" and diff the two. This is the
  single most instructive thing a VCL playground can offer, and it's why the
  simulated cache is a first-class part of the runtime, not an afterthought.

## Tracing as instrumentation, not just snapshots

The first plan proposed building the trace by snapshotting the context between
`executeVCL` calls. That captures phase-level diffs but misses what users most
want to see when debugging: which *statement* changed a header, when a nested
`call` ran, where an expression or function call failed, the exact `return(...)`
that ended a subroutine, and transitions into restart/error/synthetic states.

So the trace should come from a lightweight hook the interpreter calls, designed
in now even if the first UI only renders phase-level diffs:

```ts
onTrace({
  phase,
  subroutine,
  statement,     // source location of the statement
  before, after, // relevant context slices
  returnAction,  // lookup / pass / deliver / error / restart / …
  error,         // populated on a failed expression/function call
});
```

Retrofitting this after the UI exists would mean reopening the interpreter, so
the hook lands during the engine work, not the UI work.

## Structured diagnostics instead of console errors

`loadVCLContent` currently logs parse/load failures with `console.error`
(including `err.stack`) and rethrows the raw error. For an editor-based UI we
want structured diagnostics:

```ts
{ message, line, column, sourceFrame }
```

That lets the editor underline the offending token and show an inline message,
instead of the user hunting through the devtools console. The lexer/parser
already work over the source string, so carrying positions through to the thrown
error is the main work.

## Proposed architecture

```
src/
  engine/              # runtime-agnostic — no node:*, no Bun, no fs, no Buffer assumptions
    parser, compiler, stdlib (the existing vcl-*.ts, cleaned of host deps)
    platform.ts        # the VCLPlatform / CryptoProvider interfaces
  platform/
    node.ts            # VCLPlatform backed by node:crypto, process, os, console
    web.ts             # VCLPlatform backed by noble libs, Web Crypto RNG, UI log sink
  runtime/
    cli.ts             # today's index.ts — Bun.serve + real proxying + fs loader
    browser.ts         # headless simulator: VCL + request + response + cache → result + trace

web/                   # the web application
  index.html
  main.ts              # initializeEngine(), then wires the UI to runtime/browser.ts
  ui/                  # editor, request builder, trace viewer, response panel
```

Rather than make `src/vcl.ts` serve as both CLI and browser entry, the build
gets **explicit entry points** (`runtime/cli.ts`, `runtime/browser.ts`) over a
clean import graph, so the browser bundle never even references `node:fs`,
`node:crypto`, or `Bun`. Conditional exports/aliases are fine, but they work
best once the graph is already clean — hence the early refactor.

## Initialization

`libsodium-wrappers` warms up asynchronously, and the noble-backed crypto and
the syntax highlighter may need setup too. So the app has one async gate:

```ts
await initializeEngine();  // libsodium ready, crypto provider built, highlighter loaded
```

After that returns, VCL execution stays fully synchronous. Keeping the async
strictly at the boundary is what lets the interpreter remain synchronous.

## The web application itself

A single-page app, no framework required (though one is fine). The layout:

- **VCL editor.** A code editor (CodeMirror, preferred over Monaco for bundle
  size) with VCL syntax highlighting and inline parse-error annotations driven
  by the structured diagnostics above. Seeded with the README example.
- **Request builder.** Method, URL, and headers for the synthetic request.
- **Backend response + backend table.** Status/headers/body fed into
  `vcl_fetch`, plus a backend list (name, host, healthy?) for director logic.
- **Cache panel.** Shows the simulated cache across sequential requests so
  MISS-then-HIT is visible.
- **Run → results.** The final response, the cache decision (TTL, grace,
  stale-while-revalidate, hit/miss), and the statement-level trace.
- **Shareable state.** Serialize editor + request + response + cache seed into
  the URL hash. VCL can get large, so compress the hash state (e.g. LZ-string)
  and fall back to a localStorage-backed share id or JSON import/export for
  payloads too big for a URL.

Distribution is a static bundle — drop it on any static host or GitHub Pages.

## The RSA / JWT story (decide before UI work)

There is no clean synchronous pure-JS RSA verify in the noble family, so
`createVerify`-backed JWT/RSA verification is the one feature that can't be
ported the easy way. In a *debugging* tool a silent stub is dangerous — a user
may trust an incomplete result. So the browser behavior must be explicit and
loud, and chosen before the UI is built. The options, in rough order of effort:

1. **Pull a dedicated synchronous RSA library** and support it fully (best UX,
   most dependency weight).
2. **Feature-flag it off in the browser build** and have the function raise a
   clear "RSA verification is unavailable in the browser" diagnostic that the UI
   surfaces prominently.
3. **Expose it as an async-only function** unavailable on the synchronous path
   (most faithful to Web Crypto, but breaks the synchronous-interpreter model
   for this one call).

The decision is option 2 for the first browser release, with option 1 deferred
to a focused follow-up once the simulator is already useful.

**Initial browser policy:** RSA/JWT verification functions throw a structured
`UnsupportedFeatureError` in the browser platform. The UI displays this as a
run-blocking compatibility error with the function name and a suggested
workaround: run in CLI mode, or avoid RSA/JWT verification in browser examples.
The browser must never return `false`, `not set`, or a placeholder result for
unsupported verification, because that could be mistaken for a real failed
verification — the whole point of a debugging playground is that a result you
can see is a result you can trust.

## Crypto compatibility: a hard gate

Crypto is the highest-risk area, so "byte-identical crypto compatibility suite"
is a named deliverable and a gate between Phase 1 and Phase 2 — not a
nice-to-have. The same input vectors run against the Node provider and the web
provider and must match exactly:

- hashes: MD5, SHA-1, SHA-224/256/384/512
- HMAC across the supported encodings
- base64 / base64url edge cases
- AES-CBC and AES-GCM encrypt/decrypt round-trips
- TOTP with a **pinned** clock (via `platform.now()`)
- constant-time equality semantics
- AWS Signature v4 (`awsv4_hmac`) and any other signing helpers in
  `vcl-digest.ts`

The existing `test/` vectors are the starting corpus; the deliverable is running
them through both providers.

## Phased plan

**Phase 0 — Clean engine/browser entry boundary.** Pure refactoring, no behavior
change, tests stay green. Split the CLI-only loader/runtime out of the shared
path (move `loadVCL` + `fs` to `runtime/cli.ts`). Drive the browser graph clean
of `node:fs`, `node:path`, `node:os`, `Bun`, `process.*`, the inline
`require("node:crypto")` calls, direct `console.*`, and unmediated `Buffer`
assumptions. Add a browser-bundle **smoke test** (does it build and import with
no `node:*` in the graph?). This de-risks everything after it.

**Phase 1 — Platform + crypto abstraction (Node only).** Introduce
`VCLPlatform` / `CryptoProvider` and the structured-diagnostics and `onTrace`
hooks, and route every host call (`crypto`, clock, random, hostname, env,
logging) through them. Ship only the Node-backed platform so the existing tests
run unchanged against proven implementations — a behavior-preserving change
verifiable against current output. Largest and most delicate phase; the test
suite is the safety net.

**Phase 2 — Browser platform implementation.** Add `platform/web.ts` backed by
`@noble/hashes` / `@noble/ciphers`, settle the `Buffer` story (polyfill first,
`Uint8Array` migration after), make the RSA behavior explicit per above, and
**pass the crypto compatibility gate** — byte-identical output against the Node
provider. Acceptance includes an explicit RSA/JWT *unsupported* test proving the
browser provider throws the documented `UnsupportedFeatureError` (not a `false`
or placeholder), and that the simulator surfaces it in the diagnostics/trace.

**Phase 3 — Headless browser simulator.** `runtime/browser.ts` with a
programmatic API: in goes VCL + request + backend response + cache state; out
comes the final context, the trace, and diagnostics. Full state machine —
`vcl_hit`/`vcl_pass`/`vcl_error`, restarts, cache lookup/store, director/health.
No UI yet. This is the proof the engine runs in a browser end-to-end, and it's
independently testable.

**Phase 4 — Minimal UI.** Editor (with annotations), request/response builders,
cache panel, Run button, phase-level trace. Ugly but complete.

**Phase 5 — Polished UI and shareability.** Statement-level trace viewer,
sequential-request cache inspection, compressed URL-hash sharing with
localStorage/JSON fallback, syntax-highlighting polish.

**Phase 6 (optional, later) — Real backends.** Same-origin and CORS-permissive
fetch, then opt-in proxy support for arbitrary upstreams.

## Tooling

The repo uses Bun and Biome. Bun can bundle for the browser (`bun build
--target browser`), so no new bundler is strictly required, though Vite would
give a nicer dev server with hot reload for the UI work — worth considering at
Phase 4. Keep the engine tests running on Bun exactly as they do now; they are
the contract that the refactors in Phases 0–2 must not break.

## Risks and open questions

- **RSA verification in the browser.** No clean synchronous pure-JS RSA verify.
  Decided per the RSA section: ship a loud unsupported error first, revisit a
  dedicated library later. The UI must never present an incomplete verification
  as a success.
- **Determinism.** TOTP, time functions, and randomness read ambient state.
  `platform.now()` and `platform.randomBytes()` make these pinnable so playground
  runs are reproducible and shareable.
- **Bundle size.** libsodium-wasm plus noble plus an editor is not tiny.
  CodeMirror over Monaco, lazy-loading WASM, and compressed share state keep it
  reasonable.
- **Scope discipline.** The temptation is to chase the transparent-proxy dream.
  The simulator is the product; the proxy is a stretch goal (Phase 6). Holding
  that line is what keeps Phases 3–5 shippable.

## First concrete step

Phase 0 is safe, mechanical, and unblocks everything else: split the host-bound
code away from the engine, drive the browser import graph clean of every host
dependency enumerated above (not just `fs`/`path`/`Bun`, but also `node:crypto`,
inline `require`, `node:os`, `console.*`, and `Buffer` assumptions), and add a
browser-bundle smoke test — with the existing test suite proving nothing broke.
