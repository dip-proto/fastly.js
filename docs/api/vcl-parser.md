# VCL Parser API

The VCL Parser is responsible for parsing VCL (Varnish Configuration Language) code into an abstract syntax tree (AST) that can be processed by the VCL Compiler. This document provides a reference for the VCL Parser API in Fastly.JS.

## Overview

The VCL Parser consists of several components:

1. **Tokenizer**: Breaks down the VCL code into tokens
2. **Parser**: Converts the tokens into an abstract syntax tree (AST)
3. **AST Nodes**: Represents the structure of the VCL code

## Importing the Parser

```typescript
import { parseVCL } from '../src/vcl-parser';
```

## Basic Usage

```typescript
// Parse VCL code into an AST
const vclCode = `
  sub vcl_recv {
    set req.http.X-Test = "Hello, World!";
    return(lookup);
  }
`;

const ast = parseVCL(vclCode);
```

## Parser API

### parseVCL(code: string): VCLProgram

Parses VCL code into an abstract syntax tree (AST).

**Parameters:**
- `code` (string): The VCL code to parse

**Returns:**
- `VCLProgram`: The root node of the AST

**Example:**
```typescript
const ast = parseVCL(`
  sub vcl_recv {
    set req.http.X-Test = "Hello, World!";
    return(lookup);
  }
`);

console.log(JSON.stringify(ast, null, 2));
```

### loadVCL(filePath: string): VCLSubroutines

Loads and parses a VCL file, then compiles it into executable subroutines.

**Parameters:**
- `filePath` (string): The path to the VCL file

**Returns:**
- `VCLSubroutines`: An object containing the compiled subroutines

**Example:**
```typescript
const subroutines = loadVCL('./path/to/file.vcl');

// Execute a subroutine
const context = createVCLContext();
const result = subroutines.vcl_recv(context);
```

## AST Node Types

The VCL Parser generates an AST with the following node types:

### VCLProgram

The root node of the AST, representing a complete VCL program.

**Properties:**
- `type` (string): Always "Program"
- `body` (VCLStatement[]): An array of statements in the program

### VCLSubroutineDeclaration

Represents a subroutine declaration in VCL.

**Properties:**
- `type` (string): Always "SubroutineDeclaration"
- `name` (string): The name of the subroutine (e.g., "vcl_recv")
- `body` (VCLStatement[]): An array of statements in the subroutine body

### VCLSetStatement

Represents a variable assignment statement in VCL.

**Properties:**
- `type` (string): Always "SetStatement"
- `left` (VCLExpression): The left-hand side of the assignment
- `right` (VCLExpression): The right-hand side of the assignment

### VCLReturnStatement

Represents a return statement in VCL.

**Properties:**
- `type` (string): Always "ReturnStatement"
- `argument` (string): The return value (e.g., "lookup", "pass", "deliver")

### VCLIfStatement

Represents an if statement in VCL.

**Properties:**
- `type` (string): Always "IfStatement"
- `test` (VCLExpression): The condition to test
- `consequent` (VCLStatement[]): Statements to execute if the condition is true
- `alternate` (VCLStatement[] | null): Statements to execute if the condition is false (for else blocks)

### VCLExpression

Base interface for all expression nodes.

**Properties:**
- `type` (string): The type of expression

### VCLBinaryExpression

Represents a binary expression in VCL (e.g., `a + b`, `a == b`).

**Properties:**
- `type` (string): Always "BinaryExpression"
- `operator` (string): The operator (e.g., "+", "==", "~")
- `left` (VCLExpression): The left operand
- `right` (VCLExpression): The right operand

### VCLIdentifier

Represents an identifier in VCL (e.g., variable names).

**Properties:**
- `type` (string): Always "Identifier"
- `name` (string): The name of the identifier

### VCLLiteral

Represents a literal value in VCL (e.g., strings, numbers).

**Properties:**
- `type` (string): Always "Literal"
- `value` (string | number | boolean): The literal value
- `raw` (string): The raw string representation of the value

## Error Handling

The VCL Parser throws descriptive error messages when it encounters syntax errors:

```typescript
try {
  const ast = parseVCL(`
    sub vcl_recv {
      set req.http.X-Test = "Unclosed string;
      return(lookup);
    }
  `);
} catch (error) {
  console.error(error.message);
  // Output: Unterminated string at line 3, column 32
}
```

## Advanced Usage

### Parsing Multiple Files

```typescript
import { parseVCL, mergeAST } from '../src/vcl-parser';
import * as fs from 'fs';

// Parse multiple VCL files
const mainAst = parseVCL(fs.readFileSync('./main.vcl', 'utf8'));
const includeAst = parseVCL(fs.readFileSync('./include.vcl', 'utf8'));

// Merge the ASTs
const mergedAst = mergeAST(mainAst, includeAst);
```

### Custom Tokenizer

```typescript
import { createTokenizer, parseTokens } from '../src/vcl-parser';

// Create a custom tokenizer
const tokenizer = createTokenizer(`
  sub vcl_recv {
    set req.http.X-Test = "Hello, World!";
    return(lookup);
  }
`);

// Get all tokens
const tokens = [];
let token;
while ((token = tokenizer.nextToken()) && token.type !== 'EOF') {
  tokens.push(token);
}

// Parse the tokens into an AST
const ast = parseTokens(tokens);
```

## Conclusion

The VCL Parser API provides a powerful way to parse and analyze VCL code in JavaScript/TypeScript. It's the foundation of Fastly.JS's ability to process and execute VCL configurations locally.

For more information on the VCL Compiler, see the [VCL Compiler API Reference](./vcl-compiler.md).
