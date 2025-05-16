/**
 * Test script for VCL backend configuration
 */

import { createVCLContext } from "../../src/vcl";

// Create a VCL context
const context = createVCLContext();

console.log("Backend Configuration Test\n");

// Test the default backend
console.log("Default Backend Test");
console.log(
	`Default backend: ${JSON.stringify(context.backends.default, null, 2)}`,
);
console.log(
	`Is default backend healthy? ${context.std.backend.is_healthy("default")}`,
);

// Test adding a new backend
console.log("\nAdding New Backends Test");
context.std.backend.add("api", "api.example.com", 443, true, {
	connect_timeout: 2000,
	first_byte_timeout: 20000,
	between_bytes_timeout: 15000,
});

context.std.backend.add("static", "static.example.com", 80, false);

console.log("Added backends:");
console.log(`API backend: ${JSON.stringify(context.backends.api, null, 2)}`);
console.log(
	`Static backend: ${JSON.stringify(context.backends.static, null, 2)}`,
);

// Test adding a health check probe
console.log("\nHealth Check Probe Test");
context.std.backend.add_probe("api", {
	request:
		"HEAD /health HTTP/1.1\r\nHost: api.example.com\r\nConnection: close\r\n\r\n",
	expected_response: 200,
	interval: 10000,
	timeout: 5000,
	window: 5,
	threshold: 3,
	initial: 2,
});

console.log(
	`API backend with probe: ${JSON.stringify(context.backends.api, null, 2)}`,
);

// Test setting the current backend
console.log("\nSetting Current Backend Test");
console.log(`Current backend before: ${context.req.backend}`);
context.std.backend.set_current("api");
console.log(`Current backend after: ${context.req.backend}`);
console.log(
	`Current backend object: ${JSON.stringify(context.current_backend, null, 2)}`,
);

// Test removing a backend
console.log("\nRemoving Backend Test");
console.log(
	`Backends before removal: ${Object.keys(context.backends).join(", ")}`,
);
context.std.backend.remove("static");
console.log(
	`Backends after removal: ${Object.keys(context.backends).join(", ")}`,
);

// Test director creation
console.log("\nDirector Creation Test");
context.std.director.add("main_director", "random", {
	quorum: 50,
	retries: 3,
});

console.log(
	`Created director: ${JSON.stringify(context.directors.main_director, null, 2)}`,
);

// Test adding backends to a director
console.log("\nAdding Backends to Director Test");
context.std.director.add_backend("main_director", "default", 1);
context.std.director.add_backend("main_director", "api", 2);

console.log(
	`Director with backends: ${JSON.stringify(context.directors.main_director, null, 2)}`,
);

// Test backend selection
console.log("\nBackend Selection Test");
console.log("Selecting backend from director 10 times:");
for (let i = 0; i < 10; i++) {
	const selectedBackend = context.std.director.select_backend("main_director");
	console.log(
		`Selection ${i + 1}: ${selectedBackend ? selectedBackend.name : "none"}`,
	);
}

// Test fallback director
console.log("\nFallback Director Test");
context.std.director.add("fallback_director", "fallback");
context.std.director.add_backend("fallback_director", "api", 1);
context.std.director.add_backend("fallback_director", "default", 1);

console.log(
	`Fallback director: ${JSON.stringify(context.directors.fallback_director, null, 2)}`,
);
console.log("Selected backend from fallback director:");
const fallbackBackend =
	context.std.director.select_backend("fallback_director");
console.log(`Selected: ${fallbackBackend ? fallbackBackend.name : "none"}`);

// Test backend health changes
console.log("\nBackend Health Test");
console.log(`API backend health before: ${context.backends.api.is_healthy}`);
context.backends.api.is_healthy = false;
console.log(`API backend health after: ${context.backends.api.is_healthy}`);
console.log("Selected backend from fallback director after API is unhealthy:");
const fallbackBackend2 =
	context.std.director.select_backend("fallback_director");
console.log(`Selected: ${fallbackBackend2 ? fallbackBackend2.name : "none"}`);

console.log("\nAll backend configuration tests completed!");
