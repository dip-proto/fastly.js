// String builtins matching Fastly's behavior. Functions returning `null`
// correspond to VCL "not set" values.

const utf8Encoder = new TextEncoder();
const utf8Decoder = new TextDecoder();

function utf8Bytes(s: string): Uint8Array {
	return utf8Encoder.encode(s);
}

function decodeBytes(bytes: number[] | Uint8Array): string {
	return utf8Decoder.decode(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes));
}

// [a-zA-Z0-9] (all letters, not just hex digits)
export function isAlnumByte(b: number): boolean {
	return (b >= 0x41 && b <= 0x5a) || (b >= 0x61 && b <= 0x7a) || (b >= 0x30 && b <= 0x39);
}

function isHexDigitByte(b: number): boolean {
	return (b >= 0x30 && b <= 0x39) || (b >= 0x61 && b <= 0x66) || (b >= 0x41 && b <= 0x46);
}

/** Value of a hex digit byte, or -1 when the byte is not a hex digit. */
export function hexVal(b: number): number {
	if (b >= 0x30 && b <= 0x39) return b - 0x30;
	if (b >= 0x61 && b <= 0x66) return b - 0x61 + 10;
	if (b >= 0x41 && b <= 0x46) return b - 0x41 + 10;
	return -1;
}

// RFC 3986 unreserved: [a-zA-Z0-9] plus "-" "." "_" "~"
export function isUnreservedByte(code: number): boolean {
	return isAlnumByte(code) || code === 0x2d || code === 0x2e || code === 0x5f || code === 0x7e;
}

export function toHexUpper(b: number): string {
	return b.toString(16).toUpperCase().padStart(2, "0");
}

