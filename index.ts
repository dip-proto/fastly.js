/**
 * HTTP proxy server using Bun with Fastly VCL support
 * Listens on 127.0.0.1:8000 and proxies requests to http://neverssl.com
 * Processes requests through a VCL filter loaded from filter.vcl
 */

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

// Configuration
const TARGET_HOST = "neverssl.com";
const TARGET_URL = `http://${TARGET_HOST}`;
const PROXY_HOST = "127.0.0.1";
const PROXY_PORT = 8000;
const VCL_FILE_PATH = "filter.vcl";

// VCL state and context
interface VCLContext {
    req: {
        url: string;
        method: string;
        http: Record<string, string>;
    };
    bereq: {
        url: string;
        method: string;
        http: Record<string, string>;
    };
    beresp: {
        status: number;
        statusText: string;
        http: Record<string, string>;
        ttl: number;
    };
    resp: {
        status: number;
        statusText: string;
        http: Record<string, string>;
    };
    obj: {
        status: number;
        response: string;
        http: Record<string, string>;
        hits: number;
    };
    // Simple cache for demonstration
    cache: Map<string, any>;
}

// VCL subroutines
interface VCLSubroutines {
    vcl_recv?: (context: VCLContext) => string;
    vcl_hash?: (context: VCLContext) => string;
    vcl_hit?: (context: VCLContext) => string;
    vcl_miss?: (context: VCLContext) => string;
    vcl_pass?: (context: VCLContext) => string;
    vcl_fetch?: (context: VCLContext) => string;
    vcl_deliver?: (context: VCLContext) => string;
    vcl_error?: (context: VCLContext) => string;
    vcl_log?: (context: VCLContext) => void;
}

// Load VCL file
function loadVCLFile(filePath: string): string {
    try {
        const fullPath = join(process.cwd(), filePath);
        if (!existsSync(fullPath)) {
            console.error(`VCL file not found: ${fullPath}`);
            return "";
        }

        const content = readFileSync(fullPath, 'utf-8');
        console.log(`Loaded VCL file: ${fullPath}`);
        return content;
    } catch (error) {
        console.error(`Error loading VCL file: ${error.message}`);
        return "";
    }
}

// Parse VCL file (placeholder for actual parser)
function parseVCL(vclContent: string): VCLSubroutines {
    console.log("VCL file loaded successfully. Parsing not yet implemented.");
    console.log(`VCL file size: ${vclContent.length} bytes`);

    // This is a placeholder. In a real implementation, we would parse the VCL
    // and return actual functions that implement the VCL logic.
    return {
        vcl_recv: (context) => {
            console.log(`[vcl_recv] Processing request: ${context.req.method} ${context.req.url}`);
            // Add a custom header to demonstrate VCL processing
            context.req.http["X-VCL-Processed"] = "true";
            return "lookup";
        },
        vcl_hash: (context) => {
            // Simple hash function for demonstration
            const hash = `${context.req.url}|${context.req.http["host"] || ""}`;
            console.log(`[vcl_hash] Generated hash: ${hash}`);
            return hash;
        },
        vcl_hit: (context) => {
            console.log(`[vcl_hit] Cache hit for: ${context.req.url}`);
            return "deliver";
        },
        vcl_miss: (context) => {
            console.log(`[vcl_miss] Cache miss for: ${context.req.url}`);
            return "fetch";
        },
        vcl_pass: (context) => {
            console.log(`[vcl_pass] Cache pass for: ${context.req.url}`);
            return "fetch";
        },
        vcl_fetch: (context) => {
            console.log(`[vcl_fetch] Processing backend response: ${context.beresp.status}`);
            // Set a default TTL for demonstration
            context.beresp.ttl = 300; // 5 minutes
            // Add a custom header to demonstrate VCL processing
            context.beresp.http["X-VCL-Cache-TTL"] = context.beresp.ttl.toString();
            return "deliver";
        },
        vcl_deliver: (context) => {
            console.log(`[vcl_deliver] Delivering response: ${context.resp.status}`);
            // Add cache status header
            context.resp.http["X-Cache"] = context.obj.hits > 0 ? "HIT" : "MISS";
            // Add a custom header to demonstrate VCL processing
            context.resp.http["X-Powered-By"] = "VCL Proxy";
            return "deliver";
        },
        vcl_error: (context) => {
            console.log(`[vcl_error] Error: ${context.obj.status} ${context.obj.response}`);
            return "deliver";
        },
        vcl_log: (context) => {
            console.log(`[vcl_log] Completed: ${context.req.method} ${context.req.url} - Status: ${context.resp.status}`);
        }
    };
}

// Initialize VCL
const vclContent = loadVCLFile(VCL_FILE_PATH);
const vclSubroutines = parseVCL(vclContent);

