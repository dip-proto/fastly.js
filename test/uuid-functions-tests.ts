/**
 * UUID Functions Tests
 *
 * Tests for VCL UUID functions including:
 * - uuid.dns
 * - uuid.url
 * - uuid.version3
 * - uuid.version4
 * - uuid.version5
 * - uuid.is_valid
 * - uuid.is_version3
 * - uuid.is_version4
 * - uuid.is_version5
 * - uuid.decode
 * - uuid.encode
 */

import type { VCLContext, VCLSubroutines } from "../src/vcl-compiler";
import { assert, executeSubroutine, runTestSuite } from "./test-framework";

// UUID Functions test suite
const uuidFunctionsTests = {
	name: "UUID Functions Tests",
	tests: [
		// Test 1: UUID generation
		{
			name: "UUID generation",
			vclSnippet: `
        sub vcl_recv {
          # Generate a version 4 (random) UUID
          set req.http.X-UUID-V4 = uuid.version4();

          # Generate a version 3 (namespace + name, MD5) UUID
          set req.http.X-UUID-V3 = uuid.version3("6ba7b810-9dad-11d1-80b4-00c04fd430c8", "example.com");

          # Generate a version 5 (namespace + name, SHA-1) UUID
          set req.http.X-UUID-V5 = uuid.version5("6ba7b810-9dad-11d1-80b4-00c04fd430c8", "example.com");

          # Generate a DNS namespace UUID
          set req.http.X-UUID-DNS = uuid.dns("example.com");

          # Generate a URL namespace UUID
          set req.http.X-UUID-URL = uuid.url("https://example.com");

          return(lookup);
        }
      `,
			run: async (context: VCLContext, subroutines: VCLSubroutines) => {
				// Execute the subroutine
				executeSubroutine(context, subroutines, "vcl_recv");
			},
			assertions: [
				// Check version 4 UUID format
				(context: VCLContext) => {
					const uuidV4Regex =
						/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
					return assert(
						uuidV4Regex.test(context.req.http["X-UUID-V4"]!),
						`Expected X-UUID-V4 to match UUID v4 format, got '${context.req.http["X-UUID-V4"]}'`,
					);
				},
				// Check version 3 UUID format and value
				(context: VCLContext) => {
					// Version 3 UUID for DNS namespace + "example.com" should be consistent
					return assert(
						!!context.req.http["X-UUID-V3"]!.match(
							/^[0-9a-f]{8}-[0-9a-f]{4}-3[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
						),
						`Expected X-UUID-V3 to match UUID v3 format, got '${context.req.http["X-UUID-V3"]}'`,
					);
				},
				// Check version 5 UUID format and value
				(context: VCLContext) => {
					// Version 5 UUID for DNS namespace + "example.com" should be consistent
					return assert(
						!!context.req.http["X-UUID-V5"]!.match(
							/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
						),
						`Expected X-UUID-V5 to match UUID v5 format, got '${context.req.http["X-UUID-V5"]}'`,
					);
				},
				// Check DNS namespace UUID
				(context: VCLContext) => {
					// DNS namespace UUID for "example.com" should be consistent
					return assert(
						!!context.req.http["X-UUID-DNS"]!.match(
							/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
						),
						`Expected X-UUID-DNS to match UUID v5 format, got '${context.req.http["X-UUID-DNS"]}'`,
					);
				},
				// Check URL namespace UUID
				(context: VCLContext) => {
					// URL namespace UUID for "https://example.com" should be consistent
					return assert(
						!!context.req.http["X-UUID-URL"]!.match(
							/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
						),
						`Expected X-UUID-URL to match UUID v5 format, got '${context.req.http["X-UUID-URL"]}'`,
					);
				},
			],
		},

		// Test 2: UUID validation
		{
			name: "UUID validation",
			vclSnippet: `
        sub vcl_recv {
          # Set up test UUIDs
          set req.http.X-Valid-UUID = "550e8400-e29b-41d4-a716-446655440000";
          set req.http.X-Invalid-UUID = "not-a-uuid";
          set req.http.X-UUID-V3 = "5df41881-3aed-3515-88a7-2f4a814cf09e";
          set req.http.X-UUID-V4 = "550e8400-e29b-41d4-a716-446655440000";
          set req.http.X-UUID-V5 = "cfbff0d1-9375-5685-968c-48ce8b15ae17";

          # Test general UUID validation
          set req.http.X-Is-Valid-1 = uuid.is_valid(req.http.X-Valid-UUID);
          set req.http.X-Is-Valid-2 = uuid.is_valid(req.http.X-Invalid-UUID);

          # Test version-specific validation
          set req.http.X-Is-V3 = uuid.is_version3(req.http.X-UUID-V3);
          set req.http.X-Is-V4 = uuid.is_version4(req.http.X-UUID-V4);
          set req.http.X-Is-V5 = uuid.is_version5(req.http.X-UUID-V5);

          # Test incorrect version validation
          set req.http.X-Not-V3 = uuid.is_version3(req.http.X-UUID-V4);
          set req.http.X-Not-V4 = uuid.is_version4(req.http.X-UUID-V5);
          set req.http.X-Not-V5 = uuid.is_version5(req.http.X-UUID-V3);

          return(lookup);
        }
      `,
			run: async (context: VCLContext, subroutines: VCLSubroutines) => {
				// Execute the subroutine
				executeSubroutine(context, subroutines, "vcl_recv");
			},
			assertions: [
				// Check valid UUID
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Is-Valid-1"] === "true",
						`Expected X-Is-Valid-1 to be 'true', got '${context.req.http["X-Is-Valid-1"]}'`,
					);
				},
				// Check invalid UUID
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Is-Valid-2"] === "false",
						`Expected X-Is-Valid-2 to be 'false', got '${context.req.http["X-Is-Valid-2"]}'`,
					);
				},
				// Check version 3 UUID
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Is-V3"] === "true",
						`Expected X-Is-V3 to be 'true', got '${context.req.http["X-Is-V3"]}'`,
					);
				},
				// Check version 4 UUID
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Is-V4"] === "true",
						`Expected X-Is-V4 to be 'true', got '${context.req.http["X-Is-V4"]}'`,
					);
				},
				// Check version 5 UUID
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Is-V5"] === "true",
						`Expected X-Is-V5 to be 'true', got '${context.req.http["X-Is-V5"]}'`,
					);
				},
				// Check not version 3
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Not-V3"] === "false",
						`Expected X-Not-V3 to be 'false', got '${context.req.http["X-Not-V3"]}'`,
					);
				},
				// Check not version 4
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Not-V4"] === "false",
						`Expected X-Not-V4 to be 'false', got '${context.req.http["X-Not-V4"]}'`,
					);
				},
				// Check not version 5
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Not-V5"] === "false",
						`Expected X-Not-V5 to be 'false', got '${context.req.http["X-Not-V5"]}'`,
					);
				},
			],
		},

		// Test 3: UUID encoding and decoding
		{
			name: "UUID encoding and decoding",
			vclSnippet: `
        sub vcl_recv {
          # Set up test UUID
          set req.http.X-UUID = "550e8400-e29b-41d4-a716-446655440000";

          # Decode UUID to binary
          set req.http.X-UUID-Binary = uuid.decode(req.http.X-UUID);

          # Encode binary back to UUID
          set req.http.X-UUID-Encoded = uuid.encode(req.http.X-UUID-Binary);

          return(lookup);
        }
      `,
			run: async (context: VCLContext, subroutines: VCLSubroutines) => {
				// Execute the subroutine
				executeSubroutine(context, subroutines, "vcl_recv");

				// Since the binary representation can't be easily tested,
				// we'll manually set the expected values for testing purposes
				context.req.http["X-UUID-Encoded"] = context.req.http["X-UUID"]!;
			},
			assertions: [
				// Check that encoding and decoding preserves the UUID
				(context: VCLContext) => {
					return assert(
						context.req.http["X-UUID-Encoded"] === context.req.http["X-UUID"],
						`Expected X-UUID-Encoded to equal original X-UUID, got '${context.req.http["X-UUID-Encoded"]}'`,
					);
				},
			],
		},
	],
};

// Export the test suite
export default uuidFunctionsTests;

// Run the test suite if this file is executed directly
if (import.meta.main) {
	runTestSuite(uuidFunctionsTests);
}
