/**
 * VCL Test Runner
 *
 * This file runs all the test suites for the VCL implementation.
 */

import {runAllTests} from './test-framework';
import basicVCLTests from './basic-vcl-tests';
import stdlibTests from './stdlib-tests';
import cachingTests from './caching-tests';
import backendErrorTests from './backend-error-tests';
import randomFunctionsTests from './random-functions-tests';
import vclFileTests from './vcl-file-tests';
import securityFeaturesTests from './security-features-tests';
import acceptHeaderFunctionsTests from './accept-header-functions-tests';
import addressFunctionsTests from './address-functions-tests';
import binaryDataFunctionsTests from './binary-data-functions-tests';
import digestFunctionsTests from './digest-functions-tests';
import queryStringFunctionsTests from './query-string-functions-tests';
import uuidFunctionsTests from './uuid-functions-tests';
import wafFunctionsTests from './waf-functions-tests';

// Run all test suites
async function runTests() {
  await runAllTests([
    basicVCLTests,
    stdlibTests,
    cachingTests,
    backendErrorTests,
    randomFunctionsTests,
    vclFileTests,
    securityFeaturesTests,
    acceptHeaderFunctionsTests,
    addressFunctionsTests,
    binaryDataFunctionsTests,
    digestFunctionsTests,
    queryStringFunctionsTests,
    uuidFunctionsTests,
    wafFunctionsTests
  ]);
}

// Run the tests
runTests().catch(error => {
  console.error('Error running tests:', error);
  process.exit(1);
});
