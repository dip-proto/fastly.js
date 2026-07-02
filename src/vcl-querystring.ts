/**
 * VCL Query String Module - query string manipulation functionality
 *
 * Mirrors Fastly's behavior:
 *
 * - Everything before "?" is preserved verbatim as a prefix.
 * - The query string is parsed into an ordered list of parameters. Parameter
 *   names and values are percent-decoded on parse ("+" decodes to space).
 * - Parameters without "=" are "not set" and serialized as a bare name.
 * - Parameters with values sharing the same name are grouped at the position
 *   of the first occurrence.
 * - On serialization, names are written raw (decoded) while values are
 *   re-encoded like Go's url.QueryEscape (space becomes "+", unreserved
 *   characters are A-Z a-z 0-9 "-" "_" "." "~", everything else is %XX).
 * - If the serialized query is empty, the "?" is dropped.
 */

import { hexVal } from "./vcl-strings";

const FILTERSEP = "ÿ";

// ---------------------------------------------------------------------------
// Byte-level helpers. Go strings are byte strings; to reproduce its behavior
// we convert JS strings to UTF-8 bytes and back. Bytes that do not form valid
// UTF-8 are preserved via the surrogate-escape convention (0xDC00 | byte).
// ---------------------------------------------------------------------------

function stringToBytes(s: string): number[] {
	const out: number[] = [];
	for (let i = 0; i < s.length; i++) {
		const cu = s.charCodeAt(i);
		if (cu >= 0xdc80 && cu <= 0xdcff) {
			// Surrogate-escaped raw byte
			out.push(cu & 0xff);
			continue;
		}
		let cp = cu;
		if (cu >= 0xd800 && cu <= 0xdbff && i + 1 < s.length) {
			const lo = s.charCodeAt(i + 1);
			if (lo >= 0xdc00 && lo <= 0xdfff) {
				cp = 0x10000 + ((cu - 0xd800) << 10) + (lo - 0xdc00);
				i++;
			}
		}
		if (cp < 0x80) {
			out.push(cp);
		} else if (cp < 0x800) {
			out.push(0xc0 | (cp >> 6), 0x80 | (cp & 0x3f));
		} else if (cp < 0x10000) {
			out.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
		} else {
			out.push(
				0xf0 | (cp >> 18),
				0x80 | ((cp >> 12) & 0x3f),
				0x80 | ((cp >> 6) & 0x3f),
				0x80 | (cp & 0x3f),
			);
		}
	}
	return out;
}

function bytesToString(bytes: number[]): string {
	let out = "";
	for (let i = 0; i < bytes.length; ) {
		const b = bytes[i]!;
		if (b < 0x80) {
			out += String.fromCharCode(b);
			i++;
			continue;
		}
		let extra: number;
		let cp: number;
		let min: number;
		if (b >= 0xc2 && b <= 0xdf) {
			extra = 1;
			cp = b & 0x1f;
			min = 0x80;
		} else if (b >= 0xe0 && b <= 0xef) {
			extra = 2;
			cp = b & 0x0f;
			min = 0x800;
		} else if (b >= 0xf0 && b <= 0xf4) {
			extra = 3;
			cp = b & 0x07;
			min = 0x10000;
		} else {
			out += String.fromCharCode(0xdc00 | b);
			i++;
			continue;
		}
		let ok = i + extra < bytes.length;
		let v = cp;
		if (ok) {
			for (let j = 1; j <= extra; j++) {
				const c = bytes[i + j]!;
				if ((c & 0xc0) !== 0x80) {
					ok = false;
					break;
				}
				v = (v << 6) | (c & 0x3f);
			}
		}
		if (!ok || v < min || (v >= 0xd800 && v <= 0xdfff) || v > 0x10ffff) {
			out += String.fromCharCode(0xdc00 | b);
			i++;
			continue;
		}
		out += String.fromCodePoint(v);
		i += extra + 1;
	}
	return out;
}

function isValidUtf8(s: string): boolean {
	for (let i = 0; i < s.length; i++) {
		const cu = s.charCodeAt(i);
		if (cu >= 0xd800 && cu <= 0xdbff) {
			const lo = i + 1 < s.length ? s.charCodeAt(i + 1) : 0;
			if (lo >= 0xdc00 && lo <= 0xdfff) {
				i++;
				continue;
			}
			return false;
		}
		if (cu >= 0xdc00 && cu <= 0xdfff) {
			return false;
		}
	}
	return true;
}

/**
 * Percent-decoding matching Go's url.QueryUnescape (plusAsSpace=true) and
 * url.PathUnescape (plusAsSpace=false). Throws on an invalid escape sequence.
 */
