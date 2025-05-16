/**
 * VCL Test Runner
 *
 * This file runs all the test suites for the VCL implementation.
 */

import { runAllTests } from './test-framework';
import basicVCLTests from './basic-vcl-tests';
import stdlibTests from './stdlib-tests';
import cachingTests from './caching-tests';
import backendErrorTests from './backend-error-tests';
import randomFunctionsTests from './random-functions-tests';

// Run all test suites
async function runTests() {
  await runAllTests([
    basicVCLTests,
    stdlibTests,
    cachingTests,
    backendErrorTests,
    randomFunctionsTests
  ]);
}

// Run the tests
runTests().catch(error => {
  console.error('Error running tests:', error);
  process.exit(1);
});
