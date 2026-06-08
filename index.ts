import "./src/platform-node";
import { existsSync, readFileSync } from "node:fs";
import { type BackendResponse, runPipeline } from "./src/runtime/pipeline";
import { createVCLContext, loadVCLContent } from "./src/vcl";
import type { VCLContext } from "./src/vcl-compiler";
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
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		console.error(`Error loading VCL file ${filePath}: ${message}`);
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
setupContext.std!.backend!.add("main", "perdu.com", 443, true, {
	connect_timeout: 1000,
	first_byte_timeout: 15000,
	between_bytes_timeout: 10000,
});
setupContext.std!.backend!.add("api", "httpbin.org", 80, false, {
	connect_timeout: 2000,
	first_byte_timeout: 20000,
	between_bytes_timeout: 15000,
});
setupContext.std!.backend!.add("static", "example.com", 80, false);

setupContext.std!.backend!.add_probe("main", {
	request: "HEAD / HTTP/1.1\r\nHost: perdu.com\r\nConnection: close\r\n\r\n",
	expected_response: 200,
	interval: 5000,
	timeout: 2000,
});
setupContext.std!.backend!.add_probe("api", {
	request: "HEAD /get HTTP/1.1\r\nHost: httpbin.org\r\nConnection: close\r\n\r\n",
	expected_response: 200,
	interval: 10000,
	timeout: 5000,
});

setupContext.std!.director!.add("main_director", "random", {
	quorum: 50,
	retries: 3,
});
setupContext.std!.director!.add_backend("main_director", "main", 2);
setupContext.std!.director!.add_backend("main_director", "static", 1);

setupContext.std!.director!.add("fallback_director", "fallback");
setupContext.std!.director!.add_backend("fallback_director", "main", 1);
setupContext.std!.director!.add_backend("fallback_director", "api", 1);

console.log(`Backends configured: ${Object.keys(setupContext.backends).join(", ")}`);
console.log(`Directors configured: ${Object.keys(setupContext.directors).join(", ")}`);

// Selects a backend per the configured routing and fetches it, with a fallback
// director on 5xx. Throws (with context.obj set) on a backend or network error,
// which runPipeline turns into a vcl_error response.
async function fetchFromBackend(context: VCLContext, url: URL): Promise<BackendResponse> {
	if (context.req.url.startsWith("/api/")) {
		if (!context.std!.backend!.set_current("api")) {
			throw new Error(`Backend 'api' not found or not available`);
		}
	} else if (context.req.url.match(/\.(jpg|jpeg|png|gif|css|js)$/)) {
		if (!context.std!.backend!.set_current("static")) {
			throw new Error(`Backend 'static' not found or not available`);
		}
	} else {
		const selectedBackend =
			context.std!.director!.select_backend("main_director") ||
			context.std!.director!.select_backend("fallback_director");
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

	if (context.current_backend && !context.std!.backend!.is_healthy(context.current_backend.name)) {
		throw new Error(`Backend '${context.current_backend.name}' is not healthy`);
	}

	context.req.http["X-Selected-Backend"] = context.req.backend ?? "unknown";
	const backend = context.current_backend!;

	const sendTo = async (target: typeof backend): Promise<Response> => {
		const protocol = target.ssl ? "https" : "http";
		const targetUrl = new URL(
			url.pathname + url.search,
			`${protocol}://${target.host}:${target.port}`,
		);
		context.bereq.url = targetUrl.toString();
		for (const [key, value] of Object.entries(context.req.http)) {
			context.bereq.http[key] = value;
		}
		const proxyReq = new Request(targetUrl.toString(), {
			method: context.req.method,
			headers: new Headers(context.bereq.http),
			signal: AbortSignal.timeout(15000),
		});
		proxyReq.headers.delete("host");
		proxyReq.headers.set("host", target.host);
		proxyReq.headers.set("x-forwarded-host", url.host);
		proxyReq.headers.set("x-forwarded-proto", url.protocol.replace(":", ""));
		return fetch(proxyReq);
	};

	try {
		let backendResponse = await sendTo(backend);
		if (
			backendResponse.status >= 500 &&
			context.directors.fallback_director &&
			backend.name !== "default"
		) {
			const fallback = context.std!.director!.select_backend("fallback_director");
			if (fallback && fallback.name !== backend.name) {
				context.req.backend = fallback.name;
				context.current_backend = fallback;
				try {
					backendResponse = await sendTo(fallback);
				} catch {
					// keep the original response on fallback failure
				}
			}
		}
		const headers: Record<string, string> = {};
		for (const [key, value] of backendResponse.headers.entries()) headers[key] = value;
		return {
			status: backendResponse.status,
			statusText: backendResponse.statusText,
			headers,
			body: new Uint8Array(await backendResponse.arrayBuffer()),
		};
	} catch (err) {
		const errObj = err instanceof Error ? err : { name: "Error", message: String(err) };
		let status = 502;
		let message = `Proxy error: ${errObj.message}`;
		if (errObj.name === "TimeoutError" || errObj.name === "AbortError") {
			status = 504;
			message = "Request timed out while connecting to the target server";
		} else if (errObj.name === "TypeError" && errObj.message.includes("Failed to parse URL")) {
			status = 400;
			message = "Bad Request: Invalid URL";
		}
		context.obj.status = status;
		context.obj.response = createDefaultErrorPage(
			status,
			message,
			context.req.method,
			url.pathname,
			context.current_backend?.name,
		);
		context.obj.http = { "Content-Type": "text/html; charset=utf-8" };
		throw err;
	}
}

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

		const result = await runPipeline({
			subroutines: vclSubroutines,
			context,
			cache,
			maxRestarts: MAX_RESTARTS,
			getBackendResponse: (ctx) => fetchFromBackend(ctx, url),
		});

		return new Response(result.response.body, {
			status: result.response.status,
			statusText: result.response.statusText,
			headers: result.response.headers,
		});
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
