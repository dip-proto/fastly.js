# VCL Test Suite

This directory contains a comprehensive test suite for the VCL implementation. The tests use actual VCL code snippets to verify that the VCL parser, compiler, and runtime are working correctly.

## Test Structure

The test suite is organized into many files. The main ones are:

- `test-framework.ts`: Contains the test framework code for running tests and reporting results.
- `run-tests.ts`: The entry point for the standard suites. It runs the files below plus the function-family suites (random, accept, address, binary, digest, query-string, UUID, WAF, rate limiting, HTTP, time, ESI, CSRF), security features, multi-file loading, goto, and the real-world configurations.
- `basic-vcl-tests.ts`: Tests for basic VCL functionality (subroutines, variables, conditionals, etc.).
- `stdlib-tests.ts`: Tests for VCL standard library functions (string manipulation, time functions, etc.).
- `caching-tests.ts`: Tests for caching functionality (TTL, grace periods, etc.).
- `backend-error-tests.ts`: Tests for backend configuration and error handling.

Beyond the standard runner there are separate entry points for the root-level scenarios (`run-root-tests.ts`, in `root-tests/`), the integration tests (`run-integration-tests.ts`, in `integration/`), and a handful of `bun test` suites (tables, crypto compatibility, limits, browser simulation, browser bundle).

## Running Tests

You can run the tests using the following commands:

```bash
# Run the standard test suites
bun run test

# Run everything, including root, integration, tables, crypto compat,
# limits, and the browser suites
bun run test:all

# Run specific test suites
bun run test:basic
bun run test:stdlib
bun run test:caching
bun run test:backend
```

See the `test:*` scripts in `package.json` for the full list of individual suites.

## Adding New Tests

To add a new test, follow these steps:

1. Identify the appropriate test suite file for your test, or create a new one if needed.
2. Add a new test object to the test suite's `tests` array.
3. Provide a name, VCL snippet, run function, and assertions for your test.

Example:

```typescript
{
  name: 'My new test',
  vclSnippet: `
    sub vcl_recv {
      set req.http.X-Test = "Hello, World!";
      return(lookup);
    }
  `,
  run: async (context: VCLContext, subroutines: VCLSubroutines) => {
    // Set up the context
    context.req.url = '/';
    context.req.method = 'GET';
    
    // Execute the subroutine
    executeSubroutine(context, subroutines, 'vcl_recv');
  },
  assertions: [
    // Check if the header was set correctly
    (context: VCLContext) => {
      return assert(
        context.req.http['X-Test'] === 'Hello, World!',
        `Expected X-Test header to be 'Hello, World!', got '${context.req.http['X-Test']}'`
      );
    }
  ]
}
```

## Test Framework API

The test framework provides the following functions:

- `runAllTests(suites)`: Runs all the provided test suites.
- `runTestSuite(suite)`: Runs a single test suite.
- `createMockRequest(url, method, headers)`: Creates a mock VCL context with the specified request properties.
- `executeSubroutine(context, subroutines, name)`: Executes a VCL subroutine with the given context.
- `assert(condition, message)`: Asserts that a condition is true, with a custom error message.

## Test Results

Test results are displayed in the console. Each test is marked as `PASS` or `FAIL` (with its duration), and failed tests include an error message. A summary of the results is displayed at the end of each test suite and at the end of all tests. The process exits non-zero if any test failed.

## Troubleshooting

If a test fails, check the error message for details about what went wrong. Common issues include:

- VCL syntax errors in the test snippet.
- Incorrect assertions.
- Missing or incorrect context setup.
- Issues with the VCL implementation itself.

If you need to debug a test, you can add `console.log` statements to the `run` function to see the state of the context at different points during the test.
