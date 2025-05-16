import { existsSync, readFileSync } from "node:fs";
import { createVCLContext, executeVCL, loadVCLContent } from "./src/vcl";
import type { VCLContext, VCLSubroutines } from "./src/vcl-compiler";
import { SecurityModule } from "./src/vcl-security";

const PROXY_HOST = "127.0.0.1";
const PROXY_PORT = 8000;
const DEFAULT_VCL_FILE = "filter.vcl";
const MAX_RESTARTS = 3;

const vclFilePaths = process.argv.slice(2);
if (vclFilePaths.length === 0) {
	vclFilePaths.push(DEFAULT_VCL_FILE);
}

let vclContent = "";
const loadedFiles: string[] = [];

for (const filePath of vclFilePaths) {
	if (!existsSync(filePath)) {
		console.error(`VCL file not found: ${filePath}`);
		process.exit(1);
	}
	try {
		const content = readFileSync(filePath, "utf-8");
		vclContent += `\n# Begin file: ${filePath}\n${content}\n# End file: ${filePath}\n`;
		loadedFiles.push(filePath);
	} catch (error) {
		console.error(`Error loading VCL file ${filePath}: ${error.message}`);
		process.exit(1);
	}
}

console.log(`Loading VCL files: ${loadedFiles.join(", ")}`);
const vclSubroutines = loadVCLContent(vclContent);

console.log("Initializing security module...");
SecurityModule.init();

const cache = new Map();
const setupContext = createVCLContext();

console.log("Setting up backends...");
setupContext.std.backend.add("main", "perdu.com", 443, true, {
	connect_timeout: 1000,
	first_byte_timeout: 15000,
	between_bytes_timeout: 10000,
});
setupContext.std.backend.add("api", "httpbin.org", 80, false, {
	connect_timeout: 2000,
	first_byte_timeout: 20000,
	between_bytes_timeout: 15000,
});
setupContext.std.backend.add("static", "example.com", 80, false);

setupContext.std.backend.add_probe("main", {
	request: "HEAD / HTTP/1.1\r\nHost: perdu.com\r\nConnection: close\r\n\r\n",
	expected_response: 200,
	interval: 5000,
	timeout: 2000,
});
setupContext.std.backend.add_probe("api", {
	request:
		"HEAD /get HTTP/1.1\r\nHost: httpbin.org\r\nConnection: close\r\n\r\n",
	expected_response: 200,
	interval: 10000,
	timeout: 5000,
});

setupContext.std.director.add("main_director", "random", {
	quorum: 50,
	retries: 3,
});
setupContext.std.director.add_backend("main_director", "main", 2);
setupContext.std.director.add_backend("main_director", "static", 1);

setupContext.std.director.add("fallback_director", "fallback");
setupContext.std.director.add_backend("fallback_director", "main", 1);
setupContext.std.director.add_backend("fallback_director", "api", 1);

console.log(
	`Backends configured: ${Object.keys(setupContext.backends).join(", ")}`,
);
console.log(
	`Directors configured: ${Object.keys(setupContext.directors).join(", ")}`,
);

