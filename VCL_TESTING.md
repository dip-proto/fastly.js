# VCL Testing Guide

This document provides guidance on testing the VCL implementation.

## Overview

The VCL implementation can be tested in two ways:

1. **VCL Parser**: Using the VCL parser to parse real VCL code and execute the resulting subroutines. This is how the test suites work: each test provides a VCL snippet that is parsed, compiled, and run.
2. **Direct JavaScript API**: Creating VCL subroutines directly in JavaScript and executing them, which is useful when a test needs full control over the runtime context.

## Direct JavaScript API

The direct JavaScript API lets you create VCL subroutines directly in JavaScript and execute them, bypassing the parser entirely.

### Example

```typescript
import { createVCLContext, executeVCL } from './src/vcl';
import type { VCLContext, VCLSubroutines } from './src/vcl-compiler';

// Create a context
const context = createVCLContext();
context.req.url = '/test';
context.req.method = 'GET';
context.req.http = {
  'Host': 'example.com',
  'User-Agent': 'Mozilla/5.0'
};

// Create a simple VCL subroutine
const subroutines: VCLSubroutines = {
  vcl_recv: (ctx: VCLContext) => {
    // Set a header
    ctx.req.http['X-Test'] = 'Hello, World!';
    return 'lookup';
  }
};

// Execute the subroutine
const result = executeVCL(subroutines, 'vcl_recv', context);

// Check the result
console.log(`Result: ${result}`);
console.log('Headers:');
console.log(context.req.http);
```

## VCL Parser

The VCL parser handles the full language as exercised by the test suites, so the usual way to test is to write VCL and load it with `loadVCL` (from a file) or `loadVCLContent` (from a string).

### Example

```typescript
import { createVCLContext, executeVCL } from './src/vcl';
import { loadVCL } from './src/node-loader';

// Load the VCL file
const subroutines = loadVCL('./test.vcl');

// Create a context
const context = createVCLContext();
context.req.url = '/test';
context.req.method = 'GET';
context.req.http = {
  'Host': 'example.com',
  'User-Agent': 'Mozilla/5.0'
};

// Execute the subroutine
const result = executeVCL(subroutines, 'vcl_recv', context);

// Check the result
console.log(`Result: ${result}`);
console.log('Headers:');
console.log(context.req.http);
```

## Test Files

The test suites live under `test/`. Some of the entry points are:

- `test/run-tests.ts`: The default runner. It drives the standard suites: basic VCL, stdlib, caching, backend errors, the function-family suites (random, accept, address, binary, digest, query-string, UUID, WAF, rate limiting, HTTP, time, ESI, CSRF), security features, multi-file loading, goto, and the real-world configurations.
- `test/run-integration-tests.ts`: End-to-end integration tests under `test/integration/`.
- `test/run-root-tests.ts`: The root-level scenarios under `test/root-tests/`.
- `test/parser-tests.ts`: Tests for the VCL parser.
- `test/basic-vcl-tests.ts`, `test/stdlib-tests.ts`, `test/caching-tests.ts`: Focused suites you can run on their own.

## Running Tests

The test entry points are wired up as `package.json` scripts, so you run them through `bun run`:

```bash
# Run the standard test suites
bun run test

# Run everything (standard suites, root, integration, tables, crypto compat,
# limits, browser simulation, browser bundle)
bun run test:all

# Run an individual suite
bun run test:integration
bun run test:caching
```

## Best Practices

1. Write small, focused tests that test one feature at a time.
2. Use descriptive test names that clearly indicate what is being tested.
3. Verify the results of each test to ensure that the VCL implementation is working correctly.
4. Prefer real VCL snippets over hand-built JavaScript subroutines, since they also exercise the parser and compiler.

## Conclusion

Testing the VCL implementation is an important part of ensuring that it works correctly. By following the guidance in this document, you can effectively test the VCL implementation and identify any issues that need to be addressed.
