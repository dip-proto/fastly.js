/**
 * VCL Root Tests Runner
 *
 * This file runs all the test files that were moved from the root directory.
 */

import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

// Get all test files
const testDir = path.join(__dirname, 'root-tests');
const testFiles = fs.readdirSync(testDir)
  .filter(file => file.endsWith('.ts'))
  .map(file => path.join(testDir, file));

console.log('=== Running Root Tests ===\n');
console.log(`Found ${testFiles.length} test files to run\n`);

// Run each test file
async function runTestFile(file: string): Promise<boolean> {
  return new Promise((resolve) => {
    console.log(`Running test: ${path.basename(file)}`);
    
    const process = spawn('bun', ['run', file], {
      stdio: 'inherit'
    });
    
    process.on('close', (code) => {
      const success = code === 0;
      console.log(`Test ${path.basename(file)} ${success ? 'passed ✅' : 'failed ❌'}\n`);
      resolve(success);
    });
  });
}

async function runAllTests() {
  let passed = 0;
  let failed = 0;
  
  for (const file of testFiles) {
    const success = await runTestFile(file);
    if (success) {
      passed++;
    } else {
      failed++;
    }
  }
  
  console.log('=== Root Tests Complete ===');
  console.log(`Total: ${testFiles.length}, Passed: ${passed}, Failed: ${failed}`);
  
  if (failed === 0) {
    console.log('🎉 All root tests passed!');
  } else {
    console.log('❌ Some root tests failed.');
    process.exit(1);
  }
}

// Run the tests
runAllTests().catch(error => {
  console.error('Error running tests:', error);
  process.exit(1);
});
