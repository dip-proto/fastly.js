# VCL Parser API

The VCL parser turns VCL source text into an abstract syntax tree (AST) that the [VCL compiler](./vcl-compiler.md) can then walk into executable subroutines. It lives in [`src/vcl-parser.ts`](../../src/vcl-parser.ts) (lexer plus type definitions) and [`src/vcl-parser-impl.ts`](../../src/vcl-parser-impl.ts) (the recursive-descent parser).

## Overview

Parsing happens in two stages:

1. **Lexer** (`VCLLexer`): walks the source string character by character and produces a flat list of `Token` values.
2. **Parser** (`VCLParser`, used internally by `parseVCL`): consumes the token stream and produces a `VCLProgram` AST.

For most callers the only entry point you need is `parseVCL`.

## Importing the parser

```typescript
import { parseVCL, VCLLexer, type VCLProgram } from "../src/vcl-parser";
```

If you simply want to load and run a VCL file, use `loadVCL` / `loadVCLContent` from `src/vcl` instead — they handle parsing and compilation in one call.

## Basic usage

```typescript
import { parseVCL } from "../src/vcl-parser";

const ast = parseVCL(`
  sub vcl_recv {
    set req.http.X-Test = "Hello, World!";
    return(lookup);
  }
`);

console.log(ast.subroutines[0].name); // "vcl_recv"
```

## Parser API

### `parseVCL(input: string): VCLProgram`

Lexes and parses a VCL source string and returns the root `VCLProgram` node. Throws on syntax errors with a message that includes the offending line.

### `class VCLLexer`

The tokenizer used by `parseVCL`. You can use it directly when you want to inspect or modify the token stream before handing it back to the parser:

```typescript
import { VCLLexer } from "../src/vcl-parser";

const lexer = new VCLLexer(`set req.http.X = "hi";`);
const tokens = lexer.tokenize();
```

There is no separate "loadVCL" or "mergeAST" helper exported from this module; loading a file goes through `src/vcl.ts`. To combine multiple VCL files, concatenate them as text before passing them to `parseVCL` or `loadVCLContent` — that is the approach `index.ts` takes when you pass several files on the command line.

## AST node types

The full set of node interfaces is defined at the top of `src/vcl-parser.ts`. The most commonly inspected nodes are:

### `VCLProgram`

The root node. In addition to the parsed subroutines it carries every top-level declaration:

```typescript
interface VCLProgram {
  type: "Program";
  subroutines: VCLSubroutine[];
  comments: VCLComment[];
  acls: VCLACL[];
  includes: VCLIncludeStatement[];
  imports: VCLImportStatement[];
  tables: VCLTableDeclaration[];
  backends: VCLBackendDeclaration[];
  directors: VCLDirectorDeclaration[];
  penaltyboxes: VCLPenaltyboxDeclaration[];
  ratecounters: VCLRatecounterDeclaration[];
}
```

### `VCLSubroutine`

```typescript
interface VCLSubroutine {
  type: "Subroutine";
  name: string;                   // e.g. "vcl_recv" or a user-defined name
  params?: VCLSubroutineParam[];
  body: VCLStatement[];
  returnType?: string;
}
```

### `VCLSetStatement`

```typescript
interface VCLSetStatement {
  type: "SetStatement";
  target: string;        // e.g. "req.http.X-Test"
  value: VCLExpression;
  operator?: string;     // "=", "+=", etc.
}
```

### `VCLReturnStatement`

```typescript
interface VCLReturnStatement {
  type: "ReturnStatement";
  argument: string;      // "lookup", "pass", "deliver", ...
  value?: VCLExpression; // for return statements that yield a value
}
```

### `VCLIfStatement`

```typescript
interface VCLIfStatement {
  type: "IfStatement";
  test: VCLExpression;
  consequent: VCLStatement[];
  alternate?: VCLStatement[];
}
```

### Expressions

Expression nodes share the same `VCLNode` base and discriminate on `type`:

- `VCLBinaryExpression` — `{ type: "BinaryExpression", operator, left, right }`
- `VCLUnaryExpression` — `{ type: "UnaryExpression", operator, argument }`
- `VCLTernaryExpression` — `{ type: "TernaryExpression", test, consequent, alternate }`
- `VCLFunctionCall` — `{ type: "FunctionCall", name, arguments }`
- `VCLIdentifier` — `{ type: "Identifier", name }`
- `VCLStringLiteral` — `{ type: "StringLiteral", value }`
- `VCLNumberLiteral` — `{ type: "NumberLiteral", value }`
- `VCLRegexLiteral` — `{ type: "RegexLiteral", pattern, flags }`
- `VCLMemberAccess` — `{ type: "MemberAccess", object, property }`

A complete list of statement node types lives in the `VCLStatementType` union: `Assignment`, `IfStatement`, `ReturnStatement`, `ErrorStatement`, `SetStatement`, `UnsetStatement`, `AddStatement`, `RemoveStatement`, `CallStatement`, `LogStatement`, `SyntheticStatement`, `SyntheticBase64Statement`, `EsiStatement`, `SwitchStatement`, `HashDataStatement`, `GotoStatement`, `LabelStatement`, `RestartStatement`, `DeclareStatement`.

## Error handling

The parser throws `Error` instances with a description and the location of the problem:

```typescript
try {
  parseVCL(`
    sub vcl_recv {
      set req.http.X-Test = "Unclosed string;
      return(lookup);
    }
  `);
} catch (error) {
  console.error((error as Error).message);
  // Unterminated string literal at line 3
}
```

`loadVCLContent` (in `src/vcl.ts`) wraps this and prints the error before re-throwing, which is what you see when the proxy fails to start.

## Working with multiple files

The proxy in `index.ts` concatenates every file passed on the command line, separated by `# Begin file:` / `# End file:` marker comments, and then calls `loadVCLContent` once on the result. This is the recommended pattern when you want to split a configuration across several files — there is no AST-level merge helper.

```typescript
import { loadVCLContent } from "../src/vcl";
import { readFileSync } from "node:fs";

const combined = ["./common.vcl", "./site.vcl"]
  .map((path) => readFileSync(path, "utf-8"))
  .join("\n");

const subroutines = loadVCLContent(combined);
```

## See also

- [VCL Compiler](./vcl-compiler.md) for the layer that consumes this AST.
- [VCL Runtime](./vcl-runtime.md) for the execution model the compiled code targets.
- [`src/vcl-parser.ts`](../../src/vcl-parser.ts) for the authoritative list of AST node interfaces.
