/**
 * CSRF Protection Module
 * 
 * This module provides CSRF protection functionality for the VCL implementation.
 * It includes functions for generating and validating CSRF tokens.
 */

import { createHash } from 'crypto';
import { VCLContext } from './vcl-compiler';

/**
 * Generate a CSRF token based on client information and a secret
 * 
 * @param context - The VCL context
 * @param secret - The secret used to generate the token
 * @returns The generated CSRF token
 */
export function generateCSRFToken(context: VCLContext, secret: string): string {
  const clientIp = context.client?.ip || '127.0.0.1';
  const userAgent = context.req.http['User-Agent'] || '';
  const timestamp = context.time?.hex ? context.time.hex : Date.now().toString(16);
  
  // Create a hash of the client information and secret
  return createHash('sha256')
    .update(`${clientIp}${userAgent}${secret}${timestamp}`)
    .digest('hex');
}

/**
 * Validate a CSRF token
 * 
 * @param context - The VCL context
 * @param token - The token to validate
 * @param secret - The secret used to generate the token
 * @returns True if the token is valid, false otherwise
 */
export function validateCSRFToken(context: VCLContext, token: string, secret: string): boolean {
  const expectedToken = generateCSRFToken(context, secret);
  return token === expectedToken;
}

/**
 * Add CSRF protection to a request
 * 
 * This function adds CSRF protection to a request by:
 * - For GET requests: Generating a CSRF token and adding it to the response headers
 * - For other methods: Validating the CSRF token in the request headers
 * 
 * @param context - The VCL context
 * @param secret - The secret used to generate the token
 * @returns True if the request is allowed, false if it should be blocked
 */
export function protectAgainstCSRF(context: VCLContext, secret: string): boolean {
  // For GET requests, generate a token
  if (context.req.method === 'GET') {
    const token = generateCSRFToken(context, secret);
    context.req.http['X-CSRF-Token'] = token;
    return true;
  }
  
  // For other methods, validate the token
  const token = context.req.http['X-CSRF-Token'];
  if (!token) {
    return false;
  }
  
  return validateCSRFToken(context, token, secret);
}

/**
 * Add CSRF token to response headers
 * 
 * This function adds the CSRF token to the response headers for GET requests
 * 
 * @param context - The VCL context
 */
export function addCSRFTokenToResponse(context: VCLContext): void {
  if (context.req.method === 'GET' && context.req.http['X-CSRF-Token']) {
    context.resp.http['X-CSRF-Token'] = context.req.http['X-CSRF-Token'];
  }
}

/**
 * CSRF protection VCL snippet
 * 
 * This is a VCL snippet that can be included in a VCL file to add CSRF protection
 */
export const csrfProtectionVCL = `
# CSRF Protection
sub vcl_recv {
  # For GET requests, generate a CSRF token
  if (req.method == "GET") {
    set req.http.X-CSRF-Token = digest.hash_sha256(
      client.ip + 
      req.http.User-Agent + 
      "secret-salt" + 
      std.time.hex_to_time(time.hex)
    );
  } 
  # For other methods, validate the token
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
  # Add the CSRF token to the response headers for GET requests
  if (req.method == "GET" && req.http.X-CSRF-Token) {
    set resp.http.X-CSRF-Token = req.http.X-CSRF-Token;
  }
}
`;
