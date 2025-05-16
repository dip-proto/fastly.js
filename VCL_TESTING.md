# VCL Testing Guide

This document provides guidance on testing the VCL implementation.

## Overview

The VCL implementation can be tested in two ways:

1. **Direct JavaScript API**: Using the JavaScript API directly to create VCL subroutines and execute them.
2. **VCL Parser**: Using the VCL parser to parse VCL code and execute the resulting subroutines.

## Direct JavaScript API

The direct JavaScript API is the most reliable way to test the VCL implementation. It allows you to create VCL subroutines directly in JavaScript and execute them.

### Example

```typescript
import { createVCLContext, executeVCL } from './src/vcl';
import { VCLContext, VCLSubroutines } from './src/vcl-compiler';

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

The VCL parser is still under development and may not correctly parse all VCL code. It's recommended to use the direct JavaScript API for testing until the parser is more stable.

### Example

```typescript
import { loadVCL, createVCLContext, executeVCL } from './src/vcl';

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

The following test files are available:

- `vcl_test_examples.ts`: Examples of using the VCL implementation with the direct JavaScript API.
- `vcl_test_suite.ts`: A comprehensive test suite for the VCL implementation using the direct JavaScript API.
- `vcl_parser_test.ts`: Tests for the VCL parser.
- `simple_test.ts`: A simple test for the VCL parser.
- `minimal_test.ts`: A minimal test for the VCL parser.

## Running Tests

To run the tests, use the following commands:

```bash
# Run the examples
bun run vcl_test_examples.ts

# Run the test suite
bun run vcl_test_suite.ts

# Run the parser tests
bun run vcl_parser_test.ts
```

## Known Issues

The VCL parser has the following known issues:

1. The parser may not correctly handle identifiers with hyphens (e.g., `req.http.X-Test`).
2. The parser may not correctly handle binary expressions in if statements.
3. The parser may not correctly handle regex literals.

These issues are being addressed in ongoing development.

## Best Practices

1. Use the direct JavaScript API for testing until the parser is more stable.
2. Write small, focused tests that test one feature at a time.
3. Use descriptive test names that clearly indicate what is being tested.
4. Verify the results of each test to ensure that the VCL implementation is working correctly.
5. When testing with the parser, start with simple VCL code and gradually add more complex features.

## Conclusion

Testing the VCL implementation is an important part of ensuring that it works correctly. By following the guidance in this document, you can effectively test the VCL implementation and identify any issues that need to be addressed.
