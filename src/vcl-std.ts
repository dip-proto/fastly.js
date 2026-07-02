import { logInfo } from "./platform";
import { parseIPv4, parseIPv6 } from "./vcl-address";
import {
	atof,
	atoi,
	basename,
	cstr_escape,
	dirname,
	itoa,
	itoa_charset,
	json_escape,
	prefixof,
	regsuball as regsuballImpl,
	regsub as regsubImpl,
	replace,
	replace_prefix,
	replace_suffix,
	replaceall,
	strcasecmp,
	strpad,
	strrep,
	strrev,
	strstr,
	strtof,
	strtol as strtolImpl,
	subfield,
	substr as substrImpl,
	suffixof,
	tolower,
	toupper,
	urldecode,
	urlencode,
	xml_escape,
} from "./vcl-strings";
import { std_integer2time, std_time } from "./vcl-time";
import { toRawString } from "./vcl-value";

export interface StdModule {
	strlen: (s: string) => number;
	tolower: (s: string) => string;
	toupper: (s: string) => string;
	strstr: (haystack: string, needle: string) => string | null;
	strrev: (s: string) => string | null;
	strrep: (s: string, count: number) => string;
	strpad: (s: string, width: number, pad: string) => string;
	strcasecmp: (s1: string, s2: string) => boolean;
	prefixof: (s: string, prefix: string) => boolean;
	suffixof: (s: string, suffix: string) => boolean;
	replace: (s: string, target: string, replacement: string) => string;
	replaceall: (s: string, target: string, replacement: string) => string;
	replace_prefix: (s: string, prefix: string, replacement: string) => string;
	replace_suffix: (s: string, suffix: string, replacement: string) => string;
	basename: (s: string) => string;
	dirname: (s: string) => string;
	atoi: (s: string) => number | null;
	atof: (s: string) => number | null;
	strtol: (s: string, base: number) => number | null;
	strtof: (s: string, base: number) => number | null;
	itoa: (n: number, base?: number) => string | null;
	itoa_charset: (n: number, charset: string) => string;
	ip: (s: string, fallback: string) => string | null;
	ip2str: (ip: string) => string;
	str2ip: (s: string, fallback: string) => string | null;
	anystr2ip: (s: string, fallback: string) => string | null;
	collect: (header: string[], separator?: string) => string;
	count: (header: string[]) => number;
	time: (s: string, fallback: any) => Date;
	integer2time: (n: number) => Date;
	log: (message: string) => void;
	substr: (s: string, offset: number, length?: number) => string;
	regsub: (s: string, pattern: string, replacement: string) => string;
	regsuball: (s: string, pattern: string, replacement: string) => string;
	urlencode: (s: string) => string | null;
	urldecode: (s: string) => string | null;
	cstr_escape: (s: string) => string;
	json_escape: (s: string) => string;
	xml_escape: (s: string) => string;
	subfield: (header: string, name: string, separator?: string) => string | null;
}

function isValidIPv4(str: string): boolean {
	return parseIPv4(str) !== null;
}

function isValidIPv6(str: string): boolean {
	return parseIPv6(str) !== null;
}

function isValidIP(str: string): boolean {
	return isValidIPv4(str) || isValidIPv6(str);
}

/** Parse one numeric segment of a flexible IPv4 string: 0x-hex, 0-octal, or decimal. */
function parseFlexibleSegment(v: string): number | null {
	if (v === "0") return 0;
	let n: number;
	if (v.startsWith("0x")) {
		const body = v.slice(2);
		if (!/^[0-9a-fA-F]+$/.test(body)) return null;
		n = parseInt(body, 16);
	} else if (v.startsWith("0")) {
		const body = v.slice(1);
		if (!/^[0-7]+$/.test(body)) return null;
		n = parseInt(body, 8);
	} else {
		if (!/^[0-9]+$/.test(v)) return null;
		n = parseInt(v, 10);
	}
	return Number.isSafeInteger(n) ? n : null;
}

/**
 * Flexible IPv4 parsing: 1-4 dot-separated segments where the last segment
 * covers the remaining bytes ("3221225985" = 192.0.2.1, "192.11010305" works
 * too), each segment in decimal/0x-hex/0-octal notation.
 */
function parseFlexibleIPv4(addr: string): string | null {
	const segments = addr.split(".");
	if (segments.length < 1 || segments.length > 4) return null;
	const values: number[] = [];
	for (const s of segments) {
		const v = parseFlexibleSegment(s);
		if (v === null) return null;
		values.push(v);
	}
	// inet_aton range rules: leading segments are single octets; the final
	// segment must fit in the remaining bytes.
	const finalMax = 2 ** (8 * (5 - values.length)) - 1;
	for (let i = 0; i < values.length; i++) {
		const max = i === values.length - 1 ? finalMax : 255;
		if (values[i]! > max) return null;
	}
	let ip = 0;
	switch (values.length) {
		case 1:
			ip = values[0]!;
			break;
		case 2:
			ip = (values[0]! << 24) | values[1]!;
			break;
		case 3:
			ip = (values[0]! << 24) | (values[1]! << 16) | values[2]!;
			break;
		case 4:
			ip = (values[0]! << 24) | (values[1]! << 16) | (values[2]! << 8) | values[3]!;
			break;
	}
	ip = ip >>> 0;
	return `${(ip >>> 24) & 0xff}.${(ip >>> 16) & 0xff}.${(ip >>> 8) & 0xff}.${ip & 0xff}`;
}

function parseAnyIP(addr: string): string | null {
	if (!addr) return null;
	if (addr.toLowerCase() === "localhost") return "127.0.0.1";
	if (!addr.includes(":")) {
		const flexible = parseFlexibleIPv4(addr);
		if (flexible) return flexible;
		return isValidIPv4(addr) ? addr : null;
	}
	if (isValidIPv6(addr)) return addr;
	return null;
}

/** Strict IP parse with fallback: used by std.ip and std.str2ip. */
function parseIPWithFallback(s: string, fallback: string): string | null {
	const primary = String(s);
	if (isValidIP(primary)) return primary;
	const fb = String(fallback);
	if (isValidIP(fb)) return fb;
	return null;
}

export function createStdModule(): StdModule {
	return {
		// Byte length, not code-point length: "日本語" counts as 9
		strlen: (s: any): number => Buffer.byteLength(toRawString(s), "utf8"),

		tolower,
		toupper,
		strstr,
		strrev,
		strrep,
		strpad,
		strcasecmp,
		prefixof,
		suffixof,
		replace,
		replaceall,
		replace_prefix,
		replace_suffix,
		basename,
		dirname,
		atoi,
		atof,
		strtol: strtolImpl,
		strtof,
		itoa,
		itoa_charset,

		ip: parseIPWithFallback,

		ip2str: (ip: string): string => String(ip),

		str2ip: parseIPWithFallback,

		anystr2ip: (s: string, fallback: string): string | null => {
			const primary = parseAnyIP(String(s).trim());
			if (primary) return primary;
			return parseAnyIP(String(fallback).trim());
		},

		collect: (header: string[], separator: string = ", "): string => {
			return Array.isArray(header) ? header.join(separator) : String(header);
		},

		count: (header: string[]): number => {
			if (!Array.isArray(header)) return header ? 1 : 0;
			return header.length;
		},

		time: std_time,
		integer2time: std_integer2time,

		log: (message: string): void => {
			logInfo(`[VCL] ${message}`);
		},

		substr: substrImpl,
		regsub: regsubImpl,
		regsuball: regsuballImpl,
		urlencode,
		urldecode,
		cstr_escape,
		json_escape,
		xml_escape,
		subfield,
	};
}