function percentUnescape(s: string, plusAsSpace: boolean): string {
	const bytes = stringToBytes(s);
	const out: number[] = [];
	for (let i = 0; i < bytes.length; i++) {
		const b = bytes[i]!;
		if (b === 0x25) {
			// "%"
			const h1 = i + 1 < bytes.length ? hexVal(bytes[i + 1]!) : -1;
			const h2 = i + 2 < bytes.length ? hexVal(bytes[i + 2]!) : -1;
			if (h1 < 0 || h2 < 0) {
				const seq = bytesToString(bytes.slice(i, Math.min(i + 3, bytes.length)));
				throw new Error(`invalid URL escape "${seq}"`);
			}
			out.push(h1 * 16 + h2);
			i += 2;
		} else if (plusAsSpace && b === 0x2b) {
			// "+"
			out.push(0x20);
		} else {
			out.push(b);
		}
	}
	return bytesToString(out);
}

/** Go's url.QueryEscape: space -> "+", unreserved kept, everything else %XX. */
function queryEscape(s: string): string {
	const bytes = stringToBytes(s);
	let out = "";
	for (const b of bytes) {
		if (
			(b >= 0x41 && b <= 0x5a) || // A-Z
			(b >= 0x61 && b <= 0x7a) || // a-z
			(b >= 0x30 && b <= 0x39) || // 0-9
			b === 0x2d || // -
			b === 0x5f || // _
			b === 0x2e || // .
			b === 0x7e // ~
		) {
			out += String.fromCharCode(b);
		} else if (b === 0x20) {
			out += "+";
		} else {
			out += `%${b.toString(16).toUpperCase().padStart(2, "0")}`;
		}
	}
	return out;
}

function compareByteArrays(ba: number[], bb: number[]): number {
	const n = Math.min(ba.length, bb.length);
	for (let i = 0; i < n; i++) {
		if (ba[i]! !== bb[i]!) return ba[i]! < bb[i]! ? -1 : 1;
	}
	return ba.length - bb.length;
}

// ---------------------------------------------------------------------------
// Ordered query string model
// ---------------------------------------------------------------------------

interface QueryParam {
	key: string;
	// null indicates "not set" in VCL (a parameter without "=")
	value: string[] | null;
}

class Query {
	prefix = "";
	items: QueryParam[] = [];

	static parse(input: string): Query {
		const q = new Query();
		const idx = input.indexOf("?");
		if (idx === -1) {
			q.prefix = input;
			return q;
		}
		q.prefix = input.substring(0, idx);
		const qs = input.substring(idx + 1);
		for (const part of qs.split("&")) {
			const eq = part.indexOf("=");
			if (eq === -1) {
				// e.g. "?foo" -- equal sign is not present
				q.items.push({ key: percentUnescape(part, true), value: null });
				continue;
			}
			const key = percentUnescape(part.substring(0, eq), true);
			const val = percentUnescape(part.substring(eq + 1), true);
			q.add(key, val);
		}
		return q;
	}

	set(name: string, val: string): void {
		for (const item of this.items) {
			if (item.key !== name) continue;
			item.value = [val];
			return;
		}
		this.items.push({ key: name, value: [val] });
	}

	add(name: string, val: string): void {
		for (const item of this.items) {
			if (item.key !== name) continue;
			if (item.value === null) item.value = [];
			item.value.push(val);
			return;
		}
		this.items.push({ key: name, value: [val] });
	}

	clean(): void {
		this.items = this.items.filter((item) => item.key !== "");
	}

	filter(keep: (name: string) => boolean): void {
		this.items = this.items.filter((item) => keep(item.key));
	}

	sort(): void {
		// Equal keys come out in reversed relative order.
		// Emulate with a stable sort keyed on (name asc, original index desc);
		// key bytes are computed once per item, not per comparison.
		const decorated = this.items.map((item, index) => ({
			item,
			index,
			bytes: stringToBytes(item.key),
		}));
		decorated.sort((a, b) => {
			const c = compareByteArrays(a.bytes, b.bytes);
			return c !== 0 ? c : b.index - a.index;
		});
		this.items = decorated.map((d) => d.item);
	}

	toString(): string {
		const parts: string[] = [];
		for (const item of this.items) {
			if (item.value === null) {
				parts.push(item.key);
			} else {
				for (const v of item.value) {
					parts.push(`${item.key}=${queryEscape(v)}`);
				}
			}
		}
		const body = parts.join("&");
		return body.length > 0 ? `${this.prefix}?${body}` : this.prefix;
	}
}

