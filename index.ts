/**
 * HTTP proxy server using Bun with Fastly VCL support
 * Listens on 127.0.0.1:8000 and proxies requests to http://neverssl.com
 * Processes requests through a VCL filter loaded from filter.vcl
 */

// Configuration
const PROXY_HOST = "127.0.0.1";
const PROXY_PORT = 8000;
const VCL_FILE_PATH = process.argv[2] || "filter.vcl";

// Default backend configuration
const DEFAULT_BACKEND = {
    name: "default",
    host: "neverssl.com",
    port: 80,
    ssl: false
};

// Import VCL module
import { loadVCL, createVCLContext, executeVCL } from './src/vcl';
import { VCLContext, VCLSubroutines } from './src/vcl-compiler';

// Initialize VCL
console.log(`Loading VCL file: ${VCL_FILE_PATH}`);
const vclSubroutines = loadVCL(VCL_FILE_PATH);

// Simple in-memory cache
const cache = new Map();

// Create a VCL context for backend setup
const setupContext = createVCLContext();

// Set up backends for testing
console.log('Setting up backends...');

// Main backend (default)
setupContext.std.backend.add('main', 'neverssl.com', 80, false, {
    connect_timeout: 1000,
    first_byte_timeout: 15000,
    between_bytes_timeout: 10000
});

// API backend
setupContext.std.backend.add('api', 'httpbin.org', 80, false, {
    connect_timeout: 2000,
    first_byte_timeout: 20000,
    between_bytes_timeout: 15000
});

// Static content backend
setupContext.std.backend.add('static', 'example.com', 80, false);

// Add health check probes
setupContext.std.backend.add_probe('main', {
    request: 'HEAD / HTTP/1.1\r\nHost: neverssl.com\r\nConnection: close\r\n\r\n',
    expected_response: 200,
    interval: 5000,
    timeout: 2000
});

setupContext.std.backend.add_probe('api', {
    request: 'HEAD /get HTTP/1.1\r\nHost: httpbin.org\r\nConnection: close\r\n\r\n',
    expected_response: 200,
    interval: 10000,
    timeout: 5000
});

// Create directors
setupContext.std.director.add('main_director', 'random', {
    quorum: 50,
    retries: 3
});

// Add backends to the main director
setupContext.std.director.add_backend('main_director', 'main', 2);
setupContext.std.director.add_backend('main_director', 'static', 1);

// Fallback director
setupContext.std.director.add('fallback_director', 'fallback');
setupContext.std.director.add_backend('fallback_director', 'main', 1);
setupContext.std.director.add_backend('fallback_director', 'api', 1);

console.log(`Backends configured: ${Object.keys(setupContext.backends).join(', ')}`);
console.log(`Directors configured: ${Object.keys(setupContext.directors).join(', ')}`);

