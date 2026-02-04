/**
 * Test script for VCL HTTP functions
 */

import { createVCLContext } from "../../src/vcl";

// Create a VCL context
const context = createVCLContext();

// Create test headers
const testHeaders: Record<string, string> = {
	Host: "example.com",
	"User-Agent": "Mozilla/5.0",
	Accept: "text/html",
	"Accept-Language": "en-US,en;q=0.5",
	"Accept-Encoding": "gzip, deflate",
	Connection: "keep-alive",
	"X-Forwarded-For": "192.168.1.1",
	"X-Custom-Header": "custom-value",
	"X-Debug-Info": "debug-info",
	"X-Debug-Level": "verbose",
	"X-Internal-ID": "12345",
	"X-API-Key": "api-key-value",
	"Content-Type": "application/json",
	"Content-Length": "256",
};

console.log("HTTP Header Functions Test\n");

// Test header.get function
console.log("header.get Tests");
console.log(`Host header: ${context.std!.header!.get(testHeaders, "Host")}`);
console.log(`User-Agent header: ${context.std!.header!.get(testHeaders, "User-Agent")}`);
console.log(`Non-existent header: ${context.std!.header!.get(testHeaders, "Non-Existent")}`);
console.log(`Case-insensitive test: ${context.std!.header!.get(testHeaders, "content-type")}`);

// Test header.set function
console.log("\nheader.set Tests");
context.std!.header!.set(testHeaders, "New-Header", "new-value");
context.std!.header!.set(testHeaders, "X-Custom-Header", "updated-value");
console.log(`After setting New-Header: ${context.std!.header!.get(testHeaders, "New-Header")}`);
console.log(
	`After updating X-Custom-Header: ${context.std!.header!.get(testHeaders, "X-Custom-Header")}`,
);

// Test header.remove function
console.log("\nheader.remove Tests");
console.log(
	`Before removal - X-Debug-Info: ${context.std!.header!.get(testHeaders, "X-Debug-Info")}`,
);
context.std!.header!.remove(testHeaders, "X-Debug-Info");
console.log(
	`After removal - X-Debug-Info: ${context.std!.header!.get(testHeaders, "X-Debug-Info")}`,
);

// Test header.filter function
console.log("\nheader.filter Tests");
console.log("Headers before filtering:");
console.log(JSON.stringify(testHeaders, null, 2));

// Filter out all X-Debug headers
context.std!.header!.filter(testHeaders, "^X-Debug");
console.log("\nAfter filtering X-Debug headers:");
console.log(JSON.stringify(testHeaders, null, 2));

// Create a new set of headers for filter_except test
const filterExceptHeaders = { ...testHeaders };

// Test header.filter_except function
console.log("\nheader.filter_except Tests");
console.log("Headers before filter_except:");
console.log(JSON.stringify(filterExceptHeaders, null, 2));

// Keep only essential headers
context.std!.header!.filter_except(filterExceptHeaders, "^(Host|User-Agent|Content-Type)$");
console.log("\nAfter filter_except to keep only Host, User-Agent, and Content-Type:");
console.log(JSON.stringify(filterExceptHeaders, null, 2));

// Test with invalid regex pattern
console.log("\nError Handling Tests");
try {
	context.std!.header!.filter(testHeaders, "[");
	console.log("Invalid regex test for filter: No error thrown");
} catch (e) {
	console.log(`Error with invalid regex for filter: ${e}`);
}

try {
	context.std!.header!.filter_except(testHeaders, "[");
	console.log("Invalid regex test for filter_except: No error thrown");
} catch (e) {
	console.log(`Error with invalid regex for filter_except: ${e}`);
}

console.log("\nHTTP Status Functions Test\n");

// Test http.status_matches function
console.log("http.status_matches Tests");

// Test with success status codes
console.log("Success status codes:");
console.log(`200 matches "2xx": ${context.std!.http!.status_matches(200, "2xx")}`);
console.log(`200 matches "success": ${context.std!.http!.status_matches(200, "success")}`);
console.log(`200 matches "200": ${context.std!.http!.status_matches(200, "200")}`);
console.log(`200 matches "3xx": ${context.std!.http!.status_matches(200, "3xx")}`);

// Test with redirect status codes
console.log("\nRedirect status codes:");
console.log(`301 matches "3xx": ${context.std!.http!.status_matches(301, "3xx")}`);
console.log(`301 matches "redirect": ${context.std!.http!.status_matches(301, "redirect")}`);
console.log(`301 matches "301": ${context.std!.http!.status_matches(301, "301")}`);
console.log(`301 matches "2xx": ${context.std!.http!.status_matches(301, "2xx")}`);

// Test with client error status codes
console.log("\nClient error status codes:");
console.log(`404 matches "4xx": ${context.std!.http!.status_matches(404, "4xx")}`);
console.log(
	`404 matches "client_error": ${context.std!.http!.status_matches(404, "client_error")}`,
);
console.log(`404 matches "error": ${context.std!.http!.status_matches(404, "error")}`);
console.log(`404 matches "404": ${context.std!.http!.status_matches(404, "404")}`);

// Test with server error status codes
console.log("\nServer error status codes:");
console.log(`500 matches "5xx": ${context.std!.http!.status_matches(500, "5xx")}`);
console.log(
	`500 matches "server_error": ${context.std!.http!.status_matches(500, "server_error")}`,
);
console.log(`500 matches "error": ${context.std!.http!.status_matches(500, "error")}`);
console.log(`500 matches "500": ${context.std!.http!.status_matches(500, "500")}`);

console.log("\nAll HTTP function tests completed!");