// ---------------------------------------------------------------------------
// Glob support (gobwas/glob semantics, no separators): "*" matches any
// sequence, "?" a single character, "[abc]"/"[!a-z]" character classes,
// "{a,b}" alternates, "\" escapes.
// ---------------------------------------------------------------------------

function escapeRegexChar(c: string): string {
	return /[.*+?^${}()|[\]\\/]/.test(c) ? `\\${c}` : c;
}

function escapeClassChar(c: string): string {
	return /[\\\]^[]/.test(c) ? `\\${c}` : c;
}

function globToRegExp(pattern: string): RegExp {
	let re = "";
	let braceDepth = 0;
	for (let i = 0; i < pattern.length; i++) {
		const c = pattern[i]!;
		switch (c) {
			case "*": {
				while (pattern[i + 1] === "*") i++;
				re += "[\\s\\S]*";
				break;
			}
			case "?":
				re += "[\\s\\S]";
				break;
			case "[": {
				let j = i + 1;
				let cls = "";
				let count = 0;
				if (pattern[j] === "!" || pattern[j] === "^") {
					cls += "^";
					j++;
				}
				let closed = false;
				for (; j < pattern.length; j++) {
					const cc = pattern[j]!;
					if (cc === "]") {
						closed = true;
						break;
					}
					if (cc === "\\") {
						j++;
						if (j >= pattern.length) {
							throw new Error("Invalid glob pattern: unexpected end of pattern");
						}
						cls += escapeClassChar(pattern[j]!);
						count++;
						continue;
					}
					cls += cc === "-" ? "-" : escapeClassChar(cc);
					count++;
				}
				if (!closed || count === 0) {
					throw new Error("Invalid glob pattern: unexpected end of character class");
				}
				re += `[${cls}]`;
				i = j;
				break;
			}
			case "{":
				braceDepth++;
				re += "(?:";
				break;
			case "}":
				if (braceDepth > 0) {
					braceDepth--;
					re += ")";
				} else {
					re += "\\}";
				}
				break;
			case ",":
				re += braceDepth > 0 ? "|" : ",";
				break;
			case "\\": {
				i++;
				if (i >= pattern.length) {
					throw new Error("Invalid glob pattern: unexpected end of pattern");
				}
				re += escapeRegexChar(pattern[i]!);
				break;
			}
			default:
				re += escapeRegexChar(c);
		}
	}
	if (braceDepth > 0) {
		throw new Error("Invalid glob pattern: unclosed alternate group");
	}
	return new RegExp(`^(?:${re})$`, "u");
}

// Compiled filter matchers, keyed by pattern (VCL literals in practice).
const MATCHER_CACHE_MAX = 1000;
const GLOB_MATCHER_CACHE = new Map<string, (name: string) => boolean>();
const REGEX_MATCHER_CACHE = new Map<string, (name: string) => boolean>();

function cached(
	cache: Map<string, (name: string) => boolean>,
	pattern: string,
	build: (pattern: string) => (name: string) => boolean,
): (name: string) => boolean {
	let fn = cache.get(pattern);
	if (fn === undefined) {
		fn = build(pattern);
		if (cache.size >= MATCHER_CACHE_MAX) cache.clear();
		cache.set(pattern, fn);
	}
	return fn;
}

function globMatcher(pattern: string): (name: string) => boolean {
	const re = globToRegExp(String(pattern));
	return (name: string) => {
		if (name === "") {
			// gobwas/glob decodes the empty string to U+FFFD before testing
			// single-character matchers, so e.g. "?" and "[!ab]" match "".
			return re.test("") || re.test("�");
		}
		return re.test(name);
	};
}

// ---------------------------------------------------------------------------
// PCRE-flavored regex support
// ---------------------------------------------------------------------------

function pcreToRegExp(pattern: string): RegExp {
	let p = String(pattern);
	let flags = "";
	// Translate leading inline flag groups like (?i) to JS regex flags.
	for (;;) {
		const m = /^\(\?([a-zA-Z]+)\)/.exec(p);
		if (!m) break;
		for (const ch of m[1]!) {
			if (ch === "i" || ch === "m" || ch === "s") {
				if (!flags.includes(ch)) flags += ch;
			} else {
				throw new Error(`Unsupported inline regex flag: ${ch}`);
			}
		}
		p = p.substring(m[0].length);
	}
	return new RegExp(p, `${flags}g`);
}

/**
 * Fastly's PCRE matching never returns zero-length matches; an empty match at
 * a position is skipped and matching resumes at the next position. A name
 * matches only if some non-empty match exists.
 */
