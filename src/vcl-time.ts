/**
 * VCL Time Functions Module
 *
 * Implements all time.* functions from Fastly VCL.
 * Reference: https://developer.fastly.com/reference/vcl/functions/date-and-time/
 */

export interface TimeModule {
	now: () => Date;
	add: (time: Date, duration: number) => Date;
	sub: (time1: Date, time2: Date) => number;
	is_after: (time1: Date, time2: Date) => boolean;
	hex_to_time: (hex: string) => Date;
	units: (duration: string) => number;
	runits: (seconds: number) => string;
	interval_elapsed_ratio: (start: Date, interval: number) => number;
}

export type StrftimeFunction = (format: string, time: Date) => string;

export type ParseTimeDeltaFunction = (delta: string) => number;

const WEEKDAY_NAMES = [
	"Sunday",
	"Monday",
	"Tuesday",
	"Wednesday",
	"Thursday",
	"Friday",
	"Saturday",
];
const WEEKDAY_ABBREV = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
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
const MONTH_ABBREV = [
	"Jan",
	"Feb",
	"Mar",
	"Apr",
	"May",
	"Jun",
	"Jul",
	"Aug",
	"Sep",
	"Oct",
	"Nov",
	"Dec",
];

const TIME_UNITS: Record<string, number> = {
	ms: 0.001,
	s: 1,
	m: 60,
	h: 3600,
	d: 86400,
	w: 604800,
	y: 31536000,
};

function pad(n: number, width: number): string {
	return String(n).padStart(width, "0");
}

function padSpace(n: number, width: number): string {
	return String(n).padStart(width, " ");
}

function getAmPm(hour: number): string {
	return hour >= 12 ? "PM" : "AM";
}