/** Escapes regex metacharacters so `s` matches literally inside a RegExp. */
export function regexQuote(s: string): string {
	return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Truncates a JS number to an integer BigInt without throwing on NaN/Infinity
function toBigIntTrunc(n: number): bigint {
	const t = Math.trunc(Number(n));
	return Number.isFinite(t) ? BigInt(t) : 0n;
}

// Emulates Go's utf8.DecodeRune on a byte prefix: returns the decoded code
// point for a complete, valid sequence, and 0xFFFD (RuneError) otherwise.
// Note that a valid encoding of U+FFFD itself also returns 0xFFFD, which
// is treated as a failure, matching Fastly's behavior.
function goDecodeRune(bytes: number[]): number {
	const b0 = bytes[0]!;
	if (b0 < 0x80) return b0;
	let size: number;
	let lo = 0x80;
	let hi = 0xbf;
	if (b0 >= 0xc2 && b0 <= 0xdf) size = 2;
	else if (b0 === 0xe0) {
		size = 3;
		lo = 0xa0;
	} else if (b0 >= 0xe1 && b0 <= 0xec) size = 3;
	else if (b0 === 0xed) {
		size = 3;
		hi = 0x9f;
	} else if (b0 >= 0xee && b0 <= 0xef) size = 3;
	else if (b0 === 0xf0) {
		size = 4;
		lo = 0x90;
	} else if (b0 >= 0xf1 && b0 <= 0xf3) size = 4;
	else if (b0 === 0xf4) {
		size = 4;
		hi = 0x8f;
	} else return 0xfffd;

	if (bytes.length < size) return 0xfffd;
	const b1 = bytes[1]!;
	if (b1 < lo || b1 > hi) return 0xfffd;
	let r = (b0 & (0xff >> (size + 1))) << 6;
	r |= b1 & 0x3f;
	for (let i = 2; i < size; i++) {
		const b = bytes[i]!;
		if (b < 0x80 || b > 0xbf) return 0xfffd;
		r = (r << 6) | (b & 0x3f);
	}
	return r;
}

// Emulates Go's strconv.ParseInt (with an explicit base 2..36).
// Returns null where Go returns an error (syntax or 64-bit range).
function goParseInt(s: string, base: number): bigint | null {
	if (!Number.isInteger(base) || base < 2 || base > 36) return null;
	if (s === "") return null;
	let i = 0;
	let neg = false;
	if (s[0] === "+" || s[0] === "-") {
		neg = s[0] === "-";
		i = 1;
	}
	if (i >= s.length) return null;
	let n = 0n;
	const b = BigInt(base);
	for (; i < s.length; i++) {
		const c = s.charCodeAt(i);
		let d: number;
		if (c >= 0x30 && c <= 0x39) d = c - 0x30;
		else if (c >= 0x61 && c <= 0x7a) d = c - 0x61 + 10;
		else if (c >= 0x41 && c <= 0x5a) d = c - 0x41 + 10;
		else return null;
		if (d >= base) return null;
		n = n * b + BigInt(d);
	}
	const v = neg ? -n : n;
	if (v > 9223372036854775807n || v < -9223372036854775808n) return null;
	return v;
}

// Port of Go's strconv underscoreOK: underscores may only appear between
// digits, or between a base prefix and a digit.
function goUnderscoreOK(input: string): boolean {
	let saw = "^";
	let s = input;
	let i = 0;
	if (s.length >= 1 && (s[0] === "-" || s[0] === "+")) s = s.slice(1);
	let hex = false;
	if (s.length >= 2 && s[0] === "0" && "box".includes(s[1]!.toLowerCase())) {
		i = 2;
		saw = "0";
		hex = s[1]!.toLowerCase() === "x";
	}
	for (; i < s.length; i++) {
		const c = s[i]!;
		if ((c >= "0" && c <= "9") || (hex && /[a-fA-F]/.test(c))) {
			saw = "0";
			continue;
		}
		if (c === "_") {
			if (saw !== "0") return false;
			saw = "_";
			continue;
		}
		if (saw === "_") return false;
		saw = "!";
	}
	return saw !== "_";
}

// Emulates Go's strconv.ParseFloat. Returns null where Go returns an error
// (syntax error, or overflow to +/-Inf which Go reports as ErrRange).
function goParseFloat(s: string): number | null {
	if (s === "") return null;
	if (s.includes("_")) {
		if (!goUnderscoreOK(s)) return null;
		return goParseFloat(s.replace(/_/g, ""));
	}
	if (/^[+-]?inf(inity)?$/i.test(s)) return s[0] === "-" ? -Infinity : Infinity;
	// Go accepts "nan" only without a sign
	if (/^nan$/i.test(s)) return NaN;
	const hex = /^([+-]?)0[xX]([0-9a-fA-F]*)(?:\.([0-9a-fA-F]*))?[pP]([+-]?[0-9]+)$/.exec(s);
	if (hex) {
		const intPart = hex[2] ?? "";
		const fracPart = hex[3] ?? "";
		if (intPart.length + fracPart.length === 0) return null;
		let mant = 0;
		for (const ch of intPart + fracPart) mant = mant * 16 + hexVal(ch.charCodeAt(0));
		const exp = parseInt(hex[4]!, 10) - 4 * fracPart.length;
		const v = (hex[1] === "-" ? -1 : 1) * mant * 2 ** exp;
		if (!Number.isFinite(v)) return null;
		return v;
	}
	if (/^[+-]?([0-9]+(\.[0-9]*)?|\.[0-9]+)([eE][+-]?[0-9]+)?$/.test(s)) {
		const v = Number(s);
		if (!Number.isFinite(v)) return null;
		return v;
	}
	return null;
}

// Percent encoding matching Fastly's behavior.
// Returns null (not set) where Fastly raises an error; encoding also stops
// altogether when a %XX sequence decodes to NUL or a non-ASCII byte.
export function urlencode(src: string): string | null {
	const bytes = utf8Bytes(String(src));
	let out = "";
	let i = 0;
	while (i < bytes.length) {
		const b = bytes[i]!;
		if (b === 0x25) {
			// "%": peek following 2 bytes
			if (i + 2 >= bytes.length) return null;
			const h1 = bytes[i + 1]!;
			const h2 = bytes[i + 2]!;
			if (!isAlnumByte(h1) || !isAlnumByte(h2)) {
				out += "%25";
				i++;
				continue;
			}
			if (!isHexDigitByte(h1) || !isHexDigitByte(h2)) return null;
			const n = hexVal(h1) * 16 + hexVal(h2);
			if (n < 0x01 || n > 0x7f) return out; // stop encoding
			out += `%${String.fromCharCode(h1, h2)}`; // keep original hex case
			i += 3;
			continue;
		}
		if (isUnreservedByte(b)) {
			out += String.fromCharCode(b);
			i++;
			continue;
		}
		out += `%${toHexUpper(b)}`;
		i++;
	}
	return out;
}

// Percent decoding matching Fastly's behavior.
// "+" is NOT decoded to a space; only %XX sequences decode. Decoding stops at
// %00, and invalid multi-byte sequences make the result not set (null).
export function urldecode(src: string): string | null {
	const bytes = utf8Bytes(String(src));
	const out: number[] = [];
	let i = 0;
	while (i < bytes.length) {
		const b = bytes[i]!;
		if (b !== 0x25) {
			out.push(b);
			i++;
			continue;
		}
		if (i + 2 >= bytes.length) return null;
		const h1 = bytes[i + 1]!;
		const h2 = bytes[i + 2]!;
		if (!isAlnumByte(h1) || !isAlnumByte(h2)) {
			out.push(b);
			i++;
			continue;
		}
		if (!isHexDigitByte(h1) || !isHexDigitByte(h2)) return null;
		const n = hexVal(h1) * 16 + hexVal(h2);
		if (n === 0) return decodeBytes(out); // stop decoding at null byte
		i += 3;
		if (n <= 0x7f) {
			out.push(n);
			continue;
		}
		// Multi-byte sequence: subsequent bytes must also be %XX escapes
		const mbs = [n];
		let ok = false;
		for (let k = 0; k < 4; k++) {
			if (i + 2 >= bytes.length || bytes[i] !== 0x25) return null;
			const a1 = bytes[i + 1]!;
			const a2 = bytes[i + 2]!;
			if (!isHexDigitByte(a1) || !isHexDigitByte(a2)) return null;
			mbs.push(hexVal(a1) * 16 + hexVal(a2));
			i += 3;
			if (goDecodeRune(mbs) !== 0xfffd) {
				ok = true;
				break;
			}
		}
		if (!ok) return null;
		out.push(...mbs);
	}
	return decodeBytes(out);
}

// Quote and backslash map to themselves (they are NOT escaped); only
// \b \t \n \v \r get named escapes.
const CSTR_ESCAPE_MAP = new Map<number, string>([
	[0x22, '"'],
	[0x5c, "\\"],
	[0x08, "\\b"],
	[0x09, "\\t"],
	[0x0a, "\\n"],
	[0x0b, "\\v"],
	[0x0d, "\\r"],
]);

export function cstr_escape(str: string): string {
	let out = "";
	for (const b of utf8Bytes(String(str))) {
		const mapped = CSTR_ESCAPE_MAP.get(b);
		if (mapped !== undefined) {
			out += mapped;
			continue;
		}
		// b < 0x1F (0x1F itself passes through) or b > 0x7F,
		// formatted with %x (lowercase, no zero padding)
		if (b < 0x1f || b > 0x7f) {
			out += `\\x${b.toString(16)}`;
			continue;
		}
		out += String.fromCharCode(b);
	}
	return out;
}

const JSON_ESCAPE_MAP = new Map<number, string>([
	[0x22, '\\"'],
	[0x5c, "\\\\"],
	[0x08, "\\b"],
	[0x09, "\\t"],
	[0x0a, "\\n"],
	[0x0c, "\\f"],
	[0x0d, "\\r"],
]);

// JS strings are invalid UTF-8 only through lone surrogates.
const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;

export function json_escape(str: string): string {
	const s = String(str);
	// Fastly returns "" for input that is not valid UTF-8
	if (LONE_SURROGATE.test(s)) return "";
	let out = "";
	for (const ch of s) {
		const r = ch.codePointAt(0)!;
		const mapped = JSON_ESCAPE_MAP.get(r);
		if (mapped !== undefined) {
			out += mapped;
			continue;
		}
		// r < 0x1F (0x1F itself passes through), DEL, and JS line separators
		if (r < 0x1f || r === 0x7f || r === 0x2028 || r === 0x2029) {
			out += `\\u${r.toString(16).padStart(4, "0")}`;
			continue;
		}
		if (r > 0xffff) {
			const v = r - 0x10000;
			const upper = ((v >> 10) & 0x3ff) + 0xd800;
			const lower = (v & 0x3ff) + 0xdc00;
			out += `\\u${upper.toString(16).toUpperCase().padStart(4, "0")}`;
			out += `\\u${lower.toString(16).toUpperCase().padStart(4, "0")}`;
			continue;
		}
		out += ch;
	}
	return out;
}

export function xml_escape(str: string): string {
	return String(str)
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/'/g, "&apos;")
		.replace(/"/g, "&quot;");
}

function stripPrefixOnce(s: string, prefix: string): string {
	return s.startsWith(prefix) ? s.slice(prefix.length) : s;
}

// std.strtol matching Fastly's behavior. Returns null where Fastly raises
// an error and sets fastly.error to EPARSENUM.
export function strtol(s: string, base: number): number | null {
	const str = String(s);
	const b = Math.trunc(base);
	let v: bigint | null;
	if (b === 0) {
		// auto detection
		if (str.startsWith("0x")) v = goParseInt(stripPrefixOnce(str, "0x"), 16);
		else if (str.startsWith("0")) v = goParseInt(str, 8);
		else v = goParseInt(str, 10);
	} else if (b === 8) {
		v = goParseInt(str, 8);
	} else if (b === 16) {
		v = goParseInt(stripPrefixOnce(str, "0x"), 16);
	} else if (b === 36) {
		v = str === "0" ? 0n : goParseInt(stripPrefixOnce(str, "0"), 36);
	} else if (b > 36) {
		v = null;
	} else {
		// any other base (including 10): a "0x" prefix is stripped first
		v = goParseInt(stripPrefixOnce(str, "0x"), b);
	}
	if (v === null) return null;
	return Number(v);
}

function expandReplacement(_input: string, replacement: string, match: RegExpExecArray): string {
	let result = "";
	for (let i = 0; i < replacement.length; i++) {
		if (replacement[i] !== "\\" || i + 1 >= replacement.length) {
			result += replacement[i];
			continue;
		}
		i++;
		const next = replacement[i]!;
		if (next >= "0" && next <= "9") {
			const groupIdx = parseInt(next, 10);
			// Non-participating groups return undefined — use empty string
			result += match[groupIdx] ?? "";
		} else {
			result += next;
		}
	}
	return result;
}

export function regsub(str: string, pattern: string, replacement: string): string {
	try {
		const s = String(str);
		const re = new RegExp(pattern);
		const match = re.exec(s);
		if (!match) return s;
		return (
			s.slice(0, match.index) +
			expandReplacement(s, replacement, match) +
			s.slice(match.index + match[0].length)
		);
	} catch {
		return str;
	}
}

export function regsuball(str: string, pattern: string, replacement: string): string {
	try {
		const s = String(str);
		const re = new RegExp(pattern, "g");
		let result = "";
		let lastEnd = 0;
		let match: RegExpExecArray | null;
		while ((match = re.exec(s)) !== null) {
			result += s.slice(lastEnd, match.index);
			result += expandReplacement(s, replacement, match);
			lastEnd = match.index + match[0].length;
			if (match[0].length === 0) {
				re.lastIndex++;
			}
		}
		result += s.slice(lastEnd);
		return result;
	} catch {
		return str;
	}
}

// substr operates on bytes, like Fastly. A negative offset counts from
// the end of the string; a negative length leaves -length bytes off the end.
export function substr(str: string, offset: number, length?: number): string {
	const bytes = utf8Bytes(String(str));
	const len = BigInt(bytes.length);
	const off = toBigIntTrunc(offset);

	let start: bigint;
	if (off < 0n) {
		start = len + off;
		if (start < 0n) return "";
	} else {
		start = off;
	}

	let end: bigint;
	if (length === undefined) {
		end = len;
	} else {
		const l = toBigIntTrunc(length);
		if (l < 0n) {
			end = len + l;
		} else {
			// start + length wraps with int64 overflow semantics
			end = BigInt.asIntN(64, start + l);
			if (end < 0n) return "";
		}
	}

	if (end > len) end = len;
	if (start > len) return "";
	if (end <= start) return "";

	return decodeBytes(bytes.slice(Number(start), Number(end)));
}

// Compiled subfield regexes, keyed by separator + name. Patterns come from
// VCL literals, so the set is small; the cap only guards pathological input.
const SUBFIELD_REGEX_CACHE = new Map<string, RegExp | null>();
const SUBFIELD_REGEX_CACHE_MAX = 1000;

function subfieldRegex(name: string, sep: string): RegExp | null {
	const cacheKey = `${sep} ${name}`;
	const cached = SUBFIELD_REGEX_CACHE.get(cacheKey);
	if (cached !== undefined) return cached;
	const sepEsc = regexQuote(sep);
	const keyEsc = regexQuote(name);
	let re: RegExp | null;
	try {
		re = new RegExp(
			`(?:^|${sepEsc})\\s*${keyEsc}(?:(?:\\s+)?=(?:\\s+)?((?:(?:"(?:(?:\\\\")|[^"])+)?")|(?:(?:[^${sepEsc}\\s]+)?)))?(?:${sepEsc}|$|\\s+)`,
			"i",
		);
	} catch {
		re = null;
	}
	if (SUBFIELD_REGEX_CACHE.size >= SUBFIELD_REGEX_CACHE_MAX) SUBFIELD_REGEX_CACHE.clear();
	SUBFIELD_REGEX_CACHE.set(cacheKey, re);
	return re;
}

export function subfield(header: string, name: string, separator: string = ","): string | null {
	const sep = separator === "" ? "," : separator;
	const re = subfieldRegex(String(name), sep);
	if (re === null) return null;
	const match = String(header).match(re);
	if (!match) return null;
	let val = match[1] ?? "";
	if (val.length >= 2 && val.startsWith('"') && val.endsWith('"')) {
		val = val.slice(1, -1).replace(/\\\\"/g, '"');
	}
	return val;
}

// std.strcasecmp: returns BOOL, equivalent to Go's strings.EqualFold(a, b).
// toLowerCase() approximates Go's Unicode simple case folding.
export function strcasecmp(a: string, b: string): boolean {
	return String(a).toLowerCase() === String(b).toLowerCase();
}

// std.strstr: returns the suffix of haystack starting at the first occurrence
// of needle, or not set (null) when the needle is not found.
export function strstr(haystack: string, needle: string): string | null {
	const h = String(haystack);
	const idx = h.indexOf(String(needle));
	if (idx === -1) return null;
	return h.slice(idx);
}

// std.strpad: width and padding are measured in bytes. A positive width pads
// on the left, a negative width on the right.
export function strpad(s: string, width: number, pad: string): string {
	const str = String(s);
	const w = Math.abs(Math.trunc(width));
	const sLen = utf8Bytes(str).length;
	if (sLen >= w) return str;
	const padBytes = utf8Bytes(String(pad));
	// An empty pad string returns the input unchanged
	if (padBytes.length === 0) return str;
	const need = w - sLen;
	const padding: number[] = [];
	while (padding.length < need) {
		for (const b of padBytes) {
			padding.push(b);
			if (padding.length === need) break;
		}
	}
	const p = decodeBytes(padding);
	return width < 0 ? str + p : p + str;
}

export function strrep(s: string, count: number): string {
	return String(s).repeat(Math.max(0, Math.trunc(count)));
}

// std.strrev: Fastly does not consider multibyte strings; returns not set
// (null) when the input contains multibyte characters.
export function strrev(s: string): string | null {
	const str = String(s);
	if (utf8Bytes(str).length !== [...str].length) return null;
	return str.split("").reverse().join("");
}

export function prefixof(s: string, prefix: string): boolean {
	return String(s).startsWith(String(prefix));
}

export function suffixof(s: string, suffix: string): boolean {
	return String(s).endsWith(String(suffix));
}

// std.replace: replaces the first occurrence only (no regex, no $-expansion).
export function replace(s: string, target: string, replacement: string): string {
	const str = String(s);
	const t = String(target);
	if (t === "") return String(replacement) + str;
	const idx = str.indexOf(t);
	if (idx === -1) return str;
	return str.slice(0, idx) + String(replacement) + str.slice(idx + t.length);
}

export function replaceall(s: string, target: string, replacement: string): string {
	const str = String(s);
	const t = String(target);
	const r = String(replacement);
	if (t === "") {
		// Go strings.ReplaceAll inserts between every rune and at both ends
		return r + [...str].join(r) + (str === "" ? "" : r);
	}
	return str.split(t).join(r);
}

export function replace_prefix(s: string, prefix: string, replacement: string): string {
	const str = String(s);
	const pre = String(prefix);
	return str.startsWith(pre) ? String(replacement) + str.slice(pre.length) : str;
}

export function replace_suffix(s: string, suffix: string, replacement: string): string {
	const str = String(s);
	const suf = String(suffix);
	return str.endsWith(suf) ? str.slice(0, str.length - suf.length) + String(replacement) : str;
}

export function tolower(s: string): string {
	return String(s).toLowerCase();
}

export function toupper(s: string): string {
	return String(s).toUpperCase();
}

// Port of Go's path.Clean
function goPathClean(path: string): string {
	if (path === "") return ".";
	const rooted = path[0] === "/";
	const segs: string[] = [];
	for (const seg of path.split("/")) {
		if (seg === "" || seg === ".") continue;
		if (seg === "..") {
			if (segs.length > 0 && segs[segs.length - 1] !== "..") segs.pop();
			else if (!rooted) segs.push("..");
			continue;
		}
		segs.push(seg);
	}
	let out = segs.join("/");
	if (rooted) out = `/${out}`;
	return out === "" ? "." : out;
}

// Port of Go's path.Base
function goPathBase(path: string): string {
	if (path === "") return ".";
	let p = path;
	while (p.length > 0 && p.endsWith("/")) p = p.slice(0, -1);
	const i = p.lastIndexOf("/");
	if (i >= 0) p = p.slice(i + 1);
	return p === "" ? "/" : p;
}

// Port of Go's path.Dir
function goPathDir(path: string): string {
	return goPathClean(path.slice(0, path.lastIndexOf("/") + 1));
}

export function basename(s: string): string {
	const str = String(s);
	if (str === "." || str === "") return ".";
	if (str === "..") return "..";
	if (str === "/") return "/";
	return goPathBase(stripSuffixOnce(str, "/"));
}

export function dirname(s: string): string {
	const str = String(s);
	if (str === "." || str === "" || str === "..") return ".";
	if (str === "/") return "/";
	return goPathDir(stripSuffixOnce(str, "/"));
}

function stripSuffixOnce(s: string, suffix: string): string {
	return s.endsWith(suffix) ? s.slice(0, s.length - suffix.length) : s;
}

// std.atoi: empty input returns 0, a float string is truncated at the dot,
// and anything Go's ParseInt rejects returns 0 (Fastly also raises an error).
export function atoi(s: string): number | null {
	let input = String(s);
	if (input === "") return 0;
	const dotIdx = input.indexOf(".");
	if (dotIdx !== -1) input = input.slice(0, dotIdx);
	// Parse failures yield null; the dispatcher maps that to 0 + EPARSENUM.
	const v = goParseInt(input, 10);
	return v === null ? null : Number(v);
}

// std.atof: strict Go ParseFloat semantics; parse failures return 0 (Fastly
// also raises an error).
export function atof(s: string): number | null {
	// Parse failures yield null; the dispatcher maps that to NaN + EPARSENUM.
	return goParseFloat(String(s));
}

// A hex mantissa needs an explicitly signed binary exponent to be treated
// as complete; otherwise "p0" is appended.
const HEX_MANTISSA_SUFFIX = /p[+-][0-9]+$/;

// std.strtof(STRING, INTEGER): base must be 0, 10 or 16. Returns null where
// Fastly raises an error (fastly.error is set to EPARSENUM for base misuse).
export function strtof(s: string, base: number): number | null {
	const str = String(s);
	const b = Math.trunc(base);

	const dec = (input: string): number | null => goParseFloat(input);
	const hex = (input: string): number | null => {
		let h = input;
		if (!HEX_MANTISSA_SUFFIX.test(h)) h += "p0";
		return goParseFloat(h);
	};

	if (b === 0) return str.startsWith("0x") ? hex(str) : dec(str);
	if (b === 10) return str.startsWith("0x") ? null : dec(str);
	if (b === 16) return str.startsWith("0x") ? hex(str) : null;
	return null;
}

// std.itoa: base outside 2..36 is an error (fastly.error = EINVAL and a
// not-set STRING) -> null here.
export function itoa(n: number, base: number = 10): string | null {
	const b = Math.trunc(base);
	if (b < 2 || b > 36) return null;
	return toBigIntTrunc(n).toString(b);
}

// std.itoa_charset: indexes the charset by byte. A negative input or a
// charset shorter than 2 bytes returns "" / the single repeated digit.
export function itoa_charset(n: number, charset: string): string {
	const csBytes = utf8Bytes(String(charset));
	if (csBytes.length === 0) return "";
	let input = toBigIntTrunc(n);
	if (input < 0n) return "";
	const base = BigInt(csBytes.length);
	if (csBytes.length === 1) return input === 0n ? decodeBytes(csBytes) : "";
	const encoded: number[] = [];
	while (input >= base) {
		const v = input / base;
		encoded.push(csBytes[Number(input - v * base)]!);
		input = v;
	}
	encoded.push(csBytes[Number(input)]!);
	encoded.reverse();
	return decodeBytes(encoded);
}

// ---------------------------------------------------------------------------
// url.normalize (follows Go's net/url semantics for full URLs)
// ---------------------------------------------------------------------------

function urlIsHex(c: string): boolean {
	return /[0-9a-fA-F]/.test(c);
}

function urlUnhex(c: string): number {
	return hexVal(c.charCodeAt(0));
}

function urlIsUnreservedChar(b: number): boolean {
	return isAlnumByte(b) || b === 0x2d || b === 0x2e || b === 0x5f || b === 0x7e;
}

// Decodes %XX escapes of RFC 3986 unreserved characters and uppercases the
// hex digits of the escapes that are kept.
function urlNormalizePathEscapes(s: string): string {
	let out = "";
	for (let i = 0; i < s.length; ) {
		if (s[i] === "%" && i + 2 < s.length && urlIsHex(s[i + 1]!) && urlIsHex(s[i + 2]!)) {
			const b = (urlUnhex(s[i + 1]!) << 4) | urlUnhex(s[i + 2]!);
			if (urlIsUnreservedChar(b)) {
				out += String.fromCharCode(b);
			} else {
				out += `%${s[i + 1]!.toUpperCase()}${s[i + 2]!.toUpperCase()}`;
			}
			i += 3;
			continue;
		}
		out += s[i];
		i++;
	}
	return out;
}

// RFC 3986 section 5.2.4 remove-dot-segments
function urlRemoveDotSegments(path: string): string {
	let p = path;
	let out = "";
	const trimLastSegment = () => {
		const i = out.lastIndexOf("/");
		out = i >= 0 ? out.slice(0, i) : "";
	};
	while (p.length > 0) {
		if (p.startsWith("../")) {
			p = p.slice(3);
		} else if (p.startsWith("./")) {
			p = p.slice(2);
		} else if (p.startsWith("/./")) {
			p = `/${p.slice(3)}`;
		} else if (p === "/.") {
			p = "/";
		} else if (p.startsWith("/../")) {
			p = `/${p.slice(4)}`;
			trimLastSegment();
		} else if (p === "/..") {
			p = "/";
			trimLastSegment();
		} else if (p === "." || p === "..") {
			p = "";
		} else {
			const end = p.indexOf("/", 1);
			if (end < 0) {
				out += p;
				p = "";
			} else {
				out += p.slice(0, end);
				p = p.slice(end);
			}
		}
	}
	return out;
}

function urlNormalizePathOnly(input: string): string {
	const qi = input.indexOf("?");
	let path = input;
	let query = "";
	let hasQuery = false;
	if (qi >= 0) {
		path = input.slice(0, qi);
		query = input.slice(qi + 1);
		hasQuery = true;
	}
	path = urlNormalizePathEscapes(path);
	path = urlRemoveDotSegments(path);
	return hasQuery ? `${path}?${query}` : path;
}

// Go net/url shouldEscape(c, encodePath)
function goShouldEscapePathByte(c: number): boolean {
	if (isAlnumByte(c)) return false;
	switch (String.fromCharCode(c)) {
		case "-":
		case "_":
		case ".":
		case "~":
			return false;
		case "$":
		case "&":
		case "+":
		case ",":
		case "/":
		case ":":
		case ";":
		case "=":
		case "@":
			return false;
		case "?":
			return true;
		default:
			return true;
	}
}

// Go net/url validEncoded(s, encodePath)
function goValidEncodedPath(bytes: Uint8Array): boolean {
	for (const b of bytes) {
		switch (String.fromCharCode(b)) {
			case "!":
			case "$":
			case "&":
			case "'":
			case "(":
			case ")":
			case "*":
			case "+":
			case ",":
			case ";":
			case "=":
			case ":":
			case "@":
			case "[":
			case "]":
			case "%":
				break;
			default:
				if (goShouldEscapePathByte(b)) return false;
		}
	}
	return true;
}

// Go net/url unescape(s, encodePath): every % must be followed by two hex
// digits; all %XX sequences are decoded.
function goUnescapePath(bytes: Uint8Array): number[] | null {
	const out: number[] = [];
	for (let i = 0; i < bytes.length; i++) {
		const b = bytes[i]!;
		if (b === 0x25) {
			if (i + 2 >= bytes.length) return null;
			const h1 = bytes[i + 1]!;
			const h2 = bytes[i + 2]!;
			if (!isHexDigitByte(h1) || !isHexDigitByte(h2)) return null;
			out.push(hexVal(h1) * 16 + hexVal(h2));
			i += 2;
			continue;
		}
		out.push(b);
	}
	return out;
}

function goEscapePathBytes(bytes: number[]): string {
	let out = "";
	for (const b of bytes) {
		out += goShouldEscapePathByte(b) ? `%${toHexUpper(b)}` : String.fromCharCode(b);
	}
	return out;
}

// Emulates u.EscapedPath() for a URL freshly parsed from rawPath.
// Returns null where Go's url.Parse would fail (invalid percent-encoding).
function goEscapedPath(rawPath: string): string | null {
	const bytes = utf8Bytes(rawPath);
	const decoded = goUnescapePath(bytes);
	if (decoded === null) return null;
	if (goValidEncodedPath(bytes)) return rawPath;
	return goEscapePathBytes(decoded);
}

function goValidOptionalPort(port: string): boolean {
	if (port === "") return true;
	if (port[0] !== ":") return false;
	for (let i = 1; i < port.length; i++) {
		const c = port.charCodeAt(i);
		if (c < 0x30 || c > 0x39) return false;
	}
	return true;
}

// Go net/url shouldEscape(c, encodeHost) — false means the byte may appear
// raw in a host.
function goShouldEscapeHostByte(c: number): boolean {
	if (isAlnumByte(c)) return false;
	return !"-_.~!$&'()*+,;=:[]<>\"".includes(String.fromCharCode(c));
}

// Go net/url unescape(host, encodeHost). In a host, %XX is only allowed for
// non-ASCII bytes (first hex digit >= 8), except the literal "%25".
function goUnescapeHost(s: string): string | null {
	const bytes = utf8Bytes(s);
	const out: number[] = [];
	for (let i = 0; i < bytes.length; i++) {
		const b = bytes[i]!;
		if (b === 0x25) {
			if (i + 2 >= bytes.length) return null;
			const h1 = bytes[i + 1]!;
			const h2 = bytes[i + 2]!;
			if (!isHexDigitByte(h1) || !isHexDigitByte(h2)) return null;
			if (hexVal(h1) < 8 && !(h1 === 0x32 && h2 === 0x35)) return null;
			out.push(hexVal(h1) * 16 + hexVal(h2));
			i += 2;
			continue;
		}
		if (b < 0x80 && goShouldEscapeHostByte(b)) return null;
		out.push(b);
	}
	return decodeBytes(out);
}

// Go net/url parseHost: validates the optional port and unescapes the host.
function goParseHost(host: string): string | null {
	if (host.startsWith("[")) {
		const i = host.lastIndexOf("]");
		if (i < 0) return null;
		if (!goValidOptionalPort(host.slice(i + 1))) return null;
	} else {
		const i = host.lastIndexOf(":");
		if (i !== -1 && !goValidOptionalPort(host.slice(i))) return null;
	}
	return goUnescapeHost(host);
}

// Go net/url Hostname() (stripHostPort)
function goStripPort(hostport: string): string {
	const colon = hostport.lastIndexOf(":");
	if (colon === -1) return hostport;
	const i = hostport.indexOf("]");
	if (i !== -1) return stripPrefixOnce(hostport.slice(0, i), "[");
	return hostport.slice(0, colon);
}

// Go net/url Port() (portOnly)
function goPortOnly(hostport: string): string {
	const colon = hostport.lastIndexOf(":");
	if (colon === -1) return "";
	const i = hostport.indexOf("]:");
	if (i !== -1) return hostport.slice(i + 2);
	if (hostport.includes("]")) return "";
	return hostport.slice(colon + 1);
}

// url.normalize: normalizes an http/https URL or a bare path.
// Unsupported schemes, userinfo, or invalid syntax are returned unchanged.
export function urlNormalize(input: string): string {
	let s = String(input);
	const hashIdx = s.indexOf("#");
	if (hashIdx >= 0) s = s.slice(0, hashIdx);
	if (s === "") return "";

	// Anything starting with "/" (including "//host/path") is a path
	if (s.startsWith("/")) return urlNormalizePathOnly(s);

	// Go's url.Parse rejects ASCII control bytes anywhere in the URL
	for (let i = 0; i < s.length; i++) {
		const c = s.charCodeAt(i);
		if (c < 0x20 || c === 0x7f) return s;
	}

	const schemeMatch = /^([A-Za-z][A-Za-z0-9+.-]*):([\s\S]*)$/.exec(s);
	if (!schemeMatch) return s;
	const scheme = schemeMatch[1]!.toLowerCase();
	if (scheme !== "http" && scheme !== "https") return s;
	let rest = schemeMatch[2]!;

	// Query extraction as done by Go's url.Parse
	let rawQuery = "";
	let forceQuery = false;
	if (rest.endsWith("?") && rest.indexOf("?") === rest.length - 1) {
		forceQuery = true;
		rest = rest.slice(0, -1);
	} else {
		const qi = rest.indexOf("?");
		if (qi >= 0) {
			rawQuery = rest.slice(qi + 1);
			rest = rest.slice(0, qi);
		}
	}

	let host = "";
	let rawPathInput = "";
	if (rest.startsWith("//")) {
		let authority = rest.slice(2);
		const si = authority.indexOf("/");
		if (si >= 0) {
			rawPathInput = authority.slice(si);
			authority = authority.slice(0, si);
		}
		// Fastly's normalizer does not support userinfo
		if (authority.includes("@")) return s;
		const parsedHost = goParseHost(authority);
		if (parsedHost === null) return s;
		host = parsedHost;
	} else if (rest.startsWith("/")) {
		rawPathInput = rest;
	}
	// else: rootless path is treated as opaque by Go; Path stays empty

	let rawPath = "";
	if (rawPathInput !== "") {
		const escaped = goEscapedPath(rawPathInput);
		if (escaped === null) return s;
		rawPath = escaped;
	}
	if (rawPath === "" && host !== "") rawPath = "/";
	rawPath = urlNormalizePathEscapes(rawPath);
	rawPath = urlRemoveDotSegments(rawPath);

	let outHost = host;
	if (outHost !== "") {
		const hostname = goStripPort(outHost).toLowerCase();
		let port = goPortOnly(outHost);
		if ((scheme === "http" && port === "80") || (scheme === "https" && port === "443")) {
			port = "";
		}
		outHost = hostname.includes(":") ? `[${hostname}]` : hostname;
		if (port !== "") outHost += `:${port}`;
	}

	let out = `${scheme}://${outHost}${rawPath}`;
	if (rawQuery !== "" || forceQuery) out += `?${rawQuery}`;
	return out;
}

export function boltsort_sort(url: string): string {
	try {
		const urlObj = new URL(String(url));
		const params = Array.from(urlObj.searchParams.entries());
		params.sort((a, b) => a[0].localeCompare(b[0]));
		urlObj.search = "";
		for (const [k, v] of params) {
			urlObj.searchParams.append(k, v);
		}
		return urlObj.toString();
	} catch {
		const [base, qs] = String(url).split("?");
		if (!qs) return url;
		const params = qs.split("&").filter(Boolean);
		params.sort((a, b) => {
			const keyA = a.split("=")[0] ?? "";
			const keyB = b.split("=")[0] ?? "";
			return keyA.localeCompare(keyB);
		});
		return `${base}?${params.join("&")}`;
	}
}

/**
 * Split a collapsed Set-Cookie header into individual cookie strings.
 * Commas inside attribute values (e.g. Expires dates) do not start a new
 * cookie; only a comma followed by a token and "=" does.
 */
// A comma starts a new cookie only when followed by a token and "=".
const SET_COOKIE_BOUNDARY_RE = /\s*[^;=\s,]+=/y;

function splitSetCookie(header: string): string[] {
	const out: string[] = [];
	let start = 0;
	let i = 0;
	const str = String(header);
	while (i < str.length) {
		if (str[i] === ",") {
			SET_COOKIE_BOUNDARY_RE.lastIndex = i + 1;
			if (SET_COOKIE_BOUNDARY_RE.test(str)) {
				out.push(str.slice(start, i).trim());
				start = i + 1;
			}
		}
		i++;
	}
	const last = str.slice(start).trim();
	if (last.length > 0) out.push(last);
	return out;
}

export function setcookie_get_value_by_name(setCookieHeader: string, name: string): string | null {
	const search = String(name);
	let found: string | null = null;
	for (const cookie of splitSetCookie(setCookieHeader)) {
		const first = cookie.split(";")[0] ?? "";
		const eq = first.indexOf("=");
		if (eq === -1) continue;
		if (first.slice(0, eq).trim() === search) {
			found = first.slice(eq + 1).trim();
		}
	}
	return found;
}

export function setcookie_delete_by_name(setCookieHeader: string, name: string): string {
	const search = String(name);
	const kept: string[] = [];
	for (const cookie of splitSetCookie(setCookieHeader)) {
		const first = cookie.split(";")[0] ?? "";
		const eq = first.indexOf("=");
		const cookieName = eq === -1 ? first.trim() : first.slice(0, eq).trim();
		if (cookieName !== search) kept.push(cookie);
	}
	return kept.join(", ");
}

export const Utf8Module = {
	is_valid: (str: string): boolean => {
		try {
			const encoded = new TextEncoder().encode(String(str));
			new TextDecoder("utf-8", { fatal: true }).decode(encoded);
			return true;
		} catch {
			return false;
		}
	},

	codepoint_count: (str: string): number => {
		return [...String(str)].length;
	},

	substr: (str: string, offset: number, length?: number): string => {
		const codepoints = [...String(str)];
		const len = codepoints.length;

		let start = offset < 0 ? len + offset : offset;
		if (start < 0) start = 0;
		if (start >= len) return "";

		const end = length === undefined ? len : start + length;
		return codepoints.slice(start, Math.min(end, len)).join("");
	},

	strpad: (str: string, width: number, pad: string): string => {
		const s = String(str);
		const p = String(pad);
		if (p === "") return s;
		const codepoints = [...s];
		const padCodepoints = [...p];
		const w = Math.abs(width);

		if (codepoints.length >= w) return s;

		const needed = w - codepoints.length;
		const padStr = padCodepoints.join("");
		const repeated = padStr.repeat(Math.ceil(needed / padCodepoints.length));
		const padding = [...repeated].slice(0, needed).join("");

		return width < 0 ? s + padding : padding + s;
	},
};
