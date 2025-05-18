/**
 * Integration test for A/B testing using restart
 */

import {loadVCL, createVCLContext, executeVCL} from '../../src/vcl';

// Load the VCL file
console.log('Loading A/B testing VCL file...');
const subroutines = loadVCL('./test/fixtures/restart/ab_testing.vcl');

// Print the loaded subroutines
console.log('Loaded subroutines:');
console.log(Object.keys(subroutines));

// Mock the random function to control test assignment
const originalRandomBool = global.randombool;
let mockRandomResult = true; // Default to A (true = 70% case)

global.randombool = (numerator: number, denominator: number) => {
  console.log(`Mock randombool called with ${ numerator }/${ denominator }`);
  return mockRandomResult;
};

// Test cases for A/B testing
const testCases = [
  {
    name: 'Homepage test with existing cookie (A)',
    url: '/',
    cookies: {'AB_Test': 'A'},
    randomResult: true,
    expectedVersion: 'A',
    expectedBackend: 'version_a',
    expectedRestarts: 1,
    expectedReasons: ['homepage_test_assignment']
  },
  {
    name: 'Homepage test with existing cookie (B)',
    url: '/',
    cookies: {'AB_Test': 'B'},
    randomResult: true,
    expectedVersion: 'B',
    expectedBackend: 'version_b',
    expectedUrl: '/homepage-b/',
    expectedRestarts: 1,
    expectedReasons: ['homepage_test_assignment']
  },
  {
    name: 'Homepage test with random assignment (A)',
    url: '/',
    cookies: {},
    randomResult: true, // 70% case
    expectedVersion: 'A',
    expectedBackend: 'version_a',
    expectedRestarts: 1,
    expectedReasons: ['homepage_test_assignment']
  },
  {
    name: 'Homepage test with random assignment (B)',
    url: '/',
    cookies: {},
    randomResult: false, // 30% case
    expectedVersion: 'B',
    expectedBackend: 'version_b',
    expectedUrl: '/homepage-b/',
    expectedRestarts: 1,
    expectedReasons: ['homepage_test_assignment']
  },
  {
    name: 'Checkout test with user ID cookie (A)',
    url: '/checkout',
    cookies: {'user_id': 'user123'},
    userHashResult: 'a1b2c3', // 'a' comes before 'f'
    expectedVersion: 'A',
    expectedBackend: 'version_a',
    expectedRestarts: 1,
    expectedReasons: ['checkout_test_assignment']
  },
  {
    name: 'Checkout test with user ID cookie (B)',
    url: '/checkout',
    cookies: {'user_id': 'user456'},
    userHashResult: 'f1a2b3', // 'f' comes before 'a'
    expectedVersion: 'B',
    expectedBackend: 'version_b',
    expectedUrl: '/checkout?version=B',
    expectedRestarts: 1,
    expectedReasons: ['checkout_test_assignment']
  }
];

