/**
 * VCL Time Functions Module
 *
 * Implements the date-and-time VCL builtins, matching Fastly's behavior.
 *
 * Reference: https://developer.fastly.com/reference/vcl/functions/date-and-time/
 */

import { VCLTime } from "./vcl-value";

export interface TimeModule {
	now: () => Date;
	/** time.add(TIME, RTIME) -> TIME */
	add: (time: any, duration?: any) => any;
	/** time.sub(TIME, RTIME) -> TIME */
	sub: (time: any, duration?: any) => any;
	/** time.is_after(TIME, TIME) -> BOOL */
	is_after: (time1: any, time2?: any) => boolean;
	/** time.hex_to_time(INTEGER divisor, STRING hex) -> TIME */
	hex_to_time: (divisor: any, hex?: any) => any;
	/** time.units(STRING unit, TIME) -> STRING (null when unit is invalid: EINVAL) */
	units: (unit: any, time?: any) => any;
	/** time.runits(STRING unit, RTIME) -> STRING (null when unit is invalid: EINVAL) */
	runits: (unit: any, rtime?: any) => any;
	/** time.interval_elapsed_ratio(TIME now, TIME start, TIME end) -> FLOAT */
	interval_elapsed_ratio: (now: any, start?: any, end?: any) => any;
	hex?: string; // Current time as hex string (for compatibility)
}

export type StrftimeFunction = (format: string, time: Date) => any;

export type ParseTimeDeltaFunction = (delta: string) => any;

const MONTHS = [
	"January",
	"February",
	"March",
	"April",
	"May",
	"June",
	"July",
	"August",
	"September",
	"October",
	"November",
	"December",
];
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTH_ABBREV = MONTHS.map((m) => m.slice(0, 3));

const pad2 = (n: number) => String(n).padStart(2, "0");
const padSpace2 = (n: number) => String(n).padStart(2, " ");

export const TIME_UNITS: Record<string, number> = {
	ms: 0.001,
	s: 1,
	m: 60,
	h: 3600,
	d: 86400,
	w: 604800,
	y: 31536000,
};

/** Go's zero time.Time instant (year 1, Jan 1, 00:00:00 UTC) in epoch ms. */
const GO_ZERO_TIME_MS = -62135596800000;

/**
 * Out-of-bounds TIME value (std.time with a negative epoch).
 * Stringifies as "[out of bounds]", matching Fastly's behavior.
 */
class OutOfBoundsTime extends VCLTime {
	override toUTCString(): string {
		return "[out of bounds]";
	}
}

/** TIME arguments may arrive as Date/VCLTime or as epoch-milliseconds. */
function toEpochMs(v: any): number {
	if (v instanceof Date) return v.getTime();
	return Number(v);
}

/** TIME +/- RTIME. A TIME passed as the duration contributes its epoch seconds. */
function shiftTime(time: any, duration: any, sign: 1 | -1): VCLTime {
	const base = toEpochMs(time);
	const deltaMs = duration instanceof Date ? duration.getTime() : rtimeSeconds(duration) * 1000;
	return new VCLTime(base + sign * deltaMs);
}

/** Unix seconds the way Go computes them (floor of ms/1000). */
function unixSeconds(ms: number): number {
	return Math.floor(ms / 1000);
}

/** RTIME arguments arrive as VCLRTime (valueOf() = seconds) or plain seconds. */
function rtimeSeconds(v: any): number {
	return Number(v);
}

export function parseTimeValue(str: string): number {
	const match = str.match(/^(-?\d+(?:\.\d+)?)(ms|s|m|h|d|w|y)?$/);
	if (!match) return 0;
	const num = parseFloat(match[1] ?? "0");
	const unit = match[2] || "s";
	return num * (TIME_UNITS[unit] || 1);
}

