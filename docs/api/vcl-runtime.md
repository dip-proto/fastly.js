# VCL Runtime API

The VCL runtime is what actually runs your VCL code once it has been parsed and compiled. It owns the execution context, the standard library, and the small piece of glue that dispatches into individual subroutines like `vcl_recv` or `vcl_fetch`.

In Fastly.JS the runtime entry points all live in [`src/vcl.ts`](../../src/vcl.ts) — there is no separate `vcl-runtime.ts` module. The HTTP request pipeline that ties everything together is implemented in [`index.ts`](../../index.ts) at the project root, which is the best place to look for a working example.

## Importing the runtime

Everything you need to load and run VCL is exported from `src/vcl`:

```typescript
import {
  loadVCL,
  loadVCLContent,
  createVCLContext,
  executeVCL,
  executeVCLByName,
  type VCLContext,
  type VCLSubroutines,
} from "../src/vcl";
```

`VCLContext` and `VCLSubroutines` are re-exported from `src/vcl-compiler.ts` for convenience.

## Basic usage

```typescript
import { loadVCL, createVCLContext, executeVCL } from "../src/vcl";

const subroutines = loadVCL("./filter.vcl");

const context = createVCLContext();
context.req.method = "GET";
context.req.url = "/api/users";
context.req.http = {
  host: "example.com",
  "user-agent": "Mozilla/5.0",
};

const action = executeVCL(subroutines, "vcl_recv", context);

console.log(action);              // e.g. "lookup", "pass", "error", "restart"
console.log(context.resp.status); // populated after vcl_deliver runs
console.log(context.resp.http);   // response headers
```

`executeVCL` returns the *action* string the subroutine returned (its `return(...)` value), not a new context. Mutations happen in place on the context object you passed in. Driving the full request pipeline — cache lookup, fetch, fallback, restart, error pages — is the caller's responsibility; see `index.ts` for a complete reference implementation.

## Runtime API

### `loadVCL(filePath: string): VCLSubroutines`

Reads a VCL file from disk, lexes, parses, and compiles it into a map of executable subroutines. Throws if the file does not exist.

### `loadVCLContent(content: string): VCLSubroutines`

Same as `loadVCL`, but operates on a string already in memory. Useful when you want to concatenate several VCL files yourself before compilation, which is exactly what `index.ts` does when invoked with multiple paths on the command line.

### `createVCLContext(): VCLContext`

Creates a fresh execution context with empty `req`, `bereq`, `beresp`, `resp`, `obj`, an empty cache, and a fully wired-up standard library (`context.std`, `context.fastly`, `context.waf`, `context.ratelimit`, …). One context corresponds to one in-flight request.

A small default backend named `"default"` pointing at `perdu.com:443` is registered so contexts always have something to fall back to. Replace or extend `context.backends` before calling `executeVCL` if you need different defaults.

### `executeVCL(subroutines, subroutineName, context): string`

```typescript
function executeVCL(
  subroutines: VCLSubroutines,
  subroutineName: keyof VCLSubroutines,
  context: VCLContext,
): string;
```

Runs a single named subroutine (`"vcl_recv"`, `"vcl_fetch"`, …) and returns the action string it produced. If the subroutine throws, the error is logged and `"error"` is returned so callers can route into `vcl_error`.

### `executeVCLByName(subroutines, name, context): string`

Lower-level variant of `executeVCL` that accepts an arbitrary subroutine name (including user-defined `sub` blocks) and additionally takes care of running ESI processing on the response body when `vcl_deliver` finishes with `beresp.do_esi` set. Use this when calling subroutines whose names are not part of the built-in `vcl_*` set.

## VCLContext

Everything VCL code touches lives on the context. The shape is defined in `src/vcl-compiler.ts`; the most important fields are:

```typescript
interface VCLContext {
  req:    { url: string; method: string; http: Record<string, string>; backend: string; restarts: number; ... };
  bereq:  { url: string; method: string; http: Record<string, string>; ... };
  beresp: { status: number; statusText: string; http: Record<string, string>; ttl: number; grace: number; stale_while_revalidate: number; do_esi: boolean; ... };
  resp:   { status: number; statusText: string; http: Record<string, string> };
  obj:    { status: number; response: string; http: Record<string, string>; hits: number };

  client: { ip: string; geo?: { country_code: string; continent_code: string; ... } };
  server: { ip: string };

  cache: Map<string, unknown>;
  hashData: string[];
  locals: Record<string, unknown>;
  backends: Record<string, VCLBackend>;
  directors: Record<string, VCLDirector>;
  acls: Record<string, VCLACL>;
  tables: Record<string, VCLTable>;
  current_backend?: VCLBackend;

  std: { /* standard library — see below */ };
  fastly: { error: string; state: string };
  waf: { allowed: boolean; blocked: boolean; blockStatus: number; blockMessage: string };
  ratelimit: { counters: Record<string, unknown>; penaltyboxes: Record<string, unknown> };
}
```

