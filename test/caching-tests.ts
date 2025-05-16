/**
 * Caching Tests
 *
 * Tests for VCL caching functionality including:
 * - Cache hits and misses
 * - TTL settings
 * - Grace periods
 * - Stale-while-revalidate
 * - Cache invalidation
 */

import { createMockRequest, executeSubroutine, assert, runTestSuite } from './test-framework';
import { VCLContext, VCLSubroutines } from '../src/vcl-compiler';

// Caching test suite
const cachingTests = {
  name: 'Caching Tests',
  tests: [
    // Test 1: Basic caching
    {
      name: 'Basic caching',
      vclSnippet: `
        sub vcl_recv {
          return(lookup);
        }

        sub vcl_fetch {
          # Set TTL to 1 hour
          set beresp.ttl = 3600s;
          return(deliver);
        }

        sub vcl_deliver {
          # Add cache status header
          if (obj.hits > 0) {
            set resp.http.X-Cache = "HIT";
            set resp.http.X-Cache-Hits = obj.hits;
          } else {
            set resp.http.X-Cache = "MISS";
          }
          return(deliver);
        }
      `,
      run: async (context: VCLContext, subroutines: VCLSubroutines) => {
        // Set up the context
        context.req.url = '/cached-page';
        context.req.method = 'GET';

        // Simulate a cache miss
        context.cache = new Map();

        // Execute the request flow
        executeSubroutine(context, subroutines, 'vcl_recv');

        // Simulate backend response
        context.beresp.status = 200;
        context.beresp.statusText = 'OK';
        context.beresp.http = {
          'content-type': 'text/html',
          'content-length': '1024'
        };

        // Execute fetch
        executeSubroutine(context, subroutines, 'vcl_fetch');

        // Update response
        context.resp.status = context.beresp.status;
        context.resp.statusText = context.beresp.statusText;
        context.resp.http = { ...context.beresp.http };

        // Execute deliver
        executeSubroutine(context, subroutines, 'vcl_deliver');

        // Cache the response
        const cacheKey = `${context.req.url}:${context.req.http['host'] || 'localhost'}`;
        context.cache.set(cacheKey, {
          resp: { ...context.resp },
          body: new ArrayBuffer(0),
          created: Date.now(),
          expires: Date.now() + (context.beresp.ttl * 1000),
          staleUntil: Date.now() + (context.beresp.ttl * 1000) + 3600000,
          beresp: { ...context.beresp },
          hits: 0
        });

        // Simulate a cache hit
        const cachedResponse = context.cache.get(cacheKey);
        cachedResponse.hits = 1;

        // Create a new context for the cache hit
        const hitContext = createMockRequest('/cached-page');
        hitContext.cache = context.cache;

        // Execute the request flow for the cache hit
        executeSubroutine(subroutines, 'vcl_recv', hitContext);

        // Simulate cache hit
        hitContext.obj = {
          status: cachedResponse.resp.status,
          response: '',
          http: { ...cachedResponse.resp.http },
          hits: cachedResponse.hits
        };

        // Update response
        hitContext.resp.status = hitContext.obj.status;
        hitContext.resp.statusText = cachedResponse.resp.statusText;
        hitContext.resp.http = { ...hitContext.obj.http };

        // Execute deliver for the cache hit
        executeSubroutine(subroutines, 'vcl_deliver', hitContext);

        // Store the hit context for assertions
        context.hitContext = hitContext;
      },
      assertions: [
        // Check cache miss
        (context: VCLContext) => {
          return assert(
            context.resp.http['X-Cache'] === 'MISS',
            `Expected X-Cache to be 'MISS', got '${context.resp.http['X-Cache']}'`
          );
        },
        // Check TTL
        (context: VCLContext) => {
          return assert(
            context.beresp.ttl === 3600,
            `Expected TTL to be 3600, got '${context.beresp.ttl}'`
          );
        },
        // Check cache hit
        (context: VCLContext) => {
          return assert(
            context.hitContext.resp.http['X-Cache'] === 'HIT',
            `Expected X-Cache to be 'HIT', got '${context.hitContext.resp.http['X-Cache']}'`
          );
        },
        // Check cache hits count
        (context: VCLContext) => {
          return assert(
            context.hitContext.resp.http['X-Cache-Hits'] === '1',
            `Expected X-Cache-Hits to be '1', got '${context.hitContext.resp.http['X-Cache-Hits']}'`
          );
        }
      ]
    },

    // Test 2: TTL and grace periods
    {
      name: 'TTL and grace periods',
      vclSnippet: `
        sub vcl_recv {
          return(lookup);
        }

        sub vcl_fetch {
          # Set TTL to 10 seconds
          set beresp.ttl = 10s;

          # Set grace period to 1 hour
          set beresp.grace = 3600s;

          # Set stale-while-revalidate to 30 seconds
          set beresp.stale_while_revalidate = 30s;

          return(deliver);
        }

        sub vcl_hit {
          # Serve stale content if backend is unhealthy
          if (!req.backend.healthy && obj.ttl + obj.grace > 0s) {
            return(deliver);
          }

          return(deliver);
        }

        sub vcl_deliver {
          # Add cache status header
          if (obj.hits > 0) {
            set resp.http.X-Cache = "HIT";
          } else {
            set resp.http.X-Cache = "MISS";
          }

          # Add TTL info
          set resp.http.X-TTL = beresp.ttl;
          set resp.http.X-Grace = beresp.grace;
          set resp.http.X-SWR = beresp.stale_while_revalidate;

          return(deliver);
        }
      `,
      run: async (context: VCLContext, subroutines: VCLSubroutines) => {
        // Set up the context
        context.req.url = '/ttl-test';
        context.req.method = 'GET';

        // Simulate a cache miss
        context.cache = new Map();

        // Execute the request flow
        executeSubroutine(context, subroutines, 'vcl_recv');

        // Simulate backend response
        context.beresp.status = 200;
        context.beresp.statusText = 'OK';
        context.beresp.http = {
          'content-type': 'text/html',
          'content-length': '1024'
        };

        // Execute fetch
        executeSubroutine(context, subroutines, 'vcl_fetch');

        // Update response
        context.resp.status = context.beresp.status;
        context.resp.statusText = context.beresp.statusText;
        context.resp.http = { ...context.beresp.http };

        // Execute deliver
        executeSubroutine(context, subroutines, 'vcl_deliver');
      },
      assertions: [
        // Check TTL
        (context: VCLContext) => {
          return assert(
            context.beresp.ttl === 10,
            `Expected TTL to be 10, got '${context.beresp.ttl}'`
          );
        },
        // Check grace period
        (context: VCLContext) => {
          return assert(
            context.beresp.grace === 3600,
            `Expected grace period to be 3600, got '${context.beresp.grace}'`
          );
        },
        // Check stale-while-revalidate
        (context: VCLContext) => {
          return assert(
            context.beresp.stale_while_revalidate === 30,
            `Expected stale-while-revalidate to be 30, got '${context.beresp.stale_while_revalidate}'`
          );
        },
        // Check response headers
        (context: VCLContext) => {
          return assert(
            context.resp.http['X-TTL'] === '10' &&
            context.resp.http['X-Grace'] === '3600' &&
            context.resp.http['X-SWR'] === '30',
            `Expected TTL headers to be set correctly`
          );
        }
      ]
    }
  ]
};

// Export the test suite
export default cachingTests;

// Run the test suite if this file is executed directly
if (import.meta.main) {
  runTestSuite(cachingTests);
}