export function createTimeModule(platform?: { now(): number }): TimeModule {
	const now = () => platform?.now() ?? Date.now();
	return {
		now: (): Date => new VCLTime(now()),

		// TIME + RTIME -> TIME. When the second argument is a TIME, its
		// seconds-within-the-minute component is added.
		add: (time: any, duration?: any): any => shiftTime(time, duration, 1),

		// TIME - RTIME -> TIME.
		sub: (time: any, duration?: any): any => shiftTime(time, duration, -1),

		is_after: (time1: any, time2?: any): boolean => toEpochMs(time1) > toEpochMs(time2),

		// ParseInt(hex, 16, 64) / divisor = unix seconds. BigInt keeps the
		// full int64 range exact, with truncating division like Go.
		hex_to_time: (divisor: any, hex?: any): any => {
			const div = Math.trunc(Number(divisor));
			const str = String(hex);
			if (div === 0 || Number.isNaN(div)) return null;
			// Go's strconv.ParseInt(s, 16, 64): optional sign, hex digits only,
			// and an error when the value overflows int64.
			const m = str.match(/^([+-]?)([0-9A-Fa-f]+)$/);
			if (!m) return null;
			let ts = BigInt(`0x${m[2]}`);
			if (m[1] === "-") ts = -ts;
			if (ts > 9223372036854775807n || ts < -9223372036854775808n) return null;
			return new VCLTime(Number(ts / BigInt(div)) * 1000);
		},

		// STRING unit, TIME -> STRING.
		units: (unit: any, time?: any): any => {
			const ms = toEpochMs(time);
			switch (String(unit)) {
				case "s":
					return String(unixSeconds(ms));
				case "ms":
					return (ms / 1000).toFixed(3);
				case "us":
					return (ms / 1000).toFixed(6);
				case "ns":
					return (ms / 1000).toFixed(9);
				default:
					// Fastly sets fastly.error = "EINVAL" and returns a not-set STRING.
					return null;
			}
		},

		// STRING unit, RTIME -> STRING. Go durations are integer nanoseconds
		// and each unit truncates toward zero.
		runits: (unit: any, rtime?: any): any => {
			const ns = Math.round(rtimeSeconds(rtime) * 1e9);
			switch (String(unit)) {
				case "s":
					return String(Math.trunc(ns / 1e9));
				case "ms":
					return (Math.trunc(ns / 1e6) / 1e3).toFixed(3);
				case "us":
					return (Math.trunc(ns / 1e3) / 1e6).toFixed(6);
				case "ns":
					return (ns / 1e9).toFixed(9);
				default:
					// Fastly sets fastly.error = "EINVAL" and returns a not-set STRING.
					return null;
			}
		},

		// Unclamped ratio over unix seconds.
		interval_elapsed_ratio: (nowTime: any, start?: any, end?: any): any => {
			const ref = unixSeconds(toEpochMs(nowTime));
			const s = unixSeconds(toEpochMs(start));
			const e = unixSeconds(toEpochMs(end));
			// Division by zero yields Infinity/NaN exactly like Go float division.
			return (ref - s) / (e - s);
		},
	};
}

/** std.integer2time(INTEGER unix-seconds) -> TIME. */
export function std_integer2time(seconds: any): Date {
	return new VCLTime(Math.trunc(Number(seconds)) * 1000);
}

interface ParsedParts {
	year: number;
	month: number; // 1-12
	day: number;
	hour: number;
	minute: number;
	second: number;
}

const MONTH_INDEX: Record<string, number> = {};
for (let i = 0; i < MONTH_ABBREV.length; i++) MONTH_INDEX[MONTH_ABBREV[i]!.toLowerCase()] = i + 1;

/** Month abbreviation to 1-12, ASCII case-insensitive like Go's matcher. */
function monthIndex(abbr: string): number {
	return MONTH_INDEX[abbr.toLowerCase()] ?? 0;
}

/** Go's two-digit year rule: 69-99 -> 19xx, 00-68 -> 20xx. */
function expandYear2(yy: number): number {
	return yy >= 69 ? 1900 + yy : 2000 + yy;
}

/**
 * Validate the components and return epoch ms (UTC), or null when any
 * component is out of range (Go's time.Parse rejects those).
 */
function componentsToUTC(p: ParsedParts): number | null {
	if (p.month < 1 || p.month > 12) return null;
	if (p.hour > 23 || p.minute > 59 || p.second > 59) return null;
	const d = new Date(0);
	d.setUTCFullYear(p.year, p.month - 1, p.day);
	d.setUTCHours(p.hour, p.minute, p.second, 0);
	if (
		d.getUTCFullYear() !== p.year ||
		d.getUTCMonth() !== p.month - 1 ||
		d.getUTCDate() !== p.day ||
		d.getUTCHours() !== p.hour
	) {
		return null; // e.g. day out of range for the month
	}
	return d.getTime();
}

/**
 * Validate a timezone token the way Go's parseTimeZone does for the "MST"
 * layout token: 3 uppercase letters, 4-5 uppercase letters ending in "T",
 * the specials ChST/MeST/WITA, "GMT" optionally followed by a signed hour
 * offset <= 23, or a signed numeric offset <= 23 ("+02", "+0000", ...).
 *
 * Go builds the parsed time with Date(..., UTC) and only setLoc()s a fake
 * fixed zone afterwards, so none of these ever shift the instant; they all
 * behave as UTC. (Abbreviations that happen to name the *host's local zone*
 * do get their real offset applied in Go; that host-dependent behavior is
 * intentionally not reproduced.)
 */