// Start the server
const server = Bun.serve({
    port: PROXY_PORT,
    hostname: PROXY_HOST,
    // Set a higher timeout for slow connections
    idleTimeout: 255, // Maximum allowed value

    async fetch(req) {
        const url = new URL(req.url);

        // Initialize VCL context
        const context = createVCLContext();
        context.req.url = url.pathname + url.search;
        context.req.method = req.method;
        context.cache = cache;

        // Convert request headers to VCL format
        for (const [key, value] of req.headers.entries()) {
            context.req.http[key.toLowerCase()] = value;
        }

        // Execute vcl_recv
        let action = executeVCL(vclSubroutines, 'vcl_recv', context) || "lookup";

        // Handle error action from vcl_recv
        if (action === "error") {
            executeVCL(vclSubroutines, 'vcl_error', context);

            return new Response(`Error: ${context.obj.status} ${context.obj.response}`, {
                status: context.obj.status || 500,
                headers: context.obj.http
            });
        }

        // Generate cache key if we're doing a lookup
        let cacheKey = "";
        if (action === "lookup") {
            // Execute vcl_hash to populate hashData
            executeVCL(vclSubroutines, 'vcl_hash', context);

            // Generate cache key from hashData
            cacheKey = context.hashData && context.hashData.length > 0
                ? context.hashData.join(':')
                : `${context.req.url}:${context.req.http['host'] || ''}`;

            console.log(`Generated cache key: ${cacheKey}`);

            // Check cache
            console.log(`Checking cache for key: ${cacheKey}, has entry: ${cache.has(cacheKey)}`);
            if (cache.has(cacheKey)) {
                const cachedResponse = cache.get(cacheKey);
                const now = Date.now();

                console.log(`Cache entry found: expires at ${new Date(cachedResponse.expires).toISOString()}, stale until ${new Date(cachedResponse.staleUntil).toISOString()}`);
                console.log(`Current time: ${new Date(now).toISOString()}`);
                console.log(`Is fresh: ${now < cachedResponse.expires}, is within grace: ${now < cachedResponse.staleUntil}`);

                // Check if the cached response is still fresh
                if (now < cachedResponse.expires) {
                    console.log(`Cache HIT for ${cacheKey} (fresh)`);
                    context.obj.hits = 1;

                    // Execute vcl_hit
                    action = executeVCL(vclSubroutines, 'vcl_hit', context) || "deliver";

                    if (action === "deliver") {
                        // Update context with cached response
                        context.resp = { ...cachedResponse.resp };

                        // Add cache status header
                        context.resp.http["X-Cache"] = "HIT";
                        context.resp.http["X-Cache-Hits"] = "1";
                        context.resp.http["X-Cache-Age"] = `${Math.floor((now - cachedResponse.created) / 1000)}`;

                        // Execute vcl_deliver
                        executeVCL(vclSubroutines, 'vcl_deliver', context);

                        // Execute vcl_log
                        executeVCL(vclSubroutines, 'vcl_log', context);

                        // Return cached response
                        return new Response(cachedResponse.body, {
                            status: context.resp.status,
                            statusText: context.resp.statusText,
                            headers: context.resp.http
                        });
                    }
                }
                // Check if the cached response is stale but within grace period
                else if (now < cachedResponse.staleUntil) {
                    console.log(`Cache HIT for ${cacheKey} (stale, within grace period)`);
                    context.obj.hits = 1;

                    // Execute vcl_hit
                    action = executeVCL(vclSubroutines, 'vcl_hit', context) || "deliver";

                    if (action === "deliver") {
                        // Update context with cached response
                        context.resp = { ...cachedResponse.resp };

                        // Add cache status header
                        context.resp.http["X-Cache"] = "HIT-STALE";
                        context.resp.http["X-Cache-Hits"] = "1";
                        context.resp.http["X-Cache-Age"] = `${Math.floor((now - cachedResponse.created) / 1000)}`;

                        // Execute vcl_deliver
                        executeVCL(vclSubroutines, 'vcl_deliver', context);

                        // Execute vcl_log
                        executeVCL(vclSubroutines, 'vcl_log', context);

                        // Asynchronously revalidate the cache in the background
                        setTimeout(() => {
                            console.log(`Background revalidation for ${cacheKey}`);
                            // This would normally trigger a new fetch to the backend
                            // For now, we'll just remove the cache entry to force a refresh on next request
                            cache.delete(cacheKey);
                        }, 0);

                        // Return cached response
                        return new Response(cachedResponse.body, {
                            status: context.resp.status,
                            statusText: context.resp.statusText,
                            headers: context.resp.http
                        });
                    }
                } else {
                    // Cache entry is too old, remove it
                    console.log(`Cache entry for ${cacheKey} is expired and beyond grace period, removing`);
                    cache.delete(cacheKey);
                    action = executeVCL(vclSubroutines, 'vcl_miss', context) || "fetch";
                }
            } else {
                console.log(`Cache MISS for ${cacheKey}`);
                action = executeVCL(vclSubroutines, 'vcl_miss', context) || "fetch";
            }
        } else if (action === "pass") {
            action = executeVCL(vclSubroutines, 'vcl_pass', context) || "fetch";
        }

        // If we get here, we need to fetch from the backend

        // Get the selected backend or use the default
        const backendName = context.req.backend || 'default';
        const backend = context.backends[backendName];

        if (!backend) {
            console.error(`Backend ${backendName} not found, using default`);
            context.req.backend = 'default';
            context.current_backend = context.backends['default'];
        } else {
            context.current_backend = backend;
        }

        // Create a new URL pointing to the target backend
        const protocol = context.current_backend.ssl ? 'https' : 'http';
        const targetUrl = new URL(url.pathname + url.search, `${protocol}://${context.current_backend.host}:${context.current_backend.port}`);

        console.log(`Proxying request: ${req.method} ${url.pathname} -> ${targetUrl} (backend: ${context.current_backend.name})`);

        // Prepare backend request
        context.bereq.url = targetUrl.toString();

        // Copy headers from req to bereq
        for (const [key, value] of Object.entries(context.req.http)) {
            context.bereq.http[key] = value;
        }

        // Forward the request to the target server
        const proxyReq = new Request(targetUrl, {
            method: req.method,
            headers: new Headers(context.bereq.http),
            body: req.method !== "GET" && req.method !== "HEAD" ? req.body : undefined,
            // Add a timeout for the fetch request
            signal: AbortSignal.timeout(15000), // 15 seconds timeout
        });

        // Remove host header to avoid conflicts
        proxyReq.headers.delete("host");
        // Set the host header to the target host
        proxyReq.headers.set("host", context.current_backend.host);

        // Add the original host as a header
        proxyReq.headers.set("x-forwarded-host", url.host);
        proxyReq.headers.set("x-forwarded-proto", url.protocol.replace(":", ""));

        try {
            // Forward the request and get the response
            const backendResponse = await fetch(proxyReq);

            console.log(`Response received: ${backendResponse.status} ${backendResponse.statusText}`);

            // Update beresp context
            context.beresp.status = backendResponse.status;
            context.beresp.statusText = backendResponse.statusText;

            // Copy backend response headers to beresp
            for (const [key, value] of backendResponse.headers.entries()) {
                context.beresp.http[key.toLowerCase()] = value;
            }

            // Execute vcl_fetch
            action = executeVCL(vclSubroutines, 'vcl_fetch', context) || "deliver";

            // TEMPORARY FIX: Set TTL manually since our VCL parser is not correctly handling it
            if (context.beresp.ttl === 0) {
                console.log("Setting TTL manually to 300 seconds (5 minutes)");
                context.beresp.ttl = 300;
                context.beresp.grace = 3600;
                context.beresp.stale_while_revalidate = 10;
            }

            // Clone the response body for caching
            const clonedResponse = backendResponse.clone();
            const responseBody = await clonedResponse.arrayBuffer();

            // Update resp context
            context.resp.status = context.beresp.status;
            context.resp.statusText = context.beresp.statusText;
            context.resp.http = { ...context.beresp.http };

            // Add cache status header for miss
            context.resp.http["X-Cache"] = "MISS";

            // Execute vcl_deliver
            executeVCL(vclSubroutines, 'vcl_deliver', context);

            // Cache the response if appropriate
            console.log(`Cache decision: action=${action}, cacheKey=${cacheKey}, ttl=${context.beresp.ttl}`);

            if (action === "deliver" && cacheKey && context.beresp.ttl > 0) {
                const now = Date.now();
                const ttlMs = context.beresp.ttl * 1000;
                const graceMs = (context.beresp.grace || 0) * 1000;
                const staleWhileRevalidateMs = (context.beresp.stale_while_revalidate || 0) * 1000;

                console.log(`Caching response: TTL=${context.beresp.ttl}s, Grace=${context.beresp.grace || 0}s, SWR=${context.beresp.stale_while_revalidate || 0}s`);
                console.log(`Response headers: ${JSON.stringify(context.resp.http)}`);

                // Clone the response body to ensure it's available for caching
                const bodyClone = responseBody.slice(0);

                cache.set(cacheKey, {
                    resp: { ...context.resp },
                    body: bodyClone,
                    created: now,
                    expires: now + ttlMs,
                    staleUntil: now + ttlMs + graceMs + staleWhileRevalidateMs,
                    // Store original beresp for potential revalidation
                    beresp: { ...context.beresp }
                });

                console.log(`Cached response with key ${cacheKey}, TTL: ${context.beresp.ttl}s, expires: ${new Date(now + ttlMs).toISOString()}`);
                console.log(`Cache size: ${cache.size} entries`);
            } else {
                console.log(`Not caching response: action=${action}, cacheKey=${cacheKey}, ttl=${context.beresp.ttl}`);
            }

            // Execute vcl_log
            executeVCL(vclSubroutines, 'vcl_log', context);

            // Create a new response with the processed headers
            return new Response(responseBody, {
                status: context.resp.status,
                statusText: context.resp.statusText,
                headers: context.resp.http
            });
        } catch (error) {
            console.error("Proxy error:", error);

            // Update error context
            context.obj.status = error.name === "TimeoutError" || error.name === "AbortError" ? 504 : 500;
            context.obj.response = error.name === "TimeoutError" || error.name === "AbortError"
                ? "Request timed out while connecting to the target server"
                : `Proxy error: ${error.message}`;

            // Execute vcl_error
            executeVCL(vclSubroutines, 'vcl_error', context);

            // Execute vcl_log
            executeVCL(vclSubroutines, 'vcl_log', context);

            return new Response(context.obj.response, {
                status: context.obj.status,
                headers: { "Content-Type": "text/plain", ...context.obj.http }
            });
        }
    },
});

console.log(`HTTP Proxy server running at http://${PROXY_HOST}:${PROXY_PORT}`);
console.log(`Default backend: ${DEFAULT_BACKEND.host}:${DEFAULT_BACKEND.port}`);
console.log(`Using VCL file: ${VCL_FILE_PATH}`);