function regexMatcher(pattern: string): (name: string) => boolean {
	const re = pcreToRegExp(pattern);
	return (name: string) => {
		re.lastIndex = 0;
		for (const m of name.matchAll(re)) {
			if (m[0].length > 0) return true;
		}
		return false;
	};
}

// ---------------------------------------------------------------------------
// Public module
// ---------------------------------------------------------------------------

export const QueryStringModule = {
	/**
	 * Returns the raw (undecoded) value of the first parameter whose
	 * percent-encoded name matches the canonically re-encoded argument.
	 * Returns null (not set) when the parameter is absent or has no "=".
	 */
	get(url: string, name: string): string | null {
		// Fastly pct-decodes the name argument (no "+" as space) ...
		let decoded: string;
		try {
			decoded = percentUnescape(String(name), false);
		} catch {
			throw new Error("querystring.get: Argument 1 has invalid pct-encode sequence");
		}
		if (!isValidUtf8(decoded)) {
			throw new Error("querystring.get: Argument 1, after pct-decoding, is invalid utf-8");
		}
		// ... then re-encodes it with query semantics, space as %20 (not "+").
		const encoded = queryEscape(decoded).replace(/\+/g, "%20");

		const u = String(url);
		const idx = u.indexOf("?");
		const qs = idx === -1 ? "" : u.substring(idx + 1);
		for (const part of qs.split("&")) {
			const eq = part.indexOf("=");
			if (eq <= 0) continue; // no "=" or empty name
			if (part.substring(0, eq) === encoded) {
				return part.substring(eq + 1);
			}
		}
		return null;
	},

	set(url: string, paramName: string, paramValue: string): string {
		const q = Query.parse(String(url));
		q.set(String(paramName), String(paramValue));
		return q.toString();
	},

	add(url: string, paramName: string, paramValue: string): string {
		const q = Query.parse(String(url));
		q.add(String(paramName), String(paramValue));
		return q.toString();
	},

	/** Removes the entire query string (including the "?"). */
	remove(url: string): string {
		const u = String(url);
		const idx = u.indexOf("?");
		return idx === -1 ? u : u.substring(0, idx);
	},

	/** Removes parameters with an empty name (keeps empty values). */
	clean(url: string): string {
		const q = Query.parse(String(url));
		q.clean();
		return q.toString();
	},

	/** Removes parameters whose name is in the 0xFF-separated name list. */
	filter(url: string, paramNames: string): string {
		const names = new Set(String(paramNames).split(FILTERSEP));
		const q = Query.parse(String(url));
		q.filter((name) => !names.has(name));
		return q.toString();
	},

	/** Keeps only parameters whose name is in the 0xFF-separated name list. */
	filter_except(url: string, paramNames: string): string {
		const names = new Set(String(paramNames).split(FILTERSEP));
		const q = Query.parse(String(url));
		q.filter((name) => names.has(name));
		return q.toString();
	},

	/** Returns the separator (a single 0xFF byte) used by filter/filter_except. */
	filtersep(): string {
		return FILTERSEP;
	},

	/** Sorts parameters by name (byte order), keeping values grouped. */
	sort(url: string): string {
		const q = Query.parse(String(url));
		q.sort();
		return q.toString();
	},

	/** Removes parameters whose name matches the glob pattern. */
	globfilter(url: string, pattern: string): string {
		const matches = cached(GLOB_MATCHER_CACHE, String(pattern), globMatcher);
		const q = Query.parse(String(url));
		q.filter((name) => !matches(name));
		return q.toString();
	},

	/** Keeps only parameters whose name matches the glob pattern. */
	globfilter_except(url: string, pattern: string): string {
		const matches = cached(GLOB_MATCHER_CACHE, String(pattern), globMatcher);
		const q = Query.parse(String(url));
		q.filter((name) => matches(name));
		return q.toString();
	},

	/** Removes parameters whose name matches the regex (unanchored). */
	regfilter(url: string, pattern: string): string {
		const matches = cached(REGEX_MATCHER_CACHE, String(pattern), regexMatcher);
		const q = Query.parse(String(url));
		q.filter((name) => !matches(name));
		return q.toString();
	},

	/** Keeps only parameters whose name matches the regex (unanchored). */
	regfilter_except(url: string, pattern: string): string {
		const matches = cached(REGEX_MATCHER_CACHE, String(pattern), regexMatcher);
		const q = Query.parse(String(url));
		q.filter((name) => matches(name));
		return q.toString();
	},
};
