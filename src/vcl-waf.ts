/**
 * VCL WAF Module - Web Application Firewall functionality
 */

interface RateLimitBucket {
	tokens: number;
	lastRefill: number;
	maxTokens: number;
	refillRate: number;
}

const rateLimitBuckets = new Map<string, RateLimitBucket>();
let wafLogs: string[] = [];

const ATTACK_PATTERNS: Record<string, RegExp> = {
	sql: /(union\s+select|insert\s+into|update\s+set|delete\s+from|drop\s+table|exec\s+xp_|'--)/i,
	xss: /(<script|javascript:|on\w+\s*=|alert\s*\()/i,
	path: /(\.\.\/|\.\.\\|%2e%2e%2f|%2e%2e\/|\.\.%2f)/i,
	command: /(\|\s*\w+|;\s*\w+\s*;|`\s*\w+)/i,
	lfi: /(\/etc\/passwd|\/etc\/shadow|\/proc\/self|\/var\/log)/i,
	rfi: /(https?:\/\/|ftp:\/\/|php:\/\/|data:\/\/)/i,
};

export const WAFModule = {
	init(): void {
		rateLimitBuckets.clear();
		wafLogs = [];
	},

	allow(): void {
		console.log("[WAF] Request explicitly allowed");
	},

	block(status: number, message: string): void {
		console.log(`[WAF] Request blocked with status ${status}: ${message}`);
		throw new Error(`${status} ${message}`);
	},

	log(message: string): void {
		const logEntry = `${new Date().toISOString()} [WAF] ${message}`;
		wafLogs.push(logEntry);
		console.log(logEntry);
	},

	rate_limit(key: string, limit: number, window: number): boolean {
		const now = Date.now();

		if (!rateLimitBuckets.has(key)) {
			rateLimitBuckets.set(key, {
				tokens: limit,
				lastRefill: now,
				maxTokens: limit,
				refillRate: limit / (window * 1000),
			});
		}

		const bucket = rateLimitBuckets.get(key)!;
		const timeElapsed = now - bucket.lastRefill;
		const tokensToAdd = timeElapsed * bucket.refillRate;

		bucket.tokens = Math.min(bucket.maxTokens, bucket.tokens + tokensToAdd);
		bucket.lastRefill = now;

		if (bucket.tokens >= 1) {
			bucket.tokens -= 1;
			return true;
		}
		return false;
	},

	rate_limit_tokens(key: string): number {
		if (!rateLimitBuckets.has(key)) {
			return 0;
		}

		const bucket = rateLimitBuckets.get(key)!;
		const now = Date.now();
		const timeElapsed = now - bucket.lastRefill;
		const tokensToAdd = timeElapsed * bucket.refillRate;
		const currentTokens = Math.min(
			bucket.maxTokens,
			bucket.tokens + tokensToAdd,
		);

		return Math.floor(currentTokens);
	},

	detect_attack(requestData: string, attackType: string): boolean {
		if (!requestData) {
			return false;
		}

		if (attackType in ATTACK_PATTERNS) {
			return ATTACK_PATTERNS[attackType].test(requestData);
		}

		if (attackType === "any") {
			for (const pattern of Object.values(ATTACK_PATTERNS)) {
				if (pattern.test(requestData)) {
					return true;
				}
			}
		}

		return false;
	},

	get_logs(): string[] {
		return [...wafLogs];
	},

	clear_logs(): void {
		wafLogs.length = 0;
	},
};