function isValidGoZone(z: string): boolean {
	if (z.length < 3) return false;
	if (z === "ChST" || z === "MeST" || z === "WITA") return true;
	if (z.startsWith("GMT")) {
		const rest = z.slice(3);
		if (rest === "") return true;
		const m = rest.match(/^[+-](\d+)$/);
		return m !== null && Number(m[1]) <= 23;
	}
	if (z[0] === "+" || z[0] === "-") {
		const m = z.match(/^[+-](\d+)$/);
		return m !== null && Number(m[1]) <= 23;
	}
	if (/^[A-Z]{3}$/.test(z)) return true;
	if (/^[A-Z]{4}$/.test(z)) return z[3] === "T";
	if (/^[A-Z]{5}$/.test(z)) return z[4] === "T";
	return false;
}

// Go's name matcher is ASCII case-insensitive, so weekday/month names match
// in any case (zone tokens do not; they are validated separately).
const WDAY_ABBR_RE = "(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)";
const WDAY_FULL_RE = "(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)";
const MON_RE = "(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)";

const RFC1123_RE = new RegExp(
	`^${WDAY_ABBR_RE}, (\\d{2}) ${MON_RE} (\\d{4}) (\\d{1,2}):(\\d{2}):(\\d{2}) (\\S+)$`,
	"i",
);
const RFC822_RE = new RegExp(`^(\\d{2}) ${MON_RE} (\\d{2}) (\\d{1,2}):(\\d{2}) (\\S+)$`, "i");
const RFC850_RE = new RegExp(
	`^${WDAY_FULL_RE}, (\\d{2})-${MON_RE}-(\\d{2}) (\\d{1,2}):(\\d{2}):(\\d{2}) (\\S+)$`,
	"i",
);
const ANSIC_RE = new RegExp(
	`^${WDAY_ABBR_RE} ${MON_RE} {1,2}(\\d{1,2}) (\\d{1,2}):(\\d{2}):(\\d{2}) (\\d{4})$`,
	"i",
);

// Go layouts tried in order: RFC1123, RFC822, RFC850, ANSIC, then
// "2006-01-02 15:04:05".
const STD_TIME_PARSERS: Array<(s: string) => number | null> = [
	// RFC1123: "Mon, 02 Jan 2006 15:04:05 MST"
	(s) => {
		const m = s.match(RFC1123_RE);
		if (!m || !isValidGoZone(m[7]!)) return null;
		return componentsToUTC({
			day: Number(m[1]),
			month: monthIndex(m[2]!),
			year: Number(m[3]),
			hour: Number(m[4]),
			minute: Number(m[5]),
			second: Number(m[6]),
		});
	},
	// RFC822: "02 Jan 06 15:04 MST"
	(s) => {
		const m = s.match(RFC822_RE);
		if (!m || !isValidGoZone(m[6]!)) return null;
		return componentsToUTC({
			day: Number(m[1]),
			month: monthIndex(m[2]!),
			year: expandYear2(Number(m[3])),
			hour: Number(m[4]),
			minute: Number(m[5]),
			second: 0,
		});
	},
	// RFC850: "Monday, 02-Jan-06 15:04:05 MST"
	(s) => {
		const m = s.match(RFC850_RE);
		if (!m || !isValidGoZone(m[7]!)) return null;
		return componentsToUTC({
			day: Number(m[1]),
			month: monthIndex(m[2]!),
			year: expandYear2(Number(m[3])),
			hour: Number(m[4]),
			minute: Number(m[5]),
			second: Number(m[6]),
		});
	},
	// ANSIC: "Mon Jan _2 15:04:05 2006" (no zone -> UTC)
	(s) => {
		const m = s.match(ANSIC_RE);
		if (!m) return null;
		return componentsToUTC({
			month: monthIndex(m[1]!),
			day: Number(m[2]),
			hour: Number(m[3]),
			minute: Number(m[4]),
			second: Number(m[5]),
			year: Number(m[6]),
		});
	},
	// ISO 8601 subset: "2006-01-02 15:04:05" (parsed as UTC)
	(s) => {
		const m = s.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{1,2}):(\d{2}):(\d{2})$/);
		if (!m) return null;
		return componentsToUTC({
			year: Number(m[1]),
			month: Number(m[2]),
			day: Number(m[3]),
			hour: Number(m[4]),
			minute: Number(m[5]),
			second: Number(m[6]),
		});
	},
];