function getISOWeek(date: Date): number {
	const d = new Date(
		Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
	);
	const dayNum = d.getUTCDay() || 7;
	d.setUTCDate(d.getUTCDate() + 4 - dayNum);
	const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
	return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

function getDayOfYear(date: Date): number {
	const start = new Date(date.getFullYear(), 0, 0);
	return Math.floor((date.getTime() - start.getTime()) / 86400000);
}

function parseTimeValue(str: string): number {
	const match = str.match(/^(-?\d+(?:\.\d+)?)(ms|s|m|h|d|w|y)?$/);
	if (!match) return 0;
	const num = parseFloat(match[1]);
	const unit = match[2] || "s";
	return num * (TIME_UNITS[unit] || 1);
}

export function createTimeModule(): TimeModule {
	return {
		now: (): Date => new Date(),

		add: (time: Date, duration: number): Date =>
			new Date(time.getTime() + duration),

		sub: (time1: Date, time2: Date): number =>
			time1.getTime() - time2.getTime(),

		is_after: (time1: Date, time2: Date): boolean =>
			time1.getTime() > time2.getTime(),

		hex_to_time: (hex: string): Date => {
			const trimmed = String(hex).trim();
			if (!/^[0-9A-Fa-f]+$/.test(trimmed)) return new Date(0);
			const timestamp = parseInt(trimmed, 16);
			return Number.isNaN(timestamp) ? new Date(0) : new Date(timestamp * 1000);
		},

		units: (duration: string): number =>
			parseTimeValue(String(duration).trim()),

		runits: (seconds: number): string => {
			const sec = Math.abs(seconds);
			const sign = seconds < 0 ? "-" : "";

			if (sec >= 31536000) return `${sign + (sec / 31536000).toFixed(3)}y`;
			if (sec >= 604800) return `${sign + (sec / 604800).toFixed(3)}w`;
			if (sec >= 86400) return `${sign + (sec / 86400).toFixed(3)}d`;
			if (sec >= 3600) return `${sign + (sec / 3600).toFixed(3)}h`;
			if (sec >= 60) return `${sign + (sec / 60).toFixed(3)}m`;
			return `${sign + sec.toFixed(3)}s`;
		},

		interval_elapsed_ratio: (start: Date, interval: number): number => {
			if (interval <= 0) return 0;
			const elapsed = Date.now() - start.getTime();
			return Math.min(1, Math.max(0, elapsed / interval));
		},
	};
}

export function createStrftime(): StrftimeFunction {
	return (format: string, time: Date): string => {
		const t = time;
		const formatStr = String(format);
		let result = "";
		let i = 0;

		while (i < formatStr.length) {
			if (formatStr[i] !== "%") {
				result += formatStr[i++];
				continue;
			}

			i++;
			if (i >= formatStr.length) break;

			// Handle modifiers
			let modifier = "";
			if ("-_0EO".includes(formatStr[i])) {
				modifier = formatStr[i++];
				if (i >= formatStr.length) break;
			}

			const spec = formatStr[i++];
			const hour12 = t.getHours() % 12 || 12;

			switch (spec) {
				case "a":
					result += WEEKDAY_ABBREV[t.getDay()];
					break;
				case "A":
					result += WEEKDAY_NAMES[t.getDay()];
					break;
				case "b":
				case "h":
					result += MONTH_ABBREV[t.getMonth()];
					break;
				case "B":
					result += MONTH_NAMES[t.getMonth()];
					break;
				case "c":
					result += t.toLocaleString();
					break;
				case "C":
					result += Math.floor(t.getFullYear() / 100);
					break;
				case "d":
					result += modifier === "-" ? t.getDate() : pad(t.getDate(), 2);
					break;
				case "D":
					result +=
						pad(t.getMonth() + 1, 2) +
						"/" +
						pad(t.getDate(), 2) +
						"/" +
						pad(t.getFullYear() % 100, 2);
					break;
				case "e":
					result += modifier === "-" ? t.getDate() : padSpace(t.getDate(), 2);
					break;
				case "F":
					result +=
						t.getFullYear() +
						"-" +
						pad(t.getMonth() + 1, 2) +
						"-" +
						pad(t.getDate(), 2);
					break;
				case "g":
					result += pad(t.getFullYear() % 100, 2);
					break;
				case "G":
					result += t.getFullYear();
					break;
				case "H":
					result += modifier === "-" ? t.getHours() : pad(t.getHours(), 2);
					break;
				case "I":
					result += modifier === "-" ? hour12 : pad(hour12, 2);
					break;
				case "j":
					result += pad(getDayOfYear(t), 3);
					break;
				case "k":
					result += padSpace(t.getHours(), 2);
					break;
				case "l":
					result += padSpace(hour12, 2);
					break;
				case "m":
					result +=
						modifier === "-" ? t.getMonth() + 1 : pad(t.getMonth() + 1, 2);
					break;
				case "M":
					result += pad(t.getMinutes(), 2);
					break;
				case "n":
					result += "\n";
					break;
				case "p":
					result += getAmPm(t.getHours());
					break;
				case "P":
					result += getAmPm(t.getHours()).toLowerCase();
					break;
				case "r":
					result +=
						pad(hour12, 2) +
						":" +
						pad(t.getMinutes(), 2) +
						":" +
						pad(t.getSeconds(), 2) +
						" " +
						getAmPm(t.getHours());
					break;
				case "R":
					result += `${pad(t.getHours(), 2)}:${pad(t.getMinutes(), 2)}`;
					break;
				case "s":
					result += Math.floor(t.getTime() / 1000);
					break;
				case "S":
					result += pad(t.getSeconds(), 2);
					break;
				case "t":
					result += "\t";
					break;
				case "T":
					result +=
						pad(t.getHours(), 2) +
						":" +
						pad(t.getMinutes(), 2) +
						":" +
						pad(t.getSeconds(), 2);
					break;
				case "u":
					result += t.getDay() || 7;
					break;
				case "U":
				case "V":
				case "W":
					result += pad(getISOWeek(t), 2);
					break;
				case "w":
					result += t.getDay();
					break;
				case "x":
					result +=
						pad(t.getMonth() + 1, 2) +
						"/" +
						pad(t.getDate(), 2) +
						"/" +
						pad(t.getFullYear() % 100, 2);
					break;
				case "X":
					result +=
						pad(t.getHours(), 2) +
						":" +
						pad(t.getMinutes(), 2) +
						":" +
						pad(t.getSeconds(), 2);
					break;
				case "y":
					result += pad(t.getFullYear() % 100, 2);
					break;
				case "Y":
					result += t.getFullYear();
					break;
				case "z": {
					const offset = -t.getTimezoneOffset();
					const sign = offset >= 0 ? "+" : "-";
					const absOffset = Math.abs(offset);
					result +=
						sign + pad(Math.floor(absOffset / 60), 2) + pad(absOffset % 60, 2);
					break;
				}
				case "Z":
					result +=
						Intl.DateTimeFormat("en", { timeZoneName: "short" })
							.formatToParts(t)
							.find((p) => p.type === "timeZoneName")?.value || "";
					break;
				case "%":
					result += "%";
					break;
				default:
					result += `%${spec}`;
			}
		}

		return result;
	};
}

export function createParseTimeDelta(): ParseTimeDeltaFunction {
	return (delta: string): number => {
		const str = String(delta).trim();
		let totalSeconds = 0;
		let hasMatch = false;

		const pattern = /(-?\d+(?:\.\d+)?)(ms|s|m|h|d|w|y)/g;
		let match;

		while ((match = pattern.exec(str)) !== null) {
			hasMatch = true;
			const num = parseFloat(match[1]);
			const unit = match[2];
			totalSeconds += num * (TIME_UNITS[unit] || 1);
		}

		if (hasMatch) return totalSeconds;

		const parsed = parseFloat(str);
		return Number.isNaN(parsed) ? 0 : parsed;
	};
}