Note that the synthetic body produced by `synthetic { ... }` ends up on `context.obj.response`, not on `resp.body`. The actual backend response body in Fastly.JS is streamed by the host pipeline (e.g. `index.ts`), not stored on the context.

## Execution flow

The runtime itself does not impose an order on subroutines — your host code calls them. The conventional Fastly flow is:

1. `vcl_recv` — request received
2. `vcl_hash` — build the cache key
3. `vcl_hit` / `vcl_miss` — depending on cache state
4. `vcl_pass` — when the request bypasses the cache
5. `vcl_fetch` — after a backend response arrives
6. `vcl_error` — anywhere an error is raised
7. `vcl_deliver` — just before the response goes to the client
8. `vcl_log` — after the response has been sent

The action string a subroutine returns is one of: `lookup`, `pass`, `pipe`, `error`, `hash`, `miss`, `hit`, `deliver`, `fetch`, `restart`. The host code uses this to decide which subroutine to call next.

## Standard library

`context.std` exposes a large surface, all of which is covered in the [standard library reference](./standard-library.md) and the per-module pages under [`fastly-vcl/vcl-functions/`](../../fastly-vcl/vcl-functions/). A few highlights:

- String handling: `std.strlen`, `std.toupper`, `std.tolower`, `std.substr`, `std.strstr`, `std.regsub`, `std.regsuball`, `std.replace`, `std.replaceall`, `std.prefixof`, `std.suffixof`.
- Math: `std.math.round/floor/ceil/pow/log/min/max/abs`.
- Time: `std.time.now/add/sub/is_after/hex_to_time`, `std.strftime`.
- Random: `std.random.randombool`, `std.random.randombool_seeded`, `std.random.randomint`, `std.random.randomint_seeded`, `std.random.randomstr`, `std.random.randomstr_seeded`.
- Digest and crypto: `std.digest.hash_*`, `std.digest.hmac_*`, `std.digest.base64*`, `std.digest.rsa_verify`, `std.digest.ecdsa_verify`, `std.digest.awsv4_hmac`, `std.crypto.encrypt_*`/`decrypt_*`.
- Headers: `std.header.get/set/remove/filter/filter_except`.
- Logging: `std.log`, `std.syslog`.

## Error handling

Errors are raised either by VCL code (`error 403 "Forbidden";`) or by your host pipeline calling `context.std.error(status, message)` and then dispatching `vcl_error`:

```vcl
sub vcl_recv {
  if (req.url ~ "^/forbidden") {
    error 403 "Forbidden";
  }
  return(lookup);
}

sub vcl_error {
  set obj.http.Content-Type = "text/html; charset=utf-8";
  synthetic {"<html><body><h1>Error</h1></body></html>"};
  return(deliver);
}
```

When a subroutine throws a JavaScript exception, `executeVCL` logs the error and returns the string `"error"`, which gives the caller a chance to route into `vcl_error` rather than crashing the proxy.

## Customising the context

Because the context is a plain object you can attach anything to it before calling `executeVCL`. For example, the proxy in `index.ts` pre-registers backends and directors on a "setup context", then copies them onto every per-request context:

```typescript
const setupContext = createVCLContext();
setupContext.std!.backend!.add("api", "httpbin.org", 80, false);
setupContext.std!.director!.add("main_director", "random", { quorum: 50, retries: 3 });

// per request:
const context = createVCLContext();
context.backends  = { ...setupContext.backends };
context.directors = { ...setupContext.directors };
```

This is the recommended way to seed shared state — there is no `extendStandardLibrary` helper in the public API.

## See also

- [HTTP Object Model](./http-object-model.md) for the shape of `req`, `bereq`, `beresp`, `resp`, and `obj` in more detail.
- [VCL Compiler](./vcl-compiler.md) for the layer that turns a parsed program into the subroutine map executed here.
- [Standard Library](./standard-library.md) for a per-function reference.
