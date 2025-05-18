/**
 * Run the goto tests
 */

import { runAllTests } from './test-framework';
import { gotoTests } from './goto-tests';

async function main() {
  await runAllTests([gotoTests]);
}

main().catch(error => {
  console.error('Error running tests:', error);
  process.exit(1);
});
