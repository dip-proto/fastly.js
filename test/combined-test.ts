/**
 * Combined Test
 * 
 * Runs all of our tests
 */

import { runAllTests } from './test-framework';
import backendAssignmentTest from './backend-assignment-simple';
import securityHeadersTest from './security-headers-test';
import cachingBehaviorTest from './caching-behavior-test';

// Run all tests
runAllTests([
  backendAssignmentTest,
  securityHeadersTest,
  cachingBehaviorTest
]);