const _server = Bun.serve({
	port: PROXY_PORT,
	hostname: PROXY_HOST,
	idleTimeout: 255,

	async fetch(req) {
		const url = new URL(req.url);
		const context = createVCLContext();
		context.req.url = url.pathname + url.search;
		context.req.method = req.method;
		context.cache = cache;
		context.backends = { ...setupContext.backends };
		context.directors = { ...setupContext.directors };

		for (const [key, value] of req.headers.entries()) {
			context.req.http[key.toLowerCase()] = value;
		}

		let action = executeVCL(vclSubroutines, "vcl_recv", context) || "lookup";
		while (action === "restart") {
			if (context.req.restarts >= MAX_RESTARTS) {
				console.error(`Maximum number of restarts (${MAX_RESTARTS}) reached`);
				context.std.error(
					503,
					`Maximum number of restarts (${MAX_RESTARTS}) reached`,
				);
				executeVCL(vclSubroutines, "vcl_error", context);
				return new Response(context.obj.response, {
					status: context.obj.status || 503,
					headers: context.obj.http,
				});
			}
			context.req.restarts++;
			console.log(
				`Request restarted (${context.req.restarts}/${MAX_RESTARTS})`,
			);
			action = executeVCL(vclSubroutines, "vcl_recv", context) || "lookup";
		}

		if (action === "error") {
			executeVCL(vclSubroutines, "vcl_error", context);
			return new Response(
				`Error: ${context.obj.status} ${context.obj.response}`,
				{
					status: context.obj.status || 500,
					headers: context.obj.http,
				},
			);
		}

		let cacheKey = "";
		if (action === "lookup") {
			executeVCL(vclSubroutines, "vcl_hash", context);
			cacheKey =
				context.hashData && context.hashData.length > 0
					? context.hashData.join(":")
					: `${context.req.url}:${context.req.http.host || ""}`;

			if (cache.has(cacheKey)) {
				const cachedResponse = cache.get(cacheKey);
				const now = Date.now();
				const isFresh = now < cachedResponse.expires;
				const isStale = !isFresh && now < cachedResponse.staleUntil;

				if (isFresh || isStale) {
					context.obj.hits = 1;
					action = executeVCL(vclSubroutines, "vcl_hit", context) || "deliver";

					if (action === "deliver") {
						context.resp = { ...cachedResponse.resp };
						context.resp.http["X-Cache"] = isFresh ? "HIT" : "HIT-STALE";
						context.resp.http["X-Cache-Hits"] = "1";
						context.resp.http["X-Cache-Age"] =
							`${Math.floor((now - cachedResponse.created) / 1000)}`;

						executeVCL(vclSubroutines, "vcl_deliver", context);
						executeVCL(vclSubroutines, "vcl_log", context);

						if (isStale) {
							setTimeout(() => cache.delete(cacheKey), 0);
						}

						return new Response(cachedResponse.body, {
							status: context.resp.status,
							statusText: context.resp.statusText,
							headers: context.resp.http,
						});
					}
				} else {
					cache.delete(cacheKey);
					action = executeVCL(vclSubroutines, "vcl_miss", context) || "fetch";
				}
			} else {
				action = executeVCL(vclSubroutines, "vcl_miss", context) || "fetch";
			}
		} else if (action === "pass") {
			action = executeVCL(vclSubroutines, "vcl_pass", context) || "fetch";
		}

		try {
			if (context.req.url.startsWith("/api/")) {
				if (!context.std.backend.set_current("api")) {
					throw new Error(`Backend 'api' not found or not available`);
				}
			} else if (context.req.url.match(/\.(jpg|jpeg|png|gif|css|js)$/)) {
				if (!context.std.backend.set_current("static")) {
					throw new Error(`Backend 'static' not found or not available`);
				}
			} else {
				const selectedBackend =
					context.std.director.select_backend("main_director") ||
					context.std.director.select_backend("fallback_director");
				if (selectedBackend) {
					context.req.backend = selectedBackend.name;
					context.current_backend = selectedBackend;
				} else if (context.backends.default) {
					context.req.backend = "default";
					context.current_backend = context.backends.default;
				} else {
					throw new Error(`No available backends for ${context.req.url}`);
				}
			}

			if (
				context.current_backend &&
				!context.std.backend.is_healthy(context.current_backend.name)
			) {
				throw new Error(
					`Backend '${context.current_backend.name}' is not healthy`,
				);
			}
		} catch (error) {
			console.error(`Backend selection error: ${error.message}`);
			context.std.error(503, `Service Unavailable: ${error.message}`);
			executeVCL(vclSubroutines, "vcl_error", context);
			return new Response(context.obj.response, {
				status: context.obj.status,
				headers: context.obj.http,
			});
		}

		context.req.http["X-Selected-Backend"] = context.req.backend;
		const protocol = context.current_backend.ssl ? "https" : "http";
		const targetUrl = new URL(
			url.pathname + url.search,
			`${protocol}://${context.current_backend.host}:${context.current_backend.port}`,
		);

		context.bereq.url = targetUrl.toString();
		for (const [key, value] of Object.entries(context.req.http)) {
			context.bereq.http[key] = value;
		}

		const proxyReq = new Request(targetUrl, {
			method: req.method,
			headers: new Headers(context.bereq.http),
			body:
				req.method !== "GET" && req.method !== "HEAD" ? req.body : undefined,
			signal: AbortSignal.timeout(15000),
		});
		proxyReq.headers.delete("host");
		proxyReq.headers.set("host", context.current_backend.host);
		proxyReq.headers.set("x-forwarded-host", url.host);
		proxyReq.headers.set("x-forwarded-proto", url.protocol.replace(":", ""));

		try {
			const backendResponse = await fetch(proxyReq);

			if (
				backendResponse.status >= 500 &&
				context.directors.fallback_director &&
				context.current_backend.name !== "default"
			) {
				const fallbackBackend =
					context.std.director.select_backend("fallback_director");
				if (
					fallbackBackend &&
					fallbackBackend.name !== context.current_backend.name
				) {
					context.req.backend = fallbackBackend.name;
					context.current_backend = fallbackBackend;

					const fallbackProtocol = fallbackBackend.ssl ? "https" : "http";
					const fallbackUrl = new URL(
						url.pathname + url.search,
						`${fallbackProtocol}://${fallbackBackend.host}:${fallbackBackend.port}`,
					);
					const fallbackReq = new Request(fallbackUrl, {
						method: req.method,
						headers: new Headers(context.bereq.http),
						body:
							req.method !== "GET" && req.method !== "HEAD"
								? req.body
								: undefined,
						signal: AbortSignal.timeout(15000),
					});
					fallbackReq.headers.delete("host");
					fallbackReq.headers.set("host", fallbackBackend.host);

					try {
						const fallbackResponse = await fetch(fallbackReq);
						return await handleBackendResponse(
							fallbackResponse,
							context,
							vclSubroutines,
							cacheKey,
							action,
							req,
							url,
						);
					} catch {
						// Continue with original response on fallback failure
					}
				}
			}

			return await handleBackendResponse(
				backendResponse,
				context,
				vclSubroutines,
				cacheKey,
				action,
				req,
				url,
			);
		} catch (error) {
			console.error("Proxy error:", error);

			let errorStatus = 500;
			let errorMessage = `Proxy error: ${error.message}`;

			if (error.name === "TimeoutError" || error.name === "AbortError") {
				errorStatus = 504;
				errorMessage =
					"Request timed out while connecting to the target server";
			} else if (
				error.name === "TypeError" &&
				error.message.includes("fetch")
			) {
				errorStatus = 502;
				errorMessage = "Bad Gateway: Unable to connect to the backend server";
			} else if (
				error.name === "TypeError" &&
				error.message.includes("Failed to parse URL")
			) {
				errorStatus = 400;
				errorMessage = "Bad Request: Invalid URL";
			}

			context.obj.status = errorStatus;
			context.obj.response = errorMessage;
			context.obj.http = { "Content-Type": "text/html; charset=utf-8" };
			context.fastly.error = errorMessage;
			context.fastly.state = "error";

			const errorAction = executeVCL(vclSubroutines, "vcl_error", context);

			if (
				errorAction !== "deliver" &&
				(!context.obj.response || context.obj.response === errorMessage)
			) {
				context.obj.response = createDefaultErrorPage(
					context.obj.status,
					errorMessage,
					req.method,
					url.pathname,
					context.current_backend?.name,
				);
				context.obj.http["Content-Type"] = "text/html; charset=utf-8";
			}

			executeVCL(vclSubroutines, "vcl_log", context);

			return new Response(context.obj.response, {
				status: context.obj.status,
				headers: context.obj.http,
			});
		}
	},
});

