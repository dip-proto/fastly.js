# VCL Test Suite

This directory contains a comprehensive test suite for the VCL implementation. The tests use actual VCL code snippets to verify that the VCL parser, compiler, and runtime are working correctly.

## Test Structure

The test suite is organized into several files:

- `test-framework.ts`: Contains the test framework code for running tests and reporting results.
- `run-tests.ts`: The main entry point for running all tests.
- `basic-vcl-tests.ts`: Tests for basic VCL functionality (subroutines, variables, conditionals, etc.).
- `stdlib-tests.ts`: Tests for VCL standard library functions (string manipulation, time functions, etc.).
- `caching-tests.ts`: Tests for caching functionality (TTL, grace periods, etc.).
- `backend-error-tests.ts`: Tests for backend configuration and error handling.

## Running Tests

You can run the tests using the following commands:

```bash
# Run all tests
bun run test

# Run specific test suites
bun run test:basic
bun run test:stdlib
bun run test:caching
bun run test:backend
```

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

Test results are displayed in the console. Each test is marked as passed (✅) or failed (❌), with error messages for failed tests. A summary of the results is displayed at the end of each test suite and at the end of all tests.

## Troubleshooting

If a test fails, check the error message for details about what went wrong. Common issues include:

- VCL syntax errors in the test snippet.
- Incorrect assertions.
- Missing or incorrect context setup.
- Issues with the VCL implementation itself.

If you need to debug a test, you can add `console.log` statements to the `run` function to see the state of the context at different points during the test.
