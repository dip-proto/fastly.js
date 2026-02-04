/**
 * VCL Security Module
 * Provides WAF (Web Application Firewall) and rate limiting capabilities.
 */

interface RateCounter {
	count: number;
	lastReset: number;
	window: number;
}

interface RateLimitBucket {
	tokens: number;
	lastRefill: number;
	maxTokens: number;
	refillRate: number;
}

interface PenaltyBoxEntry {
	identifier: string;
	expiresAt: number;
}

const rateCounters = new Map<string, RateCounter>();
const rateLimitBuckets = new Map<string, RateLimitBucket>();
const penaltyBoxes = new Map<string, Map<string, PenaltyBoxEntry>>();

export const SecurityModule = {
	init: (): void => {
		rateCounters.clear();
		rateLimitBuckets.clear();
		penaltyBoxes.clear();
	},

	waf: {
		allow: (context: any): void => {
			context.waf = context.waf || {};
			context.waf.allowed = true;
		},

		block: (context: any, status: number, message: string): any => {
			context.waf = context.waf || {};
			context.waf.blocked = true;
			context.waf.blockStatus = status;
			context.waf.blockMessage = message;
			return context.std.error(status, message);
		},

		log: (_context: any, message: string): void => {
			console.log(`[WAF] ${message}`);
		},

		rate_limit: (_context: any, key: string, limit: number, window: number): boolean => {
			const windowMs = window * 1000;
			const now = Date.now();
			const bucketKey = `rate_${key}`;

			let counter = rateCounters.get(bucketKey);
			if (!counter) {
				counter = { count: 0, lastReset: now, window: windowMs };
				rateCounters.set(bucketKey, counter);
			}

			if (now - counter.lastReset > counter.window) {
				counter.count = 0;
				counter.lastReset = now;
			}

			counter.count++;
			return counter.count <= limit;
		},

		detect_attack: (_context: any, requestData: string, attackType: string): boolean => {
			if (!requestData) {
				return false;
			}

			const patterns: Record<string, RegExp> = {
				sql: /(union\s+select|insert\s+into|update\s+set|delete\s+from|drop\s+table|exec\s+xp_|'--)/i,
				xss: /(<script|javascript:|on\w+\s*=|alert\s*\()/i,
				path: /(\.\.\/|\.\.\\)/i,
				command: /(\|\s*\w+|;\s*\w+\s*;|`\s*\w+)/i,
			};

			if (attackType in patterns) {
				return patterns[attackType as keyof typeof patterns]!.test(requestData);
			}

			if (attackType === "any") {
				return Object.values(patterns).some((pattern) => pattern.test(requestData));
			}

			return false;
		},

		rate_limit_tokens: (_context: any, key: string): number => {
			const bucketKey = `rate_${key}`;
			const counter = rateCounters.get(bucketKey);

			if (!counter) {
				return 0;
			}

			const now = Date.now();
			if (now - counter.lastReset > counter.window) {
				return counter.count;
			}

			return Math.max(0, counter.count);
		},
	},

	ratelimit: {
		open_window: (_context: any, windowSeconds: number): string => {
			const windowId = `window_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
			const windowMs = windowSeconds * 1000;

			rateCounters.set(windowId, {
				count: 0,
				lastReset: Date.now(),
				window: windowMs,
			});

			return windowId;
		},

		ratecounter_increment: (_context: any, counterName: string, incrementBy: number = 1): void => {
			const now = Date.now();
			const counter = rateCounters.get(counterName) || {
				count: 0,
				lastReset: now,
				window: 60000,
			};

			counter.count += incrementBy;
			rateCounters.set(counterName, counter);
		},

		check_rate: (_context: any, counterName: string, ratePerSecond: number): boolean => {
			const now = Date.now();
			const counter = rateCounters.get(counterName);

			if (!counter) {
				return false;
			}

			const elapsedSeconds = (now - counter.lastReset) / 1000;
			const currentRate = counter.count / elapsedSeconds;
			return currentRate > ratePerSecond;
		},

		check_rates: (_context: any, counterName: string, rates: string): boolean => {
			const rateSpecs = rates.split(",").map((spec) => {
				const [count, seconds] = spec.split(":").map(Number);
				return { count, seconds };
			});

			for (const spec of rateSpecs) {
				const windowKey = `${counterName}_${spec.seconds ?? 0}s`;
				const counter = rateCounters.get(windowKey) || {
					count: 0,
					lastReset: Date.now(),
					window: (spec.seconds ?? 0) * 1000,
				};

				const now = Date.now();
				if (now - counter.lastReset > counter.window) {
					counter.count = 0;
					counter.lastReset = now;
					rateCounters.set(windowKey, counter);
				}

				if (counter.count >= (spec.count ?? 0)) {
					return true;
				}
			}

			return false;
		},

		penaltybox_add: (
			_context: any,
			penaltyboxName: string,
			identifier: string,
			duration: number,
		): void => {
			let penaltyBox = penaltyBoxes.get(penaltyboxName);
			if (!penaltyBox) {
				penaltyBox = new Map<string, PenaltyBoxEntry>();
				penaltyBoxes.set(penaltyboxName, penaltyBox);
			}

			const expiresAt = Date.now() + duration * 1000;
			penaltyBox.set(identifier, { identifier, expiresAt });
		},

		penaltybox_has: (_context: any, penaltyboxName: string, identifier: string): boolean => {
			const penaltyBox = penaltyBoxes.get(penaltyboxName);
			if (!penaltyBox) {
				return false;
			}

			const entry = penaltyBox.get(identifier);
			if (!entry) {
				return false;
			}

			const now = Date.now();
			if (now > entry.expiresAt) {
				penaltyBox.delete(identifier);
				return false;
			}

			return true;
		},
	},
};
