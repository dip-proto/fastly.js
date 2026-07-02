# VCL Compiler API

The VCL compiler turns the abstract syntax tree produced by the parser into a map of executable JavaScript functions — one per `sub` block in the source. Each compiled subroutine is a closure of the form `(context: VCLContext) => string`, where the returned string is the action (`"lookup"`, `"pass"`, `"deliver"`, …) the surrounding host code uses to drive the request pipeline.

The compiler lives in [`src/vcl-compiler.ts`](../../src/vcl-compiler.ts) and is exposed as a single class, `VCLCompiler`. Most callers will not use this class directly; the higher-level helpers `loadVCLContent` (in `src/vcl.ts`) and `loadVCL` (in `src/node-loader.ts`) lex, parse, and compile in one step.

## Importing the compiler

```typescript
import { VCLCompiler, type VCLSubroutines, type VCLContext } from "../src/vcl-compiler";
import { parseVCL } from "../src/vcl-parser";
```

If you only want to go from source to runnable subroutines, `loadVCLContent` from `src/vcl` is usually enough:

```typescript
import { loadVCLContent } from "../src/vcl";

const subroutines = loadVCLContent(`
  sub vcl_recv {
    set req.http.X-Test = "Hello, World!";
    return(lookup);
  }
`);
```

## Basic usage

When you do want to drive the compiler explicitly:

```typescript
import { parseVCL } from "../src/vcl-parser";
import { VCLCompiler } from "../src/vcl-compiler";
import { createVCLContext, executeVCL } from "../src/vcl";

const ast = parseVCL(`
  sub vcl_recv {
    set req.http.X-Test = "Hello, World!";
    return(lookup);
  }
`);

const subroutines = new VCLCompiler(ast).compile();

const context = createVCLContext();
const action = executeVCL(subroutines, "vcl_recv", context);
console.log(action);                    // "lookup"
console.log(context.req.http["X-Test"]); // "Hello, World!"
```

## Compiler API

### `class VCLCompiler`

#### `new VCLCompiler(program: VCLProgram)`

Creates a compiler bound to a parsed program. The constructor does not do any work itself — call `compile()` to produce the subroutine map.

#### `compile(): VCLSubroutines`

Walks the program, registering every ACL, director, penalty box, rate counter, table, and backend declared at the top level on a fresh internal context, then compiles each `sub` block into an executable function. Returns a `VCLSubroutines` map keyed by subroutine name.

The compiler does not throw for unknown identifiers at compile time — VCL is dynamically typed, so the runtime resolves names against the live `VCLContext` when each subroutine actually runs. It *does* throw for a few structural problems, matching Fastly's load-time checks: a `goto` whose label is missing or appears before the goto (jumps are forward-only), and a subroutine call graph that exceeds Fastly's inlined-size limit (`VCLLimitExceededError` from `src/vcl-limits.ts`). Lexer and parser errors surface as exceptions during `parseVCL` / `loadVCLContent`.

## VCLSubroutines

```typescript
interface VCLSubroutines {
  vcl_recv?:    (context: VCLContext) => string;
  vcl_hash?:    (context: VCLContext) => string;
  vcl_hit?:     (context: VCLContext) => string;
  vcl_miss?:    (context: VCLContext) => string;
  vcl_pass?:    (context: VCLContext) => string;
  vcl_fetch?:   (context: VCLContext) => string;
  vcl_deliver?: (context: VCLContext) => string;
  vcl_error?:   (context: VCLContext) => string;
  vcl_pipe?:    (context: VCLContext) => string;
  vcl_init?:    (context: VCLContext) => string;
  vcl_synth?:   (context: VCLContext) => string;
  vcl_log?:     (context: VCLContext) => void;
  [name: string]: ((context: VCLContext) => string | void) | undefined;
}
```

Each entry is a function that takes a `VCLContext`, mutates it in place, and returns the action string from the VCL `return(...)` statement. User-defined subroutines (`sub my_helper { ... }`) appear in the same map under their declared name and can be invoked from VCL with `call my_helper;`.

## Compilation pipeline

The compiler is a tree walker — it does not emit JavaScript source and re-`eval` it. For each VCL statement it builds a small JavaScript function that performs the equivalent runtime mutation against the context. The high-level steps for each program are:

1. Initialise an internal context for declaration-time side effects (ACLs, directors, penalty boxes, rate counters, tables, backends).
2. For every `sub` block, walk its body and produce a single function that:
   - Looks up identifiers against the live `context` (not against compile-time bindings).
   - Resolves header subfields (`req.http.X-Foo:bar`) using the header module.
   - Implements `set`, `unset`, `add`, `remove`, `if`/`else`, `switch`, `goto`/labels, `restart`, `error`, `synthetic`, and `synthetic.base64`.
   - Routes function calls (`std.foo`, `digest.bar`, `waf.baz`, …) to the corresponding standard library binding on `context`.
3. Return the resulting `VCLSubroutines` map.

## Conceptual mapping

The compiler is intentionally close to a one-to-one translation. A few representative shapes:

### Subroutine declaration

```vcl
sub vcl_recv {
  set req.http.X-Test = "Hello, World!";
  return(lookup);
}
```

becomes (roughly):

```javascript
(context) => {
  context.req.http["X-Test"] = "Hello, World!";
  return "lookup";
}
```

### If / regex match

```vcl
if (req.url ~ "^/api/") {
  set req.http.X-API = "true";
  return(pass);
}
return(lookup);
```

becomes:

```javascript
(context) => {
  if (new RegExp("^/api/").test(context.req.url)) {
    context.req.http["X-API"] = "true";
    return "pass";
  }
  return "lookup";
}
```

### Standard library call

```vcl
set req.http.X-MD5 = digest.hash_md5(req.url);
```

becomes:

```javascript
context.req.http["X-MD5"] = context.std.digest.hash_md5(context.req.url);
```

## Error handling

Errors raised during compilation come from the underlying lexer and parser and are reported with a line number and a short message:

```typescript
try {
  loadVCLContent("sub vcl_recv { set req.http.X = ; }");
} catch (error) {
  console.error((error as Error).message);
  // Unexpected token ";" in expression at line 1, column 33
}
```

`loadVCLContent` also logs the message together with a source frame pointing at the offending line, and the thrown error is a `VCLDiagnosticError` (from `src/diagnostics.ts`).

Runtime errors raised from inside a compiled subroutine — for example a regex with an invalid pattern, or a `std.*` call that fails — are caught by the compiled function itself, logged, and mapped to a per-phase error action: `"error"` for `vcl_recv`/`vcl_hash`/`vcl_hit`/`vcl_miss`/`vcl_pass`/`vcl_fetch`, `"deliver"` for `vcl_deliver`/`vcl_error`/`vcl_synth`, `"pipe"` for `vcl_pipe`, `"ok"` for `vcl_init`. (`executeVCL` in `src/vcl.ts` adds an outer safety net that returns `"error"` should anything still escape.) The host pipeline can then route into `vcl_error`. Two exception types are deliberately re-thrown instead of being swallowed at either layer: `UnsupportedFeatureError` (from `src/platform.ts`) and `VCLLimitExceededError`.

## See also

- [VCL Parser](./vcl-parser.md) for the AST shape consumed by the compiler.
- [VCL Runtime](./vcl-runtime.md) for the context and execution model the compiled subroutines target.
- [Standard Library](./standard-library.md) for the helpers attached to `context.std`, `context.waf`, `context.ratelimit`, and so on.
