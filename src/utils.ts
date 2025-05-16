/**
 * Utility functions for the VCL parser and executor
 */

export function assert(
	condition: boolean,
	message: string,
): { success: boolean; message: string } {
	if (!condition) {
		console.error(`Assertion failed: ${message}`);
	}
	return condition
		? { success: true, message: "Assertion passed" }
		: { success: false, message };
}
