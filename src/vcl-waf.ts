/**
 * VCL WAF Module
 *
 * This module provides Web Application Firewall (WAF) functionality for the VCL implementation,
 * including request blocking, allowing, logging, and rate limiting.
 */

// Store rate limit buckets with token counts
interface RateLimitBucket {
  tokens: number;
  lastRefill: number;
  maxTokens: number;
  refillRate: number; // tokens per millisecond
}

// Store rate limit buckets by key
const rateLimitBuckets = new Map<string, RateLimitBucket>();

// Store WAF logs
let wafLogs: string[] = [];

/**
 * WAF Module
 */
export const WAFModule = {
  /**
   * Initialize the WAF module
   */
  init: () => {
    // Clear any existing state
    rateLimitBuckets.clear();
    wafLogs = [];
  },

  /**
   * Explicitly allows a request that might otherwise be blocked by WAF rules.
   * This function sets a flag in the context to indicate that the request should be allowed.
   */
  allow: (): void => {
    // In a real implementation, this would set a flag to bypass WAF rules
    console.log('[WAF] Request explicitly allowed');
  },

  /**
   * Explicitly blocks a request with a specified status code and message.
   *
   * @param status - The HTTP status code to return (e.g., 403)
   * @param message - The message to include in the response
   */
  block: (status: number, message: string): void => {
    console.log(`[WAF] Request blocked with status ${ status }: ${ message }`);
    throw new Error(`${ status } ${ message }`);
  },

  /**
   * Logs a message to the WAF logging endpoint.
   *
   * @param message - The message to log
   */
  log: (message: string): void => {
    const timestamp = new Date().toISOString();
    const logEntry = `${ timestamp } [WAF] ${ message }`;

    // Store log in memory
    wafLogs.push(logEntry);

    // Also output to console for debugging
    console.log(logEntry);
  },

  /**
   * Implements a token bucket rate limiter.
   *
   * @param key - The key to rate limit on (e.g., client.ip)
   * @param limit - The maximum number of requests allowed in the window
   * @param window - The time window for the rate limit in seconds
   * @returns TRUE if the request should be allowed, FALSE if the rate limit is exceeded
   */
  rate_limit: (key: string, limit: number, window: number): boolean => {
    const now = Date.now();

    // Create bucket if it doesn't exist
    if (!rateLimitBuckets.has(key)) {
      rateLimitBuckets.set(key, {
        tokens: limit,
        lastRefill: now,
        maxTokens: limit,
        refillRate: limit / (window * 1000) // tokens per millisecond
      });
    }

    // Get the bucket
    const bucket = rateLimitBuckets.get(key)!;

    // Calculate tokens to add based on time elapsed
    const timeElapsed = now - bucket.lastRefill;
    const tokensToAdd = timeElapsed * bucket.refillRate;

    // Refill the bucket
    bucket.tokens = Math.min(bucket.maxTokens, bucket.tokens + tokensToAdd);
    bucket.lastRefill = now;

    // Check if we have enough tokens
    if (bucket.tokens >= 1) {
      // Consume a token
      bucket.tokens -= 1;
      return true; // Allow the request
    } else {
      return false; // Block the request
    }
  },

  /**
   * Returns the number of tokens remaining in a rate limit bucket.
   *
   * @param key - The key used in a previous waf.rate_limit call
   * @returns The number of tokens remaining in the bucket
   */
  rate_limit_tokens: (key: string): number => {
    if (!rateLimitBuckets.has(key)) {
      return 0;
    }

    const bucket = rateLimitBuckets.get(key)!;
    const now = Date.now();

    // Calculate tokens to add based on time elapsed
    const timeElapsed = now - bucket.lastRefill;
    const tokensToAdd = timeElapsed * bucket.refillRate;

    // Calculate current tokens without modifying the bucket
    const currentTokens = Math.min(bucket.maxTokens, bucket.tokens + tokensToAdd);

    return Math.floor(currentTokens);
  },

  /**
   * Detects if a request contains malicious patterns.
   *
   * @param requestData - The request data to check (URL, headers, body, etc.)
   * @param attackType - The type of attack to check for (sql, xss, path, etc.)
   * @returns TRUE if the request is malicious, FALSE otherwise
   */
  detect_attack: (requestData: string, attackType: string): boolean => {
    if (!requestData) {
      return false;
    }

    const patterns: Record<string, RegExp> = {
      'sql': /(union\s+select|insert\s+into|update\s+set|delete\s+from|drop\s+table|exec\s+xp_|'--)/i,
      'xss': /(<script|javascript:|on\w+\s*=|alert\s*\()/i,
      'path': /(\.\.\/|\.\.\\|%2e%2e%2f|%2e%2e\/|\.\.%2f)/i,
      'command': /(\|\s*\w+|;\s*\w+\s*;|`\s*\w+)/i,
      'lfi': /(\/etc\/passwd|\/etc\/shadow|\/proc\/self|\/var\/log)/i,
      'rfi': /(https?:\/\/|ftp:\/\/|php:\/\/|data:\/\/)/i
    };

    if (attackType in patterns) {
      return patterns[attackType].test(requestData);
    } else if (attackType === 'any') {
      // Check all patterns
      for (const pattern of Object.values(patterns)) {
        if (pattern.test(requestData)) {
          return true;
        }
      }
    }

    return false;
  },

  /**
   * Gets all WAF logs.
   *
   * @returns Array of WAF log entries
   */
  get_logs: (): string[] => {
    return [...wafLogs];
  },

  /**
   * Clears all WAF logs.
   */
  clear_logs: (): void => {
    wafLogs.length = 0;
  }
};