// Run the tests
function runTests() {
  console.log('=== Running A/B Testing Tests ===\n');

  let passedTests = 0;
  let failedTests = 0;

  // Mock the hash function for user ID based assignment
  const originalHashSha1 = global.digest.hash_sha1;
  global.digest.hash_sha1 = (input: string) => {
    console.log(`Mock hash_sha1 called with ${ input }`);
    // Return the test-specific hash result
    const testCase = testCases.find(tc => tc.cookies?.user_id === input);
    return testCase?.userHashResult || 'default_hash';
  };

  for (const testCase of testCases) {
    console.log(`Test: ${ testCase.name }`);
    console.log(`Input URL: ${ testCase.url }`);
    console.log(`Cookies: ${ JSON.stringify(testCase.cookies) }`);

    // Set the mock random result for this test
    mockRandomResult = testCase.randomResult;

    // Create a context
    const context = createVCLContext();
    context.req.url = testCase.url;
    context.req.method = 'GET';
    context.req.http = {
      'Host': 'example.com',
      'User-Agent': 'Mozilla/5.0'
    };

    // Set up backends
    context.backends = {
      version_a: {name: 'version_a'},
      version_b: {name: 'version_b'}
    };

    // Add cookies
    if (Object.keys(testCase.cookies || {}).length > 0) {
      let cookieStr = '';
      for (const [name, value] of Object.entries(testCase.cookies || {})) {
        if (cookieStr) cookieStr += '; ';
        cookieStr += `${ name }=${ value }`;
      }
      context.req.http['Cookie'] = cookieStr;
    }

    // Initialize tracking variables
    let restartCount = 0;
    let restartReasons: string[] = [];

    // Initialize tables
    context.tables = {
      feature_flags: {
        homepage_redesign: 'active',
        new_checkout: 'active',
        personalization: 'inactive'
      }
    };

    // Process the request with support for restarts
    let processRequest = async () => {
      // Execute vcl_recv
      console.log(`Executing vcl_recv (restart ${ restartCount })...`);
      const recvResult = executeVCL(subroutines, 'vcl_recv', context);

      console.log(`vcl_recv returned: ${ recvResult }`);
      console.log(`Current URL: ${ context.req.url }`);
      console.log(`Selected backend: ${ context.req.backend }`);
      console.log(`AB Test: ${ context.req.http['X-AB-Test'] }`);
      console.log(`Selected Version: ${ context.req.http['X-Selected-Version'] }`);

      if (context.req.http['X-Restart-Reason']) {
        restartReasons.push(context.req.http['X-Restart-Reason']);
        console.log(`Restart reason: ${ context.req.http['X-Restart-Reason'] }`);
      }

      // Handle restart action
      if (recvResult === 'restart') {
        // Increment the restart counter
        restartCount++;
        context.req.restarts = restartCount;

        // Process the request again
        return await processRequest();
      }

      return recvResult;
    };

    // Start processing the request
    processRequest().then(() => {
      console.log(`Final URL: ${ context.req.url }`);
      console.log(`Final backend: ${ context.req.backend }`);
      console.log(`AB Test: ${ context.req.http['X-AB-Test'] }`);
      console.log(`Selected Version: ${ context.req.http['X-Selected-Version'] }`);
      console.log(`Restart count: ${ restartCount }`);
      console.log(`Restart reasons: ${ restartReasons.join(', ') }`);

      // Verify the results
      let passed = true;

      if (testCase.expectedUrl && context.req.url !== testCase.expectedUrl) {
        console.log(`❌ URL mismatch: expected ${ testCase.expectedUrl }, got ${ context.req.url }`);
        passed = false;
      }

      if (context.req.backend !== testCase.expectedBackend) {
        console.log(`❌ Backend mismatch: expected ${ testCase.expectedBackend }, got ${ context.req.backend }`);
        passed = false;
      }

      if (context.req.http['X-Selected-Version'] !== testCase.expectedVersion) {
        console.log(`❌ Version mismatch: expected ${ testCase.expectedVersion }, got ${ context.req.http['X-Selected-Version'] }`);
        passed = false;
      }

      if (restartCount !== testCase.expectedRestarts) {
        console.log(`❌ Restart count mismatch: expected ${ testCase.expectedRestarts }, got ${ restartCount }`);
        passed = false;
      }

      if (restartReasons.length !== testCase.expectedReasons.length) {
        console.log(`❌ Restart reasons count mismatch: expected ${ testCase.expectedReasons.length }, got ${ restartReasons.length }`);
        passed = false;
      } else {
        for (let i = 0; i < restartReasons.length; i++) {
          if (restartReasons[i] !== testCase.expectedReasons[i]) {
            console.log(`❌ Restart reason mismatch at index ${ i }: expected ${ testCase.expectedReasons[i] }, got ${ restartReasons[i] }`);
            passed = false;
          }
        }
      }

      if (passed) {
        console.log('✅ Test passed');
        passedTests++;
      } else {
        console.log('❌ Test failed');
        failedTests++;
      }

      console.log('\n---\n');

      // If this is the last test, print the summary
      if (passedTests + failedTests === testCases.length) {
        console.log('=== Test Summary ===');
        console.log(`Total tests: ${ testCases.length }`);
        console.log(`Passed: ${ passedTests }`);
        console.log(`Failed: ${ failedTests }`);

        if (failedTests === 0) {
          console.log('✅ All tests passed');
        } else {
          console.log('❌ Some tests failed');
        }

        // Restore the original functions
        global.randombool = originalRandomBool;
        global.digest.hash_sha1 = originalHashSha1;
      }
    });
  }
}

// Run the tests
runTests();
