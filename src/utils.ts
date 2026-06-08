/**
 * Utility functions for the VCL parser and executor
 */

import { logError } from "./platform";

export function assert(condition: boolean, message: string): { success: boolean; message: string } {
	if (!condition) {
		logError(`Assertion failed: ${message}`);
	}
	return condition ? { success: true, message: "Assertion passed" } : { success: false, message };
}
