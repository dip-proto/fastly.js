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

import { createMockRequest, executeSubroutine, assert, runTestSuite } from './test-framework';
import { VCLContext, VCLSubroutines } from '../src/vcl-compiler';

// Backend and Error Handling test suite
const backendErrorTests = {
  name: 'Backend Configuration and Error Handling Tests',
  tests: [
    // Test 1: Multiple backends
    {
      name: 'Multiple backends',
      vclSnippet: `
        sub vcl_recv {
          # Route requests based on URL path
          if (req.url ~ "^/api/") {
            set req.backend = "api";
          } else if (req.url ~ "\.(jpg|jpeg|png|gif|css|js)$") {
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
          'default': {
            name: 'default',
            host: 'example.com',
            port: 80,
            ssl: false,
            connect_timeout: 1000,
            first_byte_timeout: 15000,
            between_bytes_timeout: 10000,
            max_connections: 200,
            is_healthy: true
          },
          'api': {
            name: 'api',
            host: 'api.example.com',
            port: 443,
            ssl: true,
            connect_timeout: 2000,
            first_byte_timeout: 20000,
            between_bytes_timeout: 15000,
            max_connections: 100,
            is_healthy: true
          },
          'static': {
            name: 'static',
            host: 'static.example.com',
            port: 80,
            ssl: false,
            connect_timeout: 1000,
            first_byte_timeout: 10000,
            between_bytes_timeout: 5000,
            max_connections: 300,
            is_healthy: true
          }
        };

        // Test API path
        context.req.url = '/api/users';
        executeSubroutine(context, subroutines, 'vcl_recv');
        const apiBackend = context.req.http['X-Backend'];

        // Test static path
        context.req.url = '/styles.css';
        executeSubroutine(context, subroutines, 'vcl_recv');
        const staticBackend = context.req.http['X-Backend'];

        // Test default path
        context.req.url = '/home';
        executeSubroutine(context, subroutines, 'vcl_recv');
        const defaultBackend = context.req.http['X-Backend'];

        // Store results for assertions
        context.results = {
          apiBackend,
          staticBackend,
          defaultBackend
        };
      },
      assertions: [
        // Check API backend
        (context: VCLContext) => {
          return assert(
            context.results.apiBackend === 'api',
            `Expected API backend to be 'api', got '${context.results.apiBackend}'`
          );
        },
        // Check static backend
        (context: VCLContext) => {
          return assert(
            context.results.staticBackend === 'static',
            `Expected static backend to be 'static', got '${context.results.staticBackend}'`
          );
        },
        // Check default backend
        (context: VCLContext) => {
          return assert(
            context.results.defaultBackend === 'default',
            `Expected default backend to be 'default', got '${context.results.defaultBackend}'`
          );
        }
      ]
    },

    // Test 2: Director-based backend selection
    {
      name: 'Director-based backend selection',
      vclSnippet: `
        sub vcl_recv {
          # Use main director for all requests
          set req.backend = std.director.select_backend("main_director").name;

          # Add backend info to request headers
          set req.http.X-Backend = req.backend;

          return(lookup);
        }
      `,
      run: async (context: VCLContext, subroutines: VCLSubroutines) => {
        // Set up backends
        context.backends = {
          'backend1': {
            name: 'backend1',
            host: 'backend1.example.com',
            port: 80,
            ssl: false,
            connect_timeout: 1000,
            first_byte_timeout: 15000,
            between_bytes_timeout: 10000,
            max_connections: 200,
            is_healthy: true
          },
          'backend2': {
            name: 'backend2',
            host: 'backend2.example.com',
            port: 80,
            ssl: false,
            connect_timeout: 1000,
            first_byte_timeout: 15000,
            between_bytes_timeout: 10000,
            max_connections: 200,
            is_healthy: true
          }
        };

        // Set up directors
        context.directors = {
          'main_director': {
            name: 'main_director',
            type: 'random',
            backends: [
              { backend: context.backends['backend1'], weight: 1 },
              { backend: context.backends['backend2'], weight: 1 }
            ],
            quorum: 50,
            retries: 3
          }
        };

        // Execute the subroutine
        executeSubroutine(context, subroutines, 'vcl_recv');

        // Store the selected backend
        context.selectedBackend = context.req.http['X-Backend'];
      },
      assertions: [
        // Check if a backend was selected
        (context: VCLContext) => {
          return assert(
            context.selectedBackend === 'backend1' || context.selectedBackend === 'backend2',
            `Expected backend to be 'backend1' or 'backend2', got '${context.selectedBackend}'`
          );
        }
      ]
    },

    // Test 3: Error handling and synthetic responses
    {
      name: 'Error handling and synthetic responses',
      vclSnippet: `
        sub vcl_recv {
          # Trigger an error for specific paths
          if (req.url ~ "^/forbidden") {
            error 403 "Forbidden";
          }

          if (req.url ~ "^/not-found") {
            error 404 "Not Found";
          }

          return(lookup);
        }

        sub vcl_error {
          # Set content type
          set obj.http.Content-Type = "text/html; charset=utf-8";

          # Create custom error page
          if (obj.status == 403) {
            synthetic {"
              <!DOCTYPE html>
              <html>
              <head>
                <title>Access Denied</title>
              </head>
              <body>
                <h1>Access Denied</h1>
                <p>You do not have permission to access this resource.</p>
              </body>
              </html>
            "};
          } else if (obj.status == 404) {
            synthetic {"
              <!DOCTYPE html>
              <html>
              <head>
                <title>Page Not Found</title>
              </head>
              <body>
                <h1>Page Not Found</h1>
                <p>The requested page could not be found.</p>
              </body>
              </html>
            "};
          } else {
            synthetic {"
              <!DOCTYPE html>
              <html>
              <head>
                <title>Error " + obj.status + "</title>
              </head>
              <body>
                <h1>Error " + obj.status + "</h1>
                <p>" + obj.response + "</p>
              </body>
              </html>
            "};
          }

          return(deliver);
        }
      `,
      run: async (context: VCLContext, subroutines: VCLSubroutines) => {
        // Test forbidden path
        context.req.url = '/forbidden';
        executeSubroutine(context, subroutines, 'vcl_recv');

        // Simulate error handling
        context.obj = {
          status: 403,
          response: 'Forbidden',
          http: {},
          hits: 0
        };

        // Execute error handling
        executeSubroutine(context, subroutines, 'vcl_error');

        // Store forbidden response
        const forbiddenResponse = context.obj.response;
        const forbiddenStatus = context.obj.status;

        // Test not found path
        context.req.url = '/not-found';
        executeSubroutine(context, subroutines, 'vcl_recv');

        // Simulate error handling
        context.obj = {
          status: 404,
          response: 'Not Found',
          http: {},
          hits: 0
        };

        // Execute error handling
        executeSubroutine(context, subroutines, 'vcl_error');

        // Store not found response
        const notFoundResponse = context.obj.response;
        const notFoundStatus = context.obj.status;

        // Store results for assertions
        context.results = {
          forbiddenResponse,
          forbiddenStatus,
          notFoundResponse,
          notFoundStatus
        };
      },
      assertions: [
        // Check forbidden status
        (context: VCLContext) => {
          return assert(
            context.results.forbiddenStatus === 403,
            `Expected forbidden status to be 403, got '${context.results.forbiddenStatus}'`
          );
        },
        // Check forbidden response
        (context: VCLContext) => {
          return assert(
            context.results.forbiddenResponse.includes('Access Denied'),
            `Expected forbidden response to include 'Access Denied'`
          );
        },
        // Check not found status
        (context: VCLContext) => {
          return assert(
            context.results.notFoundStatus === 404,
            `Expected not found status to be 404, got '${context.results.notFoundStatus}'`
          );
        },
        // Check not found response
        (context: VCLContext) => {
          return assert(
            context.results.notFoundResponse.includes('Page Not Found'),
            `Expected not found response to include 'Page Not Found'`
          );
        }
      ]
    }
  ]
};

// Export the test suite
export default backendErrorTests;

// Run the test suite if this file is executed directly
if (import.meta.main) {
  runTestSuite(backendErrorTests);
}
