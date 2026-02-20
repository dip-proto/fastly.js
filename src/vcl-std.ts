import * as path from "node:path";
import {
	cstr_escape,
	json_escape,
	regsuball as regsuballImpl,
	regsub as regsubImpl,
	strtol as strtolImpl,
	subfield,
	substr as substrImpl,
	urldecode,
	urlencode,
	xml_escape,
} from "./vcl-strings";
import { toRawString } from "./vcl-value";

export interface StdModule {
	strlen: (s: string) => number;
	tolower: (s: string) => string;
	toupper: (s: string) => string;
	strstr: (haystack: string, needle: string) => string;
	strrev: (s: string) => string;
	strrep: (s: string, count: number) => string;
	strpad: (s: string, width: number, pad: string) => string;
	strcasecmp: (s1: string, s2: string) => number;
	prefixof: (s: string, prefix: string) => boolean;
	suffixof: (s: string, suffix: string) => boolean;
	replace: (s: string, target: string, replacement: string) => string;
	replaceall: (s: string, target: string, replacement: string) => string;
	replace_prefix: (s: string, prefix: string, replacement: string) => string;
	replace_suffix: (s: string, suffix: string, replacement: string) => string;
	basename: (s: string) => string;
	dirname: (s: string) => string;
	atoi: (s: string) => number;
	atof: (s: string) => number;
	strtol: (s: string, base: number) => number;
	strtof: (s: string) => number;
	itoa: (n: number, base?: number) => string;
	itoa_charset: (n: number, charset: string) => string;
	ip: (s: string, fallback: string) => string;
	ip2str: (ip: string) => string;
	str2ip: (s: string) => string;
	anystr2ip: (s: string, fallback: string) => string;
	collect: (header: string[], separator?: string) => string;
	count: (header: string[]) => number;
	time: (s: string) => number;
	integer2time: (n: number) => Date;
	log: (message: string) => void;
	substr: (s: string, offset: number, length?: number) => string;
	regsub: (s: string, pattern: string, replacement: string) => string;
	regsuball: (s: string, pattern: string, replacement: string) => string;
	urlencode: (s: string) => string;
	urldecode: (s: string) => string;
	cstr_escape: (s: string) => string;
	json_escape: (s: string) => string;
	xml_escape: (s: string) => string;
	subfield: (header: string, name: string, separator?: string) => string;
}

const IPV4_REGEX = /^(\d{1,3}\.){3}\d{1,3}$/;
const IPV6_REGEX = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;

function isValidIPv4(str: string): boolean {
	if (!IPV4_REGEX.test(str)) return false;
	return str.split(".").every((p) => parseInt(p, 10) <= 255);
}

function isValidIP(str: string): boolean {
	return isValidIPv4(str) || IPV6_REGEX.test(str) || str.includes("::");
}

