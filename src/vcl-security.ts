/**
 * VCL Security Module
 *
 * This module provides security-related functionality for the VCL implementation,
 * including WAF (Web Application Firewall) and rate limiting capabilities.
 */

// Rate limiting data structures
interface RateCounter {
  count: number;
  lastReset: number;
  window: number; // in milliseconds
}

interface RateLimitBucket {
  tokens: number;
  lastRefill: number;
  maxTokens: number;
  refillRate: number; // tokens per second
}

interface PenaltyBoxEntry {
  identifier: string;
  expiresAt: number;
}

// Global rate limiting state
const rateCounters = new Map<string, RateCounter>();
const rateLimitBuckets = new Map<string, RateLimitBucket>();
const penaltyBoxes = new Map<string, Map<string, PenaltyBoxEntry>>();

/**
 * WAF and Rate Limiting Module
 */
export const SecurityModule = {
  /**
   * Initialize the security module
   */
  init: () => {
    // Clear any existing state
    rateCounters.clear();
    rateLimitBuckets.clear();
    penaltyBoxes.clear();
  },

  /**
   * WAF Functions
   */
  waf: {
    /**
     * Explicitly allows a request that might otherwise be blocked by WAF rules.
     * This function sets a flag in the context to indicate that the request should be allowed.
     */
    allow: (context: any) => {
      context.waf = context.waf || {};
      context.waf.allowed = true;
      console.log(`[WAF] Request explicitly allowed`);
    },

    /**
     * Explicitly blocks a request with a specified status code and message.
     * This function triggers an error response with the specified status and message.
     */
    block: (context: any, status: number, message: string) => {
      context.waf = context.waf || {};
      context.waf.blocked = true;
      context.waf.blockStatus = status;
      context.waf.blockMessage = message;
      console.log(`[WAF] Request blocked: ${ status } ${ message }`);

      // Trigger an error response
      return context.std.error(status, message);
    },

    /**
     * Logs a message to the WAF logging endpoint.
     * This function logs a message with a WAF prefix for easier filtering.
     */
    log: (context: any, message: string) => {
      console.log(`[WAF] ${ message }`);
    },

    /**
     * Implements a token bucket rate limiter.
     * Returns true if the request should be allowed, false if it should be blocked.
     */
    rate_limit: (context: any, key: string, limit: number, window: number) => {
      // Convert window from seconds to milliseconds
      const windowMs = window * 1000;
      const now = Date.now();
      const bucketKey = `rate_${ key }`;

      // Get or create the rate counter
      let counter = rateCounters.get(bucketKey);
      if (!counter) {
        counter = {
          count: 0,
          lastReset: now,
          window: windowMs
        };
        rateCounters.set(bucketKey, counter);
      }

      // Reset counter if window has passed
      if (now - counter.lastReset > counter.window) {
        counter.count = 0;
        counter.lastReset = now;
      }

      // Increment counter
      counter.count++;

      // Check if limit is exceeded
      const allowed = counter.count <= limit;

      // Log the rate limit check
      console.log(`[WAF] Rate limit check: key=${ key }, count=${ counter.count }, limit=${ limit }, allowed=${ allowed }`);

      return allowed;
    },

    /**
     * Checks if a request contains malicious patterns.
     * Returns true if the request is malicious, false otherwise.
     */
    detect_attack: (context: any, requestData: string, attackType: string) => {
      if (!requestData) {
        return false;
      }

      let isAttack = false;
      const patterns: Record<string, RegExp> = {
        'sql': /(union\s+select|insert\s+into|update\s+set|delete\s+from|drop\s+table|exec\s+xp_|'--)/i,
        'xss': /(<script|javascript:|on\w+\s*=|alert\s*\()/i,
        'path': /(\.\.\/|\.\.\\)/i,
        'command': /(\|\s*\w+|;\s*\w+\s*;|`\s*\w+)/i
      };

      if (attackType in patterns) {
        isAttack = patterns[attackType].test(requestData);
        if (isAttack) {
          console.log(`[WAF] ${ attackType.toUpperCase() } attack detected in: ${ requestData.substring(0, 100) }`);
        }
      } else if (attackType === 'any') {
        // Check all patterns
        for (const [type, pattern] of Object.entries(patterns)) {
          if (pattern.test(requestData)) {
            isAttack = true;
            console.log(`[WAF] ${ type.toUpperCase() } attack detected in: ${ requestData.substring(0, 100) }`);
            break;
          }
        }
      }

      return isAttack;
    },

    /**
     * Returns the number of tokens remaining in a rate limit bucket.
     */
    rate_limit_tokens: (context: any, key: string) => {
      const bucketKey = `rate_${ key }`;
      const counter = rateCounters.get(bucketKey);

      if (!counter) {
        return 0; // No counter exists, return 0 tokens
      }

      // If the window has passed, all tokens are available
      const now = Date.now();
      if (now - counter.lastReset > counter.window) {
        return counter.count;
      }

      // Return remaining tokens
      return Math.max(0, counter.count);
    }
  },

  /**
   * Rate Limiting Functions
   */
  ratelimit: {
    /**
     * Opens a rate counter window with the specified duration.
     */
    open_window: (context: any, windowSeconds: number) => {
      const windowId = `window_${ Date.now() }_${ Math.random().toString(36).substring(2, 9) }`;
      const windowMs = windowSeconds * 1000;

      // Create a new rate counter
      rateCounters.set(windowId, {
        count: 0,
        lastReset: Date.now(),
        window: windowMs
      });

      console.log(`[RateLimit] Opened rate counter window: ${ windowId }, duration: ${ windowSeconds }s`);

      return windowId;
    },

    /**
     * Increments a named rate counter by a specified amount.
     */
    ratecounter_increment: (context: any, counterName: string, incrementBy: number = 1) => {
      const now = Date.now();
      const counter = rateCounters.get(counterName) || {
        count: 0,
        lastReset: now,
        window: 60000 // Default window: 60 seconds
      };

      // Increment the counter
      counter.count += incrementBy;

      // Store the updated counter
      rateCounters.set(counterName, counter);

      console.log(`[RateLimit] Incremented counter ${ counterName } by ${ incrementBy }, new count: ${ counter.count }`);
    },

    /**
     * Checks if a rate limit has been exceeded.
     * Returns true if the rate limit has been exceeded, false otherwise.
     */
    check_rate: (context: any, counterName: string, ratePerSecond: number) => {
      const now = Date.now();
      const counter = rateCounters.get(counterName);

      if (!counter) {
        return false; // No counter exists, not exceeded
      }

      // Calculate elapsed time since last reset
      const elapsedSeconds = (now - counter.lastReset) / 1000;

      // Calculate the current rate
      const currentRate = counter.count / elapsedSeconds;

      // Check if the rate is exceeded
      const isExceeded = currentRate > ratePerSecond;

      console.log(`[RateLimit] Rate check: ${ counterName }, current rate: ${ currentRate.toFixed(2) }/s, limit: ${ ratePerSecond }/s, exceeded: ${ isExceeded }`);

      return isExceeded;
    },

    /**
     * Checks if any of multiple rate limits have been exceeded.
     * Returns true if any rate limit has been exceeded, false otherwise.
     */
    check_rates: (context: any, counterName: string, rates: string) => {
      // Parse the rates string (format: "count:seconds,count:seconds,...")
      const rateSpecs = rates.split(',').map(spec => {
        const [count, seconds] = spec.split(':').map(Number);
        return {count, seconds};
      });

      // Check each rate specification
      for (const spec of rateSpecs) {
        const windowKey = `${ counterName }_${ spec.seconds }s`;
        const counter = rateCounters.get(windowKey) || {
          count: 0,
          lastReset: Date.now(),
          window: spec.seconds * 1000
        };

        // Reset counter if window has passed
        const now = Date.now();
        if (now - counter.lastReset > counter.window) {
          counter.count = 0;
          counter.lastReset = now;
          rateCounters.set(windowKey, counter);
        }

        // Check if count exceeds the limit
        if (counter.count >= spec.count) {
          console.log(`[RateLimit] Multi-window rate exceeded: ${ windowKey }, count: ${ counter.count }, limit: ${ spec.count }`);
          return true; // Rate limit exceeded
        }
      }

      return false; // No rate limits exceeded
    },

    /**
     * Adds an identifier to a penalty box for a specified duration.
     */
    penaltybox_add: (context: any, penaltyboxName: string, identifier: string, duration: number) => {
      // Get or create the penalty box
      let penaltyBox = penaltyBoxes.get(penaltyboxName);
      if (!penaltyBox) {
        penaltyBox = new Map<string, PenaltyBoxEntry>();
        penaltyBoxes.set(penaltyboxName, penaltyBox);
      }

      // Add the identifier to the penalty box
      const expiresAt = Date.now() + (duration * 1000);
      penaltyBox.set(identifier, {
        identifier,
        expiresAt
      });

      console.log(`[RateLimit] Added ${ identifier } to penalty box ${ penaltyboxName }, expires in ${ duration }s`);
    },

    /**
     * Checks if an identifier is in a penalty box.
     * Returns true if the identifier is in the penalty box, false otherwise.
     */
    penaltybox_has: (context: any, penaltyboxName: string, identifier: string) => {
      const penaltyBox = penaltyBoxes.get(penaltyboxName);
      if (!penaltyBox) {
        return false; // Penalty box doesn't exist
      }

      const entry = penaltyBox.get(identifier);
      if (!entry) {
        return false; // Identifier not in penalty box
      }

      // Check if the entry has expired
      const now = Date.now();
      if (now > entry.expiresAt) {
        // Entry has expired, remove it
        penaltyBox.delete(identifier);
        return false;
      }

      console.log(`[RateLimit] ${ identifier } is in penalty box ${ penaltyboxName }, expires in ${ ((entry.expiresAt - now) / 1000).toFixed(1) }s`);
      return true; // Identifier is in penalty box and not expired
    }
  }
};