/**
 * std.time(STRING, TIME fallback) -> TIME.
 *
 * Tries the format list; on success returns immediately (no out-of-bounds
 * check on that path, matching Fastly's behavior). Otherwise parses unix epoch seconds
 * (anything after a "." is dropped); when that fails the fallback is used.
 * On this second path, a negative unix time yields an out-of-bounds TIME
 * that stringifies as "[out of bounds]".
 */
export function std_time(str: any, fallback: any): Date {
	const s = String(str);
	for (const parse of STD_TIME_PARSERS) {
		const ms = parse(s);
		if (ms !== null) return new VCLTime(ms);
	}

	// Try unix epoch seconds; strip anything after a ".".
	const dot = s.indexOf(".");
	const intPart = dot === -1 ? s : s.slice(0, dot);
	let ms: number;
	if (/^[+-]?\d+$/.test(intPart)) {
		ms = parseInt(intPart, 10) * 1000;
	} else {
		ms = toEpochMs(fallback);
	}

	if (unixSeconds(ms) < 0) {
		// An out-of-bounds TIME holding Go's zero time.
		return new OutOfBoundsTime(GO_ZERO_TIME_MS);
	}
	return new VCLTime(ms);
}

/**
 * strftime with Fastly's semantics (verified against production): standard
 * POSIX conversion specifiers computed on UTC components, padding flags
 * "0" (zero), "_" (space) and "-" (none) with optional width digits that are
 * accepted but ignored, and no-op E/O modifiers. %Z is always "GMT" and %z
 * "+0000" since VCL TIME values carry no zone. Unsupported specifiers
 * (e.g. %l, %P) are a compile error on Fastly; this returns null (not set).
 */