export function createStdModule(): StdModule {
	return {
		// Fastly does not consider multibyte, so "日本語" is treated as 9 bytes
		strlen: (s: any): number => Buffer.byteLength(toRawString(s), "utf8"),

		tolower: (s: string): string => String(s).toLowerCase(),

		toupper: (s: string): string => String(s).toUpperCase(),

		strstr: (haystack: string, needle: string): string => {
			const h = String(haystack);
			const idx = h.indexOf(String(needle));
			return idx === -1 ? "" : h.substring(idx);
		},

		// Fastly returns empty string for multibyte characters
		strrev: (s: string): string => {
			const str = String(s);
			if (Buffer.byteLength(str, "utf8") !== str.length) return "";
			return str.split("").reverse().join("");
		},

		strrep: (s: string, count: number): string => {
			return String(s).repeat(Math.max(0, Math.floor(count)));
		},

		// Positive width pads left, negative pads right
		strpad: (s: string, width: number, pad: string): string => {
			const str = String(s);
			const w = Math.abs(width);
			if (str.length >= w) return str;

			const padding = String(pad)
				.repeat(w - str.length)
				.substring(0, w - str.length);
			return width < 0 ? str + padding : padding + str;
		},

		strcasecmp: (s1: string, s2: string): number => {
			const a = String(s1).toLowerCase();
			const b = String(s2).toLowerCase();
			if (a < b) return -1;
			if (a > b) return 1;
			return 0;
		},

		prefixof: (s: string, prefix: string): boolean => String(s).startsWith(String(prefix)),

		suffixof: (s: string, suffix: string): boolean => String(s).endsWith(String(suffix)),

		replace: (s: string, target: string, replacement: string): string => {
			return String(s).replace(String(target), String(replacement));
		},

		replaceall: (s: string, target: string, replacement: string): string => {
			return String(s).split(String(target)).join(String(replacement));
		},

		replace_prefix: (s: string, prefix: string, replacement: string): string => {
			const str = String(s);
			const pre = String(prefix);
			return str.startsWith(pre) ? String(replacement) + str.substring(pre.length) : str;
		},

		replace_suffix: (s: string, suffix: string, replacement: string): string => {
			const str = String(s);
			const suf = String(suffix);
			return str.endsWith(suf)
				? str.substring(0, str.length - suf.length) + String(replacement)
				: str;
		},

		basename: (s: string): string => {
			const str = String(s);
			if (str === "." || str === "") return ".";
			if (str === "..") return "..";
			if (str === "/") return "/";
			return path.basename(str.replace(/\/$/, ""));
		},

		dirname: (s: string): string => {
			const str = String(s);
			if (str === "." || str === "" || str === "..") return ".";
			if (str === "/") return "/";
			return path.dirname(str.replace(/\/$/, ""));
		},

		atoi: (s: string): number => {
			let input = String(s).trim();
			if (input === "") return 0;
			const dotIdx = input.indexOf(".");
			if (dotIdx !== -1) input = input.substring(0, dotIdx);
			const result = parseInt(input, 10);
			return Number.isNaN(result) ? 0 : result;
		},

		atof: (s: string): number => {
			const result = parseFloat(String(s));
			return Number.isNaN(result) ? 0 : result;
		},

		strtol: strtolImpl,

		strtof: (s: string): number => {
			const result = parseFloat(String(s));
			return Number.isNaN(result) ? 0 : result;
		},

		itoa: (n: number, base: number = 10): string => {
			const b = Math.floor(base);
			if (b < 2 || b > 36) return "";
			return Math.floor(n).toString(b);
		},

		itoa_charset: (n: number, charset: string): string => {
			const cs = String(charset);
			if (cs.length < 2) return "";

			let num = Math.abs(Math.floor(n));
			const base = cs.length;
			const negative = n < 0;

			if (num === 0) return cs[0] ?? "";

			let result = "";
			while (num > 0) {
				result = (cs[num % base] ?? "") + result;
				num = Math.floor(num / base);
			}

			return negative ? `-${result}` : result;
		},

		ip: (s: string, fallback: string): string => {
			const str = String(s).trim();
			if (isValidIPv4(str) || IPV6_REGEX.test(str) || str.includes("::")) return str;
			return String(fallback);
		},

		ip2str: (ip: string): string => String(ip),

		str2ip: (s: string): string => String(s).trim(),

		anystr2ip: (s: string, fallback: string): string => {
			const str = String(s).trim();
			return isValidIP(str) ? str : String(fallback);
		},

		collect: (header: string[], separator: string = ", "): string => {
			return Array.isArray(header) ? header.join(separator) : String(header);
		},

		count: (header: string[]): number => {
			if (!Array.isArray(header)) return header ? 1 : 0;
			return header.length;
		},

		time: (s: string): number => {
			const date = new Date(String(s));
			return Number.isNaN(date.getTime()) ? 0 : date.getTime();
		},

		integer2time: (n: number): Date => new Date(n),

		log: (message: string): void => {
			console.log(`[VCL] ${message}`);
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
