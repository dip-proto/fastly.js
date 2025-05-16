/**
 * VCL Test Framework
 *
 * This file provides a framework for testing VCL functionality
 * with actual VCL code snippets.
 */

import { createVCLContext, executeVCL, loadVCL } from '../src/vcl';
import { VCLContext, VCLSubroutines } from '../src/vcl-compiler';
import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';

// Test result interface
interface TestResult {
  name: string;
  success: boolean;
  message?: string;
  error?: Error;
  duration: number;
}

// Test suite interface
interface TestSuite {
  name: string;
  tests: Test[];
  setup?: () => Promise<void>;
  teardown?: () => Promise<void>;
}

// Test interface
interface Test {
  name: string;
  vclFile?: string;
  vclSnippet?: string;
  run: (context: VCLContext, subroutines: VCLSubroutines) => Promise<void>;
  assertions: Array<(context: VCLContext) => boolean | { success: boolean, message: string }>;
}

// Run a test suite
export async function runTestSuite(suite: TestSuite): Promise<TestResult[]> {
  console.log(`\n=== Running Test Suite: ${suite.name} ===\n`);

  const results: TestResult[] = [];

  // Run setup if provided
  if (suite.setup) {
    try {
      await suite.setup();
    } catch (error) {
      console.error(`Error in setup: ${error.message}`);
      return [
        {
          name: 'Setup',
          success: false,
          message: `Setup failed: ${error.message}`,
          error,
          duration: 0
        }
      ];
    }
  }

  // Run each test
  for (const test of suite.tests) {
    const result = await runTest(test);
    results.push(result);

    // Print result
    if (result.success) {
      console.log(`✅ ${result.name} (${result.duration}ms)`);
    } else {
      console.log(`❌ ${result.name} (${result.duration}ms)`);
      console.log(`   Error: ${result.message}`);
    }
  }

  // Run teardown if provided
  if (suite.teardown) {
    try {
      await suite.teardown();
    } catch (error) {
      console.error(`Error in teardown: ${error.message}`);
      results.push({
        name: 'Teardown',
        success: false,
        message: `Teardown failed: ${error.message}`,
        error,
        duration: 0
      });
    }
  }

  // Print summary
  const successCount = results.filter(r => r.success).length;
  console.log(`\n=== Test Suite Summary: ${suite.name} ===`);
  console.log(`Total: ${results.length}, Passed: ${successCount}, Failed: ${results.length - successCount}`);

  return results;
}

// Run a single test
async function runTest(test: Test): Promise<TestResult> {
  const startTime = Date.now();

  try {
    // Create VCL context
    const context = createVCLContext();

    // Load VCL subroutines
    let subroutines: VCLSubroutines = {};

    if (test.vclFile) {
      // Load from file
      try {
        const vclPath = path.join(process.cwd(), test.vclFile);
        console.log(`Loading VCL file: ${vclPath}`);
        subroutines = loadVCL(vclPath);
      } catch (error) {
        console.error(`Error loading VCL file: ${error.message}`);
        throw error;
      }
    } else if (test.vclSnippet) {
      // Create a temporary file with the VCL snippet
      const tempFile = `./test/temp_${Date.now()}.vcl`;
      fs.writeFileSync(tempFile, test.vclSnippet);

      // Load the VCL from the temporary file
      subroutines = loadVCL(tempFile);

      // Delete the temporary file
      fs.unlinkSync(tempFile);
    }

    // Run the test
    await test.run(context, subroutines);

    // Run assertions
    for (const assertion of test.assertions) {
      const result = assertion(context);

      if (typeof result === 'boolean') {
        if (!result) {
          return {
            name: test.name,
            success: false,
            message: 'Assertion failed',
            duration: Date.now() - startTime
          };
        }
      } else {
        if (!result.success) {
          return {
            name: test.name,
            success: false,
            message: result.message,
            duration: Date.now() - startTime
          };
        }
      }
    }

    return {
      name: test.name,
      success: true,
      duration: Date.now() - startTime
    };
  } catch (error) {
    return {
      name: test.name,
      success: false,
      message: error.message,
      error,
      duration: Date.now() - startTime
    };
  }
}

// Helper function to create a mock request
export function createMockRequest(
  url: string = '/',
  method: string = 'GET',
  headers: Record<string, string> = {}
): VCLContext {
  const context = createVCLContext();

  // Set request properties
  context.req.url = url;
  context.req.method = method;
  context.req.http = { ...headers };

  return context;
}

// Helper function to execute a VCL subroutine
export function executeSubroutine(
  context: VCLContext,
  subroutines: VCLSubroutines,
  subroutineName: string
): string {
  if (!subroutines[subroutineName]) {
    console.log(`Subroutine ${subroutineName} not found, using default behavior`);

    // Create a default subroutine for testing
    if (subroutineName === 'vcl_recv') {
      subroutines[subroutineName] = (ctx) => {
        return 'lookup';
      };
    } else if (subroutineName === 'vcl_deliver') {
      subroutines[subroutineName] = (ctx) => {
        return 'deliver';
      };
    } else if (subroutineName === 'vcl_fetch') {
      subroutines[subroutineName] = (ctx) => {
        return 'deliver';
      };
    } else if (subroutineName === 'vcl_error') {
      subroutines[subroutineName] = (ctx) => {
        return 'deliver';
      };
    }
  }

  return executeVCL(subroutines, subroutineName, context);
}

// Helper function to assert a condition with a message
export function assert(
  condition: boolean,
  message: string
): { success: boolean, message: string } {
  return {
    success: condition,
    message: condition ? 'Success' : message
  };
}

// Run all test suites
export async function runAllTests(suites: TestSuite[]): Promise<void> {
  console.log('=== Running All Test Suites ===\n');

  let totalTests = 0;
  let passedTests = 0;

  for (const suite of suites) {
    const results = await runTestSuite(suite);
    totalTests += results.length;
    passedTests += results.filter(r => r.success).length;
  }

  console.log('\n=== All Tests Complete ===');
  console.log(`Total: ${totalTests}, Passed: ${passedTests}, Failed: ${totalTests - passedTests}`);

  if (totalTests === passedTests) {
    console.log('🎉 All tests passed!');
  } else {
    console.log('❌ Some tests failed.');
    process.exit(1);
  }
}
