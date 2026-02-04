/**
 * CSRF Protection Module
 * Provides CSRF token generation and validation for the VCL implementation.
 */

import { createHash } from "node:crypto";
import type { VCLContext } from "./vcl-compiler";

export function generateCSRFToken(context: VCLContext, secret: string): string {
	const clientIp = context.client?.ip || "127.0.0.1";
	const userAgent = context.req.http["User-Agent"] || "";
	// Use time module's hex property if available, otherwise use current timestamp
	const timeModule = context.time as { hex?: string } | undefined;
	const timestamp = timeModule?.hex ?? Date.now().toString(16);

	return createHash("sha256").update(`${clientIp}${userAgent}${secret}${timestamp}`).digest("hex");
}

export function validateCSRFToken(context: VCLContext, token: string, secret: string): boolean {
	const expectedToken = generateCSRFToken(context, secret);
	return token === expectedToken;
}

export function protectAgainstCSRF(context: VCLContext, secret: string): boolean {
	if (context.req.method === "GET") {
		const token = generateCSRFToken(context, secret);
		context.req.http["X-CSRF-Token"] = token;
		return true;
	}

	const token = context.req.http["X-CSRF-Token"];
	if (!token) {
		return false;
	}

	return validateCSRFToken(context, token, secret);
}

export function addCSRFTokenToResponse(context: VCLContext): void {
	if (context.req.method === "GET" && context.req.http["X-CSRF-Token"]) {
		context.resp.http["X-CSRF-Token"] = context.req.http["X-CSRF-Token"];
	}
}

export const csrfProtectionVCL = `
# CSRF Protection
sub vcl_recv {
  if (req.method == "GET") {
    set req.http.X-CSRF-Token = digest.hash_sha256(
      client.ip +
      req.http.User-Agent +
      "secret-salt" +
      std.time.hex_to_time(time.hex)
    );
  }
  else {
    declare local var.expected_token STRING;
    set var.expected_token = digest.hash_sha256(
      client.ip +
      req.http.User-Agent +
      "secret-salt" +
      std.time.hex_to_time(time.hex)
    );

    if (req.http.X-CSRF-Token != var.expected_token) {
      error 403 "CSRF token validation failed";
    }
  }
}

sub vcl_deliver {
  if (req.method == "GET" && req.http.X-CSRF-Token) {
    set resp.http.X-CSRF-Token = req.http.X-CSRF-Token;
  }
}
`;