// Simple in-memory cache
const cache = new Map();

// Start the server
const server = Bun.serve({
    port: PROXY_PORT,
    hostname: PROXY_HOST,
    // Set a higher timeout for slow connections
    idleTimeout: 255, // Maximum allowed value

    async fetch(req) {
        const url = new URL(req.url);

        // Initialize VCL context
        const context: VCLContext = {
            req: {
                url: url.pathname + url.search,
                method: req.method,
                http: {}
            },
            bereq: {
                url: "",
                method: req.method,
                http: {}
            },
            beresp: {
                status: 0,
                statusText: "",
                http: {},
                ttl: 0
            },
            resp: {
                status: 0,
                statusText: "",
                http: {}
            },
            obj: {
                status: 0,
                response: "",
                http: {},
                hits: 0
            },
            cache
        };

        // Convert request headers to VCL format
        for (const [key, value] of req.headers.entries()) {
            context.req.http[key.toLowerCase()] = value;
        }

        // Execute vcl_recv
        let action = "lookup";
        if (vclSubroutines.vcl_recv) {
            action = vclSubroutines.vcl_recv(context);
        }

        // Handle error action from vcl_recv
        if (action === "error") {
            if (vclSubroutines.vcl_error) {
                vclSubroutines.vcl_error(context);
            }

            return new Response(`Error: ${context.obj.status} ${context.obj.response}`, {
                status: context.obj.status || 500,
                headers: context.obj.http
            });
        }

        // Generate cache key if we're doing a lookup
        let cacheKey = "";
        if (action === "lookup" && vclSubroutines.vcl_hash) {
            cacheKey = vclSubroutines.vcl_hash(context);

            // Check cache
            if (cache.has(cacheKey)) {
                context.obj.hits = 1;
                if (vclSubroutines.vcl_hit) {
                    action = vclSubroutines.vcl_hit(context);

                    if (action === "deliver") {
                        const cachedResponse = cache.get(cacheKey);

                        // Update context with cached response
                        context.resp = cachedResponse.resp;

                        // Execute vcl_deliver
                        if (vclSubroutines.vcl_deliver) {
                            vclSubroutines.vcl_deliver(context);
                        }

                        // Execute vcl_log
                        if (vclSubroutines.vcl_log) {
                            vclSubroutines.vcl_log(context);
                        }

                        // Return cached response
                        return new Response(cachedResponse.body, {
                            status: context.resp.status,
                            statusText: context.resp.statusText,
                            headers: context.resp.http
                        });
                    }
                }
            } else if (vclSubroutines.vcl_miss) {
                action = vclSubroutines.vcl_miss(context);
            }
        } else if (action === "pass" && vclSubroutines.vcl_pass) {
            action = vclSubroutines.vcl_pass(context);
        }

        // If we get here, we need to fetch from the backend

        // Create a new URL pointing to the target
        const targetUrl = new URL(url.pathname + url.search, TARGET_URL);

        console.log(`Proxying request: ${req.method} ${url.pathname} -> ${targetUrl}`);

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
        proxyReq.headers.set("host", TARGET_HOST);

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
            action = "deliver";
            if (vclSubroutines.vcl_fetch) {
                action = vclSubroutines.vcl_fetch(context);
            }

            // Clone the response body for caching
            const clonedResponse = backendResponse.clone();
            const responseBody = await clonedResponse.arrayBuffer();

            // Update resp context
            context.resp.status = context.beresp.status;
            context.resp.statusText = context.beresp.statusText;
            context.resp.http = { ...context.beresp.http };

            // Execute vcl_deliver
            if (vclSubroutines.vcl_deliver) {
                vclSubroutines.vcl_deliver(context);
            }

            // Cache the response if appropriate
            if (action === "deliver" && cacheKey && context.beresp.ttl > 0) {
                cache.set(cacheKey, {
                    resp: { ...context.resp },
                    body: responseBody,
                    expires: Date.now() + (context.beresp.ttl * 1000)
                });
            }

            // Execute vcl_log
            if (vclSubroutines.vcl_log) {
                vclSubroutines.vcl_log(context);
            }

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
            if (vclSubroutines.vcl_error) {
                vclSubroutines.vcl_error(context);
            }

            // Execute vcl_log
            if (vclSubroutines.vcl_log) {
                vclSubroutines.vcl_log(context);
            }

            return new Response(context.obj.response, {
                status: context.obj.status,
                headers: { "Content-Type": "text/plain", ...context.obj.http }
            });
        }
    },
});

console.log(`HTTP Proxy server running at http://${PROXY_HOST}:${PROXY_PORT}`);
console.log(`Proxying requests to ${TARGET_URL}`);
console.log(`Using VCL file: ${VCL_FILE_PATH}`);