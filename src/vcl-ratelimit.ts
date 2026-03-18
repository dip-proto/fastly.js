/**
 * VCL Rate Limiting Module - rate counters, penalty boxes, and multi-window rate limiting
 *
 * Fastly VCL signatures:
 *   ratelimit.check_rate(STRING, ID, INTEGER, INTEGER, INTEGER, ID, RTIME) -> BOOL
 *   ratelimit.check_rates(STRING, ID, INTEGER, INTEGER, INTEGER, ID, INTEGER, INTEGER, INTEGER, ID, RTIME) -> BOOL
 *   ratelimit.ratecounter_increment(ID, STRING, INTEGER) -> INTEGER
 *   ratelimit.penaltybox_add(ID, STRING, RTIME) -> void
 *   ratelimit.penaltybox_has(ID, STRING) -> BOOL
 */

import { parseTimeValue } from "./vcl-time";

interface RateCounter {
	count: number;
	lastReset: number;
	window: number;
}

interface PenaltyBoxEntry {
	identifier: string;
	expiresAt: number;
}

const rateCounters = new Map<string, RateCounter>();
const penaltyBoxes = new Map<string, Map<string, PenaltyBoxEntry>>();

const DEFAULT_WINDOW_MS = 60000;

function getOrCreateCounter(name: string, windowMs: number = DEFAULT_WINDOW_MS): RateCounter {
	const now = Date.now();
	let counter = rateCounters.get(name);

	if (!counter) {
		counter = { count: 0, lastReset: now, window: windowMs };
		rateCounters.set(name, counter);
	}

	if (now - counter.lastReset > counter.window) {
		counter.count = 0;
		counter.lastReset = now;
	}

	return counter;
}

function toSeconds(value: any): number {
	if (typeof value === "number") return value;
	return parseTimeValue(String(value));
}

export const RateLimitModule = {
	init(): void {
		rateCounters.clear();
		penaltyBoxes.clear();
	},

	open_window(windowSeconds: number): string {
		const now = Date.now();
		const windowId = `window_${now}_${Math.random().toString(36).substring(2, 9)}`;
		rateCounters.set(windowId, {
			count: 0,
			lastReset: now,
			window: windowSeconds * 1000,
		});
		return windowId;
	},

	/**
	 * ratelimit.ratecounter_increment(ratecounter_name, entry, delta)
	 * VCL: (ID, STRING, INTEGER) -> INTEGER
	 */
	ratecounter_increment(counterName: string, entry: string, delta: number): number {
		const key = `${counterName}:${entry}`;
		const counter = getOrCreateCounter(key);
		counter.count += delta;
		return counter.count;
	},

	/**
	 * ratelimit.check_rate(entry, ratecounter, threshold, window, delta, penaltybox, ttl)
	 * VCL: (STRING, ID, INTEGER, INTEGER, INTEGER, ID, RTIME) -> BOOL
	 */
	check_rate(
		entry: string,
		ratecounterName: string,
		threshold: number,
		windowSec: number,
		delta: number,
		penaltyboxName: string,
		ttl: number,
	): boolean {
		const key = `${ratecounterName}:${entry}`;
		const counter = getOrCreateCounter(key, windowSec * 1000);
		counter.count += delta;

		if (counter.count > threshold) {
			RateLimitModule.penaltybox_add(penaltyboxName, entry, ttl);
			return true;
		}
		return false;
	},

	/**
	 * ratelimit.check_rates(entry, rc1, threshold1, window1, delta1, pb1, threshold2, window2, delta2, pb2, ttl)
	 * VCL: (STRING, ID, INTEGER, INTEGER, INTEGER, ID, INTEGER, INTEGER, INTEGER, ID, RTIME) -> BOOL
	 */
	check_rates(
		entry: string,
		rc1: string,
		threshold1: number,
		window1: number,
		delta1: number,
		pb1: string,
		threshold2: number,
		window2: number,
		delta2: number,
		pb2: string,
		ttl: number,
	): boolean {
		const parsedTtl = toSeconds(ttl);
		let exceeded = false;

		const key1 = `${rc1}:${entry}:${window1}`;
		const counter1 = getOrCreateCounter(key1, window1 * 1000);
		counter1.count += delta1;
		if (counter1.count > threshold1) {
			RateLimitModule.penaltybox_add(pb1, entry, parsedTtl);
			exceeded = true;
		}

		const key2 = `${rc1}:${entry}:${window2}`;
		const counter2 = getOrCreateCounter(key2, window2 * 1000);
		counter2.count += delta2;
		if (counter2.count > threshold2) {
			RateLimitModule.penaltybox_add(pb2, entry, parsedTtl);
			exceeded = true;
		}

		return exceeded;
	},

	/**
	 * ratelimit.penaltybox_add(penaltybox_name, entry, duration)
	 * VCL: (ID, STRING, RTIME) -> void
	 */
	penaltybox_add(penaltyboxName: string, identifier: string, duration: number): void {
		let penaltyBox = penaltyBoxes.get(penaltyboxName);
		if (!penaltyBox) {
			penaltyBox = new Map<string, PenaltyBoxEntry>();
			penaltyBoxes.set(penaltyboxName, penaltyBox);
		}

		penaltyBox.set(identifier, {
			identifier,
			expiresAt: Date.now() + toSeconds(duration) * 1000,
		});
	},

	/**
	 * ratelimit.penaltybox_has(penaltybox_name, entry)
	 * VCL: (ID, STRING) -> BOOL
	 */
	penaltybox_has(penaltyboxName: string, identifier: string): boolean {
		const penaltyBox = penaltyBoxes.get(penaltyboxName);
		if (!penaltyBox) {
			return false;
		}

		const entry = penaltyBox.get(identifier);
		if (!entry) {
			return false;
		}

		if (entry.expiresAt <= Date.now()) {
			penaltyBox.delete(identifier);
			return false;
		}

		return true;
	},
};