export function createStrftime(): StrftimeFunction {
	return (format: any, time: any): any => {
		const t = time instanceof Date ? time : new Date(Number(time));
		const formatStr = String(format);
		if (Number.isNaN(t.getTime())) return null;

		const year = t.getUTCFullYear();
		const mon = t.getUTCMonth() + 1;
		const day = t.getUTCDate();
		const hour = t.getUTCHours();
		const min = t.getUTCMinutes();
		const sec = t.getUTCSeconds();
		const wday = t.getUTCDay(); // Sunday = 0
		const isoWday = wday === 0 ? 7 : wday; // Monday = 1 ... Sunday = 7

		const startOfYear = Date.UTC(year, 0, 1);
		const yday = Math.floor((t.getTime() - startOfYear) / 86400000) + 1;

		// ISO 8601 week number and week-based year (%V, %G, %g)
		const isoWeekAndYear = (): { week: number; year: number } => {
			const target = new Date(Date.UTC(year, t.getUTCMonth(), day));
			target.setUTCDate(target.getUTCDate() + 4 - isoWday);
			const isoYear = target.getUTCFullYear();
			const jan4 = new Date(Date.UTC(isoYear, 0, 4));
			const jan4IsoWday = jan4.getUTCDay() === 0 ? 7 : jan4.getUTCDay();
			const firstThursday = new Date(Date.UTC(isoYear, 0, 4 + (4 - jan4IsoWday)));
			const week = 1 + Math.round((target.getTime() - firstThursday.getTime()) / 604800000);
			return { week, year: isoYear };
		};

		// POSIX %U (weeks start Sunday) and %W (weeks start Monday): days before
		// the year's first week day count as week 0.
		const weekOfYear = (firstDay: number): number => {
			const shifted = firstDay === 0 ? wday : (wday + 6) % 7;
			return Math.floor((yday + 6 - shifted) / 7);
		};

		const hour12 = hour % 12 === 0 ? 12 : hour % 12;
		const ampm = hour < 12 ? "AM" : "PM";

		type Conv = { value: string; numeric: boolean };
		const convert = (spec: string): Conv | null => {
			switch (spec) {
				case "a":
					return { value: DAYS[wday]!.slice(0, 3), numeric: false };
				case "A":
					return { value: DAYS[wday]!, numeric: false };
				case "b":
				case "h":
					return { value: MONTHS[mon - 1]!.slice(0, 3), numeric: false };
				case "B":
					return { value: MONTHS[mon - 1]!, numeric: false };
				case "c":
					return {
						value: `${DAYS[wday]!.slice(0, 3)} ${MONTHS[mon - 1]!.slice(0, 3)} ${padSpace2(day)} ${pad2(hour)}:${pad2(min)}:${pad2(sec)} ${year}`,
						numeric: false,
					};
				case "C":
					return { value: pad2(Math.floor(year / 100)), numeric: true };
				case "d":
					return { value: pad2(day), numeric: true };
				case "D":
				case "x":
					return { value: `${pad2(mon)}/${pad2(day)}/${pad2(year % 100)}`, numeric: false };
				case "e":
					return { value: padSpace2(day), numeric: true };
				case "F":
					return { value: `${year}-${pad2(mon)}-${pad2(day)}`, numeric: false };
				case "G":
					return { value: String(isoWeekAndYear().year), numeric: true };
				case "g":
					return { value: pad2(isoWeekAndYear().year % 100), numeric: true };
				case "H":
					return { value: pad2(hour), numeric: true };
				case "I":
					return { value: pad2(hour12), numeric: true };
				case "j":
					return { value: String(yday).padStart(3, "0"), numeric: true };
				case "m":
					return { value: pad2(mon), numeric: true };
				case "M":
					return { value: pad2(min), numeric: true };
				case "n":
					return { value: "\n", numeric: false };
				case "p":
					return { value: ampm, numeric: false };
				case "r":
					return { value: `${pad2(hour12)}:${pad2(min)}:${pad2(sec)} ${ampm}`, numeric: false };
				case "R":
					return { value: `${pad2(hour)}:${pad2(min)}`, numeric: false };
				case "s":
					return { value: String(Math.floor(t.getTime() / 1000)), numeric: true };
				case "S":
					return { value: pad2(sec), numeric: true };
				case "t":
					return { value: "\t", numeric: false };
				case "T":
				case "X":
					return { value: `${pad2(hour)}:${pad2(min)}:${pad2(sec)}`, numeric: false };
				case "u":
					return { value: String(isoWday), numeric: true };
				case "U":
					return { value: pad2(weekOfYear(0)), numeric: true };
				case "V":
					return { value: pad2(isoWeekAndYear().week), numeric: true };
				case "w":
					return { value: String(wday), numeric: true };
				case "W":
					return { value: pad2(weekOfYear(1)), numeric: true };
				case "y":
					return { value: pad2(year % 100), numeric: true };
				case "Y":
					return { value: String(year), numeric: true };
				case "z":
					return { value: "+0000", numeric: false };
				case "Z":
					return { value: "GMT", numeric: false };
				case "%":
					return { value: "%", numeric: false };
				default:
					return null;
			}
		};

		let result = "";
		let i = 0;
		while (i < formatStr.length) {
			const ch = formatStr[i]!;
			if (ch !== "%") {
				result += ch;
				i++;
				continue;
			}
			i++;
			if (i >= formatStr.length) return null;

			// Optional padding flag, then optional width digits (accepted but
			// ignored), then no-op E/O modifiers.
			let flag = "";
			if (formatStr[i] === "0" || formatStr[i] === "_" || formatStr[i] === "-") {
				flag = formatStr[i]!;
				i++;
			}
			while (i < formatStr.length && formatStr[i]! >= "0" && formatStr[i]! <= "9") i++;
			if (formatStr[i] === "E" || formatStr[i] === "O") i++;
			if (i >= formatStr.length) return null;

			const spec = formatStr[i]!;
			i++;
			const conv = convert(spec);
			if (conv === null) return null;

			let out = conv.value;
			if (flag !== "" && conv.numeric) {
				const bare = out.replace(/^[0 ]+(?=.)/, "");
				if (flag === "-") out = bare;
				else if (flag === "0") out = bare.padStart(out.length, "0");
				else if (flag === "_") out = bare.padStart(out.length, " ");
			}
			result += out;
		}

		return result;
	};
}

/**
 * parse_time_delta: skip leading whitespace, parse an optional sign and a
 * run of digits, then read at most one unit character (d/h/m, case
 * insensitive; anything else means seconds). Everything after the unit is
 * silently ignored ("1d2h" == "1d"). Invalid or negative input returns -1.
 */
export function createParseTimeDelta(): ParseTimeDeltaFunction {
	return (delta: any): any => {
		const spec = String(delta);
		let i = 0;
		while (i < spec.length && /[ \t\n\v\f\r]/.test(spec[i]!)) i++;
		const start = i;
		if (i < spec.length && (spec[i] === "+" || spec[i] === "-")) i++;
		if (i === spec.length || spec[i]! < "0" || spec[i]! > "9") return -1;
		while (i < spec.length && spec[i]! >= "0" && spec[i]! <= "9") i++;
		const v = Number(spec.slice(start, i));
		if (!Number.isSafeInteger(v) || v < 0) return -1;

		let unit = 1;
		if (i < spec.length) {
			switch (spec[i]) {
				case "d":
				case "D":
					unit = 24 * 3600;
					break;
				case "h":
				case "H":
					unit = 3600;
					break;
				case "m":
				case "M":
					unit = 60;
					break;
			}
		}
		const result = v * unit;
		return Number.isSafeInteger(result) ? result : -1;
	};
}
