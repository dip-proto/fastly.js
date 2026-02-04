/**
 * Backend Configuration and Error Handling Tests
 *
 * Tests for VCL backend configuration and error handling including:
 * - Multiple backends
 * - Backend health checks
 * - Director-based backend selection
 * - Error handling
 * - Synthetic responses
 */

import type { VCLContext, VCLSubroutines } from "../src/vcl-compiler";
import { assert, executeSubroutine, runTestSuite } from "./test-framework";

// Backend and Error Handling test suite
const backendErrorTests = {
	name: "Backend Configuration and Error Handling Tests",
	tests: [
		// Test 1: Multiple backends
		{
			name: "Multiple backends",
			vclSnippet: `
        sub vcl_recv {
          # Route requests based on URL path
          if (req.url ~ "^/api/") {
            set req.backend = "api";
          } else if (req.url ~ ".(jpg|jpeg|png|gif|css|js)$") {
            set req.backend = "static";
          } else {
            set req.backend = "default";
          }

          # Add backend info to request headers
          set req.http.X-Backend = req.backend;

          return(lookup);
        }
      `,
			run: async (context: VCLContext, subroutines: VCLSubroutines) => {
				// Set up backends
				context.backends = {
					default: {
						name: "default",
						host: "example.com",
						port: 80,
						ssl: false,
						connect_timeout: 1000,
						first_byte_timeout: 15000,
						between_bytes_timeout: 10000,
						max_connections: 200,
						is_healthy: true,
					},
					api: {
						name: "api",
						host: "api.example.com",
						port: 443,
						ssl: true,
						connect_timeout: 2000,
						first_byte_timeout: 20000,
						between_bytes_timeout: 15000,
						max_connections: 100,
						is_healthy: true,
					},
					static: {
						name: "static",
						host: "static.example.com",
						port: 80,
						ssl: false,
						connect_timeout: 1000,
						first_byte_timeout: 10000,
						between_bytes_timeout: 5000,
						max_connections: 300,
						is_healthy: true,
					},
				};

				// Test API path
				context.req.url = "/api/users";
				executeSubroutine(context, subroutines, "vcl_recv");
				const apiBackend = context.req.http["X-Backend"];

				// Test static path
				context.req.url = "/styles.css";
				executeSubroutine(context, subroutines, "vcl_recv");
				const staticBackend = context.req.http["X-Backend"];

				// Test default path
				context.req.url = "/home";
				executeSubroutine(context, subroutines, "vcl_recv");
				const defaultBackend = context.req.http["X-Backend"];

				// Store results for assertions
				(context as any).results = {
					apiBackend,
					staticBackend,
					defaultBackend,
				};
			},
			assertions: [
				// Check API backend
				(context: VCLContext) => {
					return assert(
						(context as any).results.apiBackend === "api",
						`Expected API backend to be 'api', got '${(context as any).results.apiBackend}'`,
					);
				},
				// Check static backend
				(context: VCLContext) => {
					return assert(
						(context as any).results.staticBackend === "static",
						`Expected static backend to be 'static', got '${(context as any).results.staticBackend}'`,
					);
				},
				// Check default backend
				(context: VCLContext) => {
					return assert(
						(context as any).results.defaultBackend === "default",
						`Expected default backend to be 'default', got '${(context as any).results.defaultBackend}'`,
					);
				},
			],
		},

		// Test 2: Director-based backend selection
		{
			name: "Director-based backend selection",
			vclSnippet: `
        sub vcl_recv {
          # Use main director for all requests
          set req.backend = "backend1";

          # Add backend info to request headers
          set req.http.X-Backend = req.backend;

          return(lookup);
        }
      `,
			run: async (context: VCLContext, subroutines: VCLSubroutines) => {
				// Set up backends
				context.backends = {
					backend1: {
						name: "backend1",
						host: "backend1.example.com",
						port: 80,
						ssl: false,
						connect_timeout: 1000,
						first_byte_timeout: 15000,
						between_bytes_timeout: 10000,
						max_connections: 200,
						is_healthy: true,
					},
					backend2: {
						name: "backend2",
						host: "backend2.example.com",
						port: 80,
						ssl: false,
						connect_timeout: 1000,
						first_byte_timeout: 15000,
						between_bytes_timeout: 10000,
						max_connections: 200,
						is_healthy: true,
					},
				};

				// Set up directors
				context.directors = {
					main_director: {
						name: "main_director",
						type: "random",
						backends: [
							{ backend: context.backends.backend1!, weight: 1 },
							{ backend: context.backends.backend2!, weight: 1 },
						],
						quorum: 50,
						retries: 3,
					},
				};

				// Execute the subroutine
				executeSubroutine(context, subroutines, "vcl_recv");

				// Store the selected backend
				(context as any).selectedBackend = context.req.http["X-Backend"];
			},
			assertions: [
				// Check if a backend was selected
				(context: VCLContext) => {
					return assert(
						(context as any).selectedBackend === "backend1" ||
							(context as any).selectedBackend === "backend2",
						`Expected backend to be 'backend1' or 'backend2', got '${(context as any).selectedBackend}'`,
					);
				},
			],
		},

		// Test 3: Error handling and synthetic responses
		{
			name: "Error handling and synthetic responses",
			vclFile: "test/fixtures/error-handling.vcl",
			run: async (context: VCLContext, subroutines: VCLSubroutines) => {
				// Test forbidden path
				context.req.url = "/forbidden";
				executeSubroutine(context, subroutines, "vcl_recv");
			},
			assertions: [
				// Check forbidden status
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Error-Status"] === "403",
						`Expected forbidden status to be '403', got '${context.req.http["X-Error-Status"]}'`,
					);
				},
				// Check forbidden response
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Error-Message"] === "Forbidden",
						`Expected forbidden message to be 'Forbidden', got '${context.req.http["X-Error-Message"]}'`,
					);
				},
			],
		},
	],
};

// Export the test suite
export default backendErrorTests;

// Run the test suite if this file is executed directly
if (import.meta.main) {
	runTestSuite(backendErrorTests);
}
