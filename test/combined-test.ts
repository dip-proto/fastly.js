/**
 * Combined Test
 *
 * Runs all of our tests
 */

import backendAssignmentTest from "./backend-assignment-simple";
import cachingBehaviorTest from "./caching-behavior-test";
import securityHeadersTest from "./security-headers-test";
import { runAllTests } from "./test-framework";

// Run all tests
runAllTests([backendAssignmentTest, securityHeadersTest, cachingBehaviorTest]);