console.log(`HTTP Proxy server running at http://${PROXY_HOST}:${PROXY_PORT}`);
console.log(`Using VCL files: ${loadedFiles.join(", ")}`);

function createDefaultErrorPage(
	status: number,
	message: string,
	method: string,
	pathname: string,
	backendName?: string,
): string {
	const errorId = `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`;
	return `<!DOCTYPE html>
<html>
<head>
    <title>Error ${status}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
        .error-container { max-width: 800px; margin: 0 auto; background-color: white; border-radius: 5px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); padding: 20px; }
        h1 { color: #e74c3c; margin-top: 0; }
        .error-details { background-color: #f9f9f9; padding: 10px; border-radius: 3px; margin-top: 20px; }
        .error-id { color: #777; font-size: 0.9em; margin-top: 20px; }
    </style>
</head>
<body>
    <div class="error-container">
        <h1>Error ${status}</h1>
        <p>${message}</p>
        <div class="error-details">
            <p><strong>Request:</strong> ${method} ${pathname}</p>
            <p><strong>Backend:</strong> ${backendName || "unknown"}</p>
        </div>
        <p class="error-id">Error ID: ${errorId}</p>
    </div>
</body>
</html>`;
}

async function handleBackendResponse(
	backendResponse: Response,
	context: VCLContext,
	vclSubroutines: VCLSubroutines,
	cacheKey: string,
	action: string,
	_req: Request,
	_url: URL,
): Promise<Response> {
	context.beresp.status = backendResponse.status;
	context.beresp.statusText = backendResponse.statusText;

	for (const [key, value] of backendResponse.headers.entries()) {
		context.beresp.http[key.toLowerCase()] = value;
	}

	action = executeVCL(vclSubroutines, "vcl_fetch", context) || "deliver";

	// Default TTL when VCL does not set one
	if (context.beresp.ttl === 0) {
		context.beresp.ttl = 300;
		context.beresp.grace = 3600;
		context.beresp.stale_while_revalidate = 10;
	}

	const responseBody = await backendResponse.clone().arrayBuffer();

	context.resp.status = context.beresp.status;
	context.resp.statusText = context.beresp.statusText;
	context.resp.http = { ...context.beresp.http };
	context.resp.http["X-Cache"] = "MISS";
	context.resp.http["X-Backend"] =
		context.req.http["X-Selected-Backend"] || "unknown";

	executeVCL(vclSubroutines, "vcl_deliver", context);

	if (action === "deliver" && cacheKey && context.beresp.ttl > 0) {
		const now = Date.now();
		const ttlMs = context.beresp.ttl * 1000;
		const graceMs = (context.beresp.grace || 0) * 1000;
		const staleWhileRevalidateMs =
			(context.beresp.stale_while_revalidate || 0) * 1000;

		cache.set(cacheKey, {
			resp: { ...context.resp },
			body: responseBody.slice(0),
			created: now,
			expires: now + ttlMs,
			staleUntil: now + ttlMs + graceMs + staleWhileRevalidateMs,
			beresp: { ...context.beresp },
		});
	}

	executeVCL(vclSubroutines, "vcl_log", context);

	return new Response(responseBody, {
		status: context.resp.status,
		statusText: context.resp.statusText,
		headers: context.resp.http,
	});
}
