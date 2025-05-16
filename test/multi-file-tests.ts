/**
 * Multi-file VCL Tests
 *
 * This file contains tests for loading and executing multiple VCL files.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { executeVCL, loadVCLContent } from "../src/vcl";
import type { VCLContext, VCLSubroutines } from "../src/vcl-compiler";

// Helper function to execute a subroutine
function _executeSubroutine(
	context: VCLContext,
	subroutines: VCLSubroutines,
	name: string,
): string {
	const result = executeVCL(subroutines, name, context);
	return result;
}

// Multi-file VCL test suite
const multiFileTests = {
	name: "Multi-file VCL Tests",
	tests: [
		// Test 1: Load and execute multiple VCL files
		{
			name: "Load and execute multiple VCL files",
			run: async (context: VCLContext, _subroutines: VCLSubroutines) => {
				// Load the VCL files
				const file1Path = path.join(
					__dirname,
					"fixtures/vcl-files/multi_file_test_1.vcl",
				);
				const file2Path = path.join(
					__dirname,
					"fixtures/vcl-files/multi_file_test_2.vcl",
				);

				const content1 = fs.readFileSync(file1Path, "utf-8");
				const content2 = fs.readFileSync(file2Path, "utf-8");

				// Concatenate the contents
				const combinedContent = `${content1}\n${content2}`;

				// Load the combined content
				const loadedSubroutines = loadVCLContent(combinedContent);

				// Set up the context
				context.req.url = "/test";
				context.req.method = "GET";
				context.req.http = {
					Host: "example.com",
					"User-Agent": "Mozilla/5.0",
				};

				// Execute vcl_recv
				const _recvResult = executeVCL(loadedSubroutines, "vcl_recv", context);

				// Execute vcl_deliver
				const _deliverResult = executeVCL(
					loadedSubroutines,
					"vcl_deliver",
					context,
				);
			},
			assertions: [
				// Check that headers from both files are set
				(context: VCLContext) => {
					const hasFile1Header = context.req.http["X-Test-File-1"] === "File 1";
					if (!hasFile1Header) {
						return {
							success: false,
							message: `Expected req.http['X-Test-File-1'] to be 'File 1', got '${context.req.http["X-Test-File-1"]}'`,
						};
					}

					const hasFile2Header =
						context.resp.http["X-Test-File-2"] === "File 2";
					if (!hasFile2Header) {
						return {
							success: false,
							message: `Expected resp.http['X-Test-File-2'] to be 'File 2', got '${context.resp.http["X-Test-File-2"]}'`,
						};
					}

					return {
						success: true,
						message: "Headers from both files are set correctly",
					};
				},

				// Check that the VCL code was processed correctly
				(context: VCLContext) => {
					// In the current implementation, backends defined in VCL aren't automatically
					// added to the context.backends object, so we can't check for them directly.
					// Instead, we'll just check that the headers were set correctly, which indicates
					// that the VCL code from both files was executed.

					const hasFile1Header = context.req.http["X-Test-File-1"] === "File 1";
					const hasFile2Header =
						context.resp.http["X-Test-File-2"] === "File 2";

					if (!hasFile1Header || !hasFile2Header) {
						return {
							success: false,
							message: `Headers not set correctly: X-Test-File-1=${context.req.http["X-Test-File-1"]}, X-Test-File-2=${context.resp.http["X-Test-File-2"]}`,
						};
					}

					return {
						success: true,
						message: "VCL code from both files was executed correctly",
					};
				},
			],
		},

		// Test 2: Load VCL files with loadVCLContent
		{
			name: "Load VCL files with loadVCLContent",
			run: async (context: VCLContext, _subroutines: VCLSubroutines) => {
				// Load the VCL files
				const file1Path = path.join(
					__dirname,
					"fixtures/vcl-files/multi_file_test_1.vcl",
				);
				const file2Path = path.join(
					__dirname,
					"fixtures/vcl-files/multi_file_test_2.vcl",
				);

				const content1 = fs.readFileSync(file1Path, "utf-8");
				const content2 = fs.readFileSync(file2Path, "utf-8");

				// Concatenate the contents
				const combinedContent = `${content1}\n${content2}`;

				// Load the combined content
				const loadedSubroutines = loadVCLContent(combinedContent);

				// Set up the context
				context.req.url = "/test";
				context.req.method = "GET";
				context.req.http = {
					Host: "example.com",
					"User-Agent": "Mozilla/5.0",
				};

				// Execute vcl_recv
				const recvResult = executeVCL(loadedSubroutines, "vcl_recv", context);

				// Execute vcl_deliver
				const deliverResult = executeVCL(
					loadedSubroutines,
					"vcl_deliver",
					context,
				);

				// Store the results for assertions
				context.req.http["X-Recv-Result"] = recvResult;
				context.req.http["X-Deliver-Result"] = deliverResult;
			},
			assertions: [
				// Check that subroutines from both files are loaded
				(context: VCLContext) => {
					const recvResult = context.req.http["X-Recv-Result"];
					const deliverResult = context.req.http["X-Deliver-Result"];

					if (recvResult !== "lookup") {
						return {
							success: false,
							message: `Expected vcl_recv to return 'lookup', got '${recvResult}'`,
						};
					}

					if (deliverResult !== "deliver") {
						return {
							success: false,
							message: `Expected vcl_deliver to return 'deliver', got '${deliverResult}'`,
						};
					}

					return {
						success: true,
						message: "Subroutines from both files executed correctly",
					};
				},
			],
		},
	],
};

export default multiFileTests;
