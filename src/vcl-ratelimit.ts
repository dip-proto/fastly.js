/**
 * VCL Rate Limiting Module
 *
 * This module provides rate limiting functionality for the VCL implementation,
 * including rate counters, penalty boxes, and multi-window rate limiting.
 */

// Rate limiting data structures
interface RateCounter {
  count: number;
  lastReset: number;
  window: number; // in milliseconds
}

interface PenaltyBoxEntry {
  identifier: string;
  expiresAt: number;
}

// Global rate limiting state
const rateCounters = new Map<string, RateCounter>();
const penaltyBoxes = new Map<string, Map<string, PenaltyBoxEntry>>();

/**
 * Rate Limiting Module
 */
export const RateLimitModule = {
  /**
   * Initialize the rate limiting module
   */
  init: () => {
    // Clear any existing state
    rateCounters.clear();
    penaltyBoxes.clear();
  },

  /**
   * Opens a rate counter window with the specified duration.
   * 
   * @param windowSeconds - The duration of the window in seconds
   * @returns A unique identifier for the window
   */
  open_window: (windowSeconds: number): string => {
    const windowId = `window_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const windowMs = windowSeconds * 1000;

    // Create a new rate counter
    rateCounters.set(windowId, {
      count: 0,
      lastReset: Date.now(),
      window: windowMs
    });

    return windowId;
  },

  /**
   * Increments a named rate counter by a specified amount.
   * 
   * @param counterName - The name of the rate counter to increment
   * @param incrementBy - The amount to increment the counter by (default: 1)
   * @returns The new count value
   */
  ratecounter_increment: (counterName: string, incrementBy: number = 1): number => {
    const now = Date.now();
    const counter = rateCounters.get(counterName) || {
      count: 0,
      lastReset: now,
      window: 60000 // Default window: 60 seconds
    };

    // Reset counter if window has passed
    if (now - counter.lastReset > counter.window) {
      counter.count = 0;
      counter.lastReset = now;
    }

    // Increment the counter
    counter.count += incrementBy;

    // Store the updated counter
    rateCounters.set(counterName, counter);

    return counter.count;
  },

  /**
   * Checks if a rate limit has been exceeded.
   * 
   * @param counterName - The name of the rate counter to check
   * @param ratePerSecond - The maximum allowed rate per second
   * @returns TRUE if the rate limit has been exceeded, FALSE otherwise
   */
  check_rate: (counterName: string, ratePerSecond: number): boolean => {
    const now = Date.now();
    const counter = rateCounters.get(counterName);

    if (!counter) {
      // No counter exists, create it and increment
      RateLimitModule.ratecounter_increment(counterName, 1);
      return false; // Not exceeded on first request
    }

    // Reset counter if window has passed
    if (now - counter.lastReset > counter.window) {
      counter.count = 1; // Reset and count this request
      counter.lastReset = now;
      rateCounters.set(counterName, counter);
      return false; // Not exceeded after reset
    }

    // Calculate elapsed time since last reset
    const elapsedSeconds = Math.max(1, (now - counter.lastReset) / 1000);

    // Calculate the current rate
    const currentRate = counter.count / elapsedSeconds;

    // Increment the counter for this request
    counter.count += 1;
    rateCounters.set(counterName, counter);

    // Check if the rate is exceeded
    return currentRate > ratePerSecond;
  },

  /**
   * Checks if any of multiple rate limits have been exceeded.
   * 
   * @param counterName - The name of the rate counter to check
   * @param rates - A comma-separated list of rates in the format "count:seconds"
   * @returns TRUE if any rate limit has been exceeded, FALSE otherwise
   */
  check_rates: (counterName: string, rates: string): boolean => {
    // Parse the rates string
    const rateSpecs = rates.split(',').map(spec => {
      const [count, seconds] = spec.trim().split(':').map(Number);
      return { count, seconds };
    });

    const now = Date.now();
    let exceeded = false;

    // Check each rate specification
    for (const spec of rateSpecs) {
      if (!spec.count || !spec.seconds) {
        continue; // Skip invalid specs
      }

      const windowKey = `${counterName}_${spec.seconds}s`;
      const counter = rateCounters.get(windowKey) || {
        count: 0,
        lastReset: now,
        window: spec.seconds * 1000
      };

      // Reset counter if window has passed
      if (now - counter.lastReset > counter.window) {
        counter.count = 1; // Reset and count this request
        counter.lastReset = now;
      } else {
        // Increment the counter for this request
        counter.count += 1;
      }

      // Store the updated counter
      rateCounters.set(windowKey, counter);

      // Check if this rate is exceeded
      if (counter.count > spec.count) {
        exceeded = true;
      }
    }

    return exceeded;
  },

  /**
   * Adds an identifier to a penalty box for a specified duration.
   * 
   * @param penaltyboxName - The name of the penalty box
   * @param identifier - The identifier to add to the penalty box
   * @param duration - The duration in seconds to keep the identifier in the penalty box
   */
  penaltybox_add: (penaltyboxName: string, identifier: string, duration: number): void => {
    const now = Date.now();
    const expiresAt = now + (duration * 1000);

    // Get or create the penalty box
    let penaltyBox = penaltyBoxes.get(penaltyboxName);
    if (!penaltyBox) {
      penaltyBox = new Map<string, PenaltyBoxEntry>();
      penaltyBoxes.set(penaltyboxName, penaltyBox);
    }

    // Add the identifier to the penalty box
    penaltyBox.set(identifier, {
      identifier,
      expiresAt
    });
  },

  /**
   * Checks if an identifier is in a penalty box.
   * 
   * @param penaltyboxName - The name of the penalty box
   * @param identifier - The identifier to check
   * @returns TRUE if the identifier is in the penalty box, FALSE otherwise
   */
  penaltybox_has: (penaltyboxName: string, identifier: string): boolean => {
    const now = Date.now();
    const penaltyBox = penaltyBoxes.get(penaltyboxName);

    if (!penaltyBox) {
      return false; // Penalty box doesn't exist
    }

    const entry = penaltyBox.get(identifier);
    if (!entry) {
      return false; // Identifier not in penalty box
    }

    // Check if the entry has expired
    if (entry.expiresAt <= now) {
      // Remove expired entry
      penaltyBox.delete(identifier);
      return false;
    }

    return true; // Identifier is in penalty box and not expired
  }
};
