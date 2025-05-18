/**
 * Utility functions for the VCL parser and executor
 */

/**
 * Assert function for testing
 * 
 * @param condition - The condition to assert
 * @param message - The message to display if the assertion fails
 * @returns An object with the result of the assertion
 */
export function assert(condition: boolean, message: string): { success: boolean, message: string } {
  if (condition) {
    return { success: true, message: 'Assertion passed' };
  } else {
    console.error(`Assertion failed: ${message}`);
    return { success: false, message };
  }
}
