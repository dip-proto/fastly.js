/**
 * VCL File Tests
 *
 * Tests for loading and executing actual VCL files.
 * These tests verify that the VCL parser, compiler, and runtime
 * can correctly process real VCL files.
 */

import type { VCLContext, VCLSubroutines } from "../src/vcl-compiler";
import { assert, executeSubroutine } from "./test-framework";

// VCL File test suite
const vclFileTests = {
	name: "VCL File Tests",
	tests: [
		// Test 1: Basic VCL file
		{
			name: "Basic VCL file",
			vclFile: "test/fixtures/vcl-files/basic.vcl",
			run: async (context: VCLContext, subroutines: VCLSubroutines) => {
				// Test default path
				context.req.url = "/home";
				context.req.method = "GET";

				// Execute vcl_recv
				const _recvResult = executeSubroutine(context, subroutines, "vcl_recv");

				// Execute vcl_deliver
				const _deliverResult = executeSubroutine(
					context,
					subroutines,
					"vcl_deliver",
				);
			},
			assertions: [
				// Check if the header was set correctly
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Test"] === "Hello, World!",
						`Expected X-Test header to be 'Hello, World!', got '${context.req.http["X-Test"]}'`,
					);
				},
				// Check if the default path was handled correctly
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Default"] === "true",
						`Expected X-Default header to be 'true', got '${context.req.http["X-Default"]}'`,
					);
				},
				// Check if the response header was set correctly
				(context: VCLContext) => {
					return assert(
						context.resp.http["X-Powered-By"] === "VCL.js",
						`Expected X-Powered-By header to be 'VCL.js', got '${context.resp.http["X-Powered-By"]}'`,
					);
				},
			],
		},

		// Test 2: API path in basic VCL file
		{
			name: "API path in basic VCL file",
			vclFile: "test/fixtures/vcl-files/basic.vcl",
			run: async (context: VCLContext, subroutines: VCLSubroutines) => {
				// Test API path
				context.req.url = "/api/users";
				context.req.method = "GET";

				// Execute vcl_recv
				const _recvResult = executeSubroutine(context, subroutines, "vcl_recv");
			},
			assertions: [
				// Check if the API path was handled correctly
				(context: VCLContext) => {
					return assert(
						context.req.http["X-API"] === "true",
						`Expected X-API header to be 'true', got '${context.req.http["X-API"]}'`,
					);
				},
			],
		},

		// Test 3: Static path in basic VCL file
		{
			name: "Static path in basic VCL file",
			vclFile: "test/fixtures/vcl-files/basic.vcl",
			run: async (context: VCLContext, subroutines: VCLSubroutines) => {
				// Test static path
				context.req.url = "/static/css/style.css";
				context.req.method = "GET";

				// Execute vcl_recv
				const _recvResult = executeSubroutine(context, subroutines, "vcl_recv");
			},
			assertions: [
				// Check if the static path was handled correctly
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Static"] === "true",
						`Expected X-Static header to be 'true', got '${context.req.http["X-Static"]}'`,
					);
				},
			],
		},

		// Test 4: String functions VCL file
		{
			name: "String functions VCL file",
			vclFile: "test/fixtures/vcl-files/string-functions.vcl",
			run: async (context: VCLContext, subroutines: VCLSubroutines) => {
				// Set up the context
				context.req.url = "/test";
				context.req.method = "GET";

				// Execute vcl_recv
				const _recvResult = executeSubroutine(context, subroutines, "vcl_recv");

				// Execute vcl_deliver
				const _deliverResult = executeSubroutine(
					context,
					subroutines,
					"vcl_deliver",
				);
			},
			assertions: [
				// Check string function results
				(context: VCLContext) => {
					return assert(
						context.req.http["Test-Tolower"] === "hello world",
						`Expected Test-Tolower header to be 'hello world', got '${context.req.http["Test-Tolower"]}'`,
					);
				},
				(context: VCLContext) => {
					return assert(
						context.req.http["Test-Toupper"] === "HELLO WORLD",
						`Expected Test-Toupper header to be 'HELLO WORLD', got '${context.req.http["Test-Toupper"]}'`,
					);
				},
				(context: VCLContext) => {
					return assert(
						context.req.http["Test-Strlen"] === "5",
						`Expected Test-Strlen header to be '5', got '${context.req.http["Test-Strlen"]}'`,
					);
				},
				(context: VCLContext) => {
					return assert(
						context.req.http["Test-Replace"] === "hello universe",
						`Expected Test-Replace header to be 'hello universe', got '${context.req.http["Test-Replace"]}'`,
					);
				},
				// Check if the response header was set correctly
				(context: VCLContext) => {
					return assert(
						context.resp.http["X-String-Functions-Test"] === "Completed",
						`Expected X-String-Functions-Test header to be 'Completed', got '${context.resp.http["X-String-Functions-Test"]}'`,
					);
				},
			],
		},

		// Test 5: Error handling VCL file - forbidden path
		{
			name: "Error handling VCL file - forbidden path",
			vclFile: "test/fixtures/vcl-files/error-handling.vcl",
			run: async (context: VCLContext, subroutines: VCLSubroutines) => {
				// Set up the context for forbidden path
				context.req.url = "/forbidden";
				context.req.method = "GET";

				// Initialize the context.obj
				context.obj = context.obj || {};
				context.obj.http = context.obj.http || {};

				// Execute vcl_recv - this should trigger an error internally
				const recvResult = executeSubroutine(context, subroutines, "vcl_recv");

				// The error should have been handled internally and returned 'error'
				if (recvResult !== "error") {
					throw new Error(
						`Expected recvResult to be 'error', got '${recvResult}'`,
					);
				}

				// No need to manually execute vcl_error or vcl_deliver as they should have been
				// executed by the error handling in the VCL compiler
			},
			assertions: [
				// Check if the error was handled correctly
				(context: VCLContext) => {
					return assert(
						context.obj.status === 403,
						`Expected status to be 403, got ${context.obj.status}`,
					);
				},
				// Check if the error headers were set correctly
				(context: VCLContext) => {
					return assert(
						context.obj.http["X-Error-Type"] === "VCL Error",
						`Expected X-Error-Type header to be 'VCL Error', got '${context.obj.http["X-Error-Type"]}'`,
					);
				},
				(context: VCLContext) => {
					return assert(
						context.obj.http["X-Error-Status"] === "403",
						`Expected X-Error-Status header to be '403', got '${context.obj.http["X-Error-Status"]}'`,
					);
				},
			],
		},
	],
};

export default vclFileTests;
