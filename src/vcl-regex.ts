// Fastly matches VCL regexes with PCRE2 on the raw UTF-8 bytes.
// There, only LF counts as a newline and only ASCII letters ignore case.
//
// We turn each pattern into a JavaScript regex that behaves the same on a string holding one byte per char.

type Range = [number, number];

const utf8Encoder = new TextEncoder();
const utf8Decoder = new TextDecoder("utf-8", { ignoreBOM: true });
const ASCII = /^[\x00-\x7f]*$/;

/** Turns a string into its UTF-8 bytes, one byte per char. */
export function toBytes(s: string): string {
	if (ASCII.test(s)) return s;
	const bytes = utf8Encoder.encode(s);
	let out = "";
	for (let i = 0; i < bytes.length; i++) out += String.fromCharCode(bytes[i]!);
	return out;
}

/**
 * Turns a byte string back into text.
 * A match can split a multi-byte character, and the broken part becomes U+FFFD.
 */
export function fromBytes(s: string): string {
	if (ASCII.test(s)) return s;
	const bytes = new Uint8Array(s.length);
	for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
	return utf8Decoder.decode(bytes);
}

const DIGIT: Range[] = [[0x30, 0x39]];
const UPPER: Range[] = [[0x41, 0x5a]];
const LOWER: Range[] = [[0x61, 0x7a]];
const ALPHA = [...UPPER, ...LOWER];
const ALNUM = [...DIGIT, ...ALPHA];
const WORD: Range[] = [...ALNUM, [0x5f, 0x5f]];
const BLANK: Range[] = [
	[0x09, 0x09],
	[0x20, 0x20],
];
const SPACE: Range[] = [
	[0x09, 0x0d],
	[0x20, 0x20],
];

const SETS: Record<string, Range[]> = {
	d: DIGIT,
	w: WORD,
	s: SPACE,
	h: [...BLANK, [0xa0, 0xa0]],
	v: [
		[0x0a, 0x0d],
		[0x85, 0x85],
	],
};

const POSIX: Record<string, Range[]> = {
	alpha: ALPHA,
	digit: DIGIT,
	alnum: ALNUM,
	upper: UPPER,
	lower: LOWER,
	space: SPACE,
	blank: BLANK,
	punct: [
		[0x21, 0x2f],
		[0x3a, 0x40],
		[0x5b, 0x60],
		[0x7b, 0x7e],
	],
	xdigit: [...DIGIT, [0x41, 0x46], [0x61, 0x66]],
	cntrl: [
		[0x00, 0x1f],
		[0x7f, 0x7f],
	],
	print: [[0x20, 0x7e]],
	graph: [[0x21, 0x7e]],
	word: WORD,
	ascii: [[0x00, 0x7f]],
};

const ANCHORS: Record<string, string> = {
	A: "^",
	z: "$",
	Z: "(?=\\n?$)",
	b: "\\b",
	B: "\\B",
	R: "(?:\\r\\n|[\\n\\x0b\\f\\r\\x85])",
};

const SIMPLE_ESCAPES: Record<string, number> = {
	n: 0x0a,
	r: 0x0d,
	t: 0x09,
	f: 0x0c,
	e: 0x1b,
	a: 0x07,
	// Only reached inside a class, where \b is a backspace.
	b: 0x08,
};

function complement(ranges: Range[]): Range[] {
	const out: Range[] = [];
	let next = 0;
	for (const [lo, hi] of [...ranges].sort((a, b) => a[0] - b[0])) {
		if (lo > next) out.push([next, lo - 1]);
		next = Math.max(next, hi + 1);
	}
	if (next <= 0xff) out.push([next, 0xff]);
	return out;
}

function withOtherCase(ranges: Range[]): Range[] {
	const out = [...ranges];
	for (const [lo, hi] of ranges) {
		for (const [a, z, shift] of [
			[0x41, 0x5a, 0x20],
			[0x61, 0x7a, -0x20],
		] as const) {
			const l = Math.max(lo, a);
			const h = Math.min(hi, z);
			if (l <= h) out.push([l + shift, h + shift]);
		}
	}
	return out;
}

function classSource(ranges: Range[], negate: boolean, caseless: boolean): string {
	const hex = (c: number) => `\\x${c.toString(16).padStart(2, "0")}`;
	const body = (caseless ? withOtherCase(ranges) : ranges)
		.map(([lo, hi]) => (lo === hi ? hex(lo) : `${hex(lo)}-${hex(hi)}`))
		.join("");
	return `[${negate ? "^" : ""}${body}]`;
}

const isSingleChar = (r: Range[]) => r.length === 1 && r[0]![0] === r[0]![1];

/** Returns the bytes matched by the escape at p[i], just after the backslash. */
function escapeRanges(p: string, i: number): [Range[], number] {
	const c = p[i]!;
	const set = SETS[c.toLowerCase()];
	if (set) return [c === c.toLowerCase() ? set : complement(set), i + 1];
	let code = SIMPLE_ESCAPES[c];
	let next = i + 1;
	const braced = /^x\{([0-9a-fA-F]+)\}/.exec(p.slice(i));
	if (braced) {
		code = parseInt(braced[1]!, 16);
		next = i + braced[0].length;
	} else if ((c === "x" && p[i + 1] !== "{") || c === "0") {
		const digits = (c === "x" ? /^[0-9a-f]{0,2}/i : /^[0-7]{0,2}/).exec(p.slice(i + 1))![0];
		code = digits ? parseInt(digits, c === "x" ? 16 : 8) : 0;
		next += digits.length;
	} else if (!/[a-z0-9]/i.test(c)) {
		code = c.charCodeAt(0);
	}
	if (code === undefined || code > 0xff) {
		throw new Error(`Unsupported regex escape \\${c}`);
	}
	return [[[code, code]], next];
}

function classItem(p: string, i: number): [Range[], number] {
	return p[i] === "\\" ? escapeRanges(p, i + 1) : [[[p.charCodeAt(i), p.charCodeAt(i)]], i + 1];
}

/** Translates the character class whose body starts at p[i], just after the "[". */
function classAt(p: string, i: number, caseless: boolean): [string, number] {
	const negate = p[i] === "^";
	if (negate) i++;
	const ranges: Range[] = [];
	// A "]" right at the start is a literal, so read at least one item.
	do {
		if (i >= p.length) throw new Error("Missing ] in regex character class");
		const posix = /^\[:(\^?)([a-z]+):\]/.exec(p.slice(i));
		if (posix) {
			// PCRE2 treats [:upper:] and [:lower:] as [:alpha:] when ignoring case.
			const name = caseless && (posix[2] === "upper" || posix[2] === "lower") ? "alpha" : posix[2]!;
			const set = POSIX[name];
			if (!set) throw new Error(`Unknown POSIX class ${posix[0]}`);
			ranges.push(...(posix[1] ? complement(set) : set));
			i += posix[0].length;
			continue;
		}
		let item: Range[];
		[item, i] = classItem(p, i);
		if (p[i] === "-" && p[i + 1] !== "]" && i + 1 < p.length) {
			const [end, next] = classItem(p, i + 1);
			if (!isSingleChar(item) || !isSingleChar(end) || item[0]![0] > end[0]![0]) {
				throw new Error("Invalid range in regex character class");
			}
			item = [[item[0]![0], end[0]![0]]];
			i = next;
		}
		ranges.push(...item);
	} while (p[i] !== "]");
	return [classSource(ranges, negate, caseless), i + 1];
}

function translate(p: string): string {
	let out = "";
	let opts = "";
	const saved: string[] = [];
	let i = 0;
	while (i < p.length) {
		const c = p[i++]!;
		let m: RegExpExecArray | null;
		if (c === "[") {
			let cls: string;
			[cls, i] = classAt(p, i, opts.includes("i"));
			out += cls;
		} else if (c === "(") {
			saved.push(opts);
			const rest = p.slice(i);
			if ((m = /^\?#[^)]*\)/.exec(rest))) {
				saved.pop();
			} else if ((m = /^\?P=(\w+)\)/.exec(rest))) {
				saved.pop();
				out += `\\k<${m[1]}>`;
			} else if ((m = /^\?(?:P?<(\w+)>|'(\w+)')/.exec(rest))) {
				out += `(?<${m[1] ?? m[2]}>`;
			} else if ((m = /^(?:\?[:=!]|\?<[=!]|(?!\?))/.exec(rest))) {
				out += `(${m[0]}`;
			} else if ((m = /^\?([a-zA-Z]*)(?:-([a-zA-Z]*))?([:)])/.exec(rest))) {
				const [, on = "", off = "", end] = m;
				for (const f of on + off) {
					if (!"ims".includes(f)) throw new Error(`Unsupported regex option (?${f})`);
				}
				// "(?i)" lasts until the end of the enclosing group, "(?i:...)" only inside its own.
				if (end === ")") saved.pop();
				else out += "(?:";
				opts = [...(opts + on)].filter((f) => !off.includes(f)).join("");
			} else {
				throw new Error(`Unsupported regex group (${rest.slice(0, 2)}`);
			}
			i += m[0].length;
		} else if (c === ")") {
			opts = saved.pop() ?? opts;
			out += ")";
		} else if (c === ".") {
			out += opts.includes("s") ? "[\\s\\S]" : "[^\\n]";
		} else if (c === "^") {
			out += opts.includes("m") ? "(?:^|(?<=\\n)(?=[\\s\\S]))" : "^";
		} else if (c === "$") {
			out += opts.includes("m") ? "(?=\\n|$)" : "(?=\\n?$)";
		} else if (c !== "\\") {
			out += opts.includes("i") && /[a-z]/i.test(c) ? `[${c.toLowerCase()}${c.toUpperCase()}]` : c;
		} else if (p[i] === undefined) {
			throw new Error("Regex ends with a \\");
		} else if (ANCHORS[p[i]!] !== undefined) {
			out += ANCHORS[p[i++]!];
		} else if ((m = /^(?:[1-9]\d*|k<\w+>)/.exec(p.slice(i)))) {
			// Wrapped so that a digit coming next, say after a dropped comment, doesn't join the group number.
			out += `(?:\\${m[0]})`;
			i += m[0].length;
		} else {
			let ranges: Range[];
			[ranges, i] = escapeRanges(p, i);
			out += classSource(ranges, false, opts.includes("i"));
		}
	}
	return out;
}

const cache = new Map<string, RegExp>();

/**
 * Compiles a VCL regex into a JavaScript one, to run on toBytes() of the subject.
 * Throws on syntax we can't translate, like atomic groups, possessive quantifiers or \K.
 *
 * Compiled regexes are shared, so reset lastIndex before using a global one.
 */
export function compileRegex(pattern: string, flags: "" | "g" = ""): RegExp {
	const key = `${flags}/${pattern}`;
	let re = cache.get(key);
	if (re === undefined) {
		re = new RegExp(translate(toBytes(pattern)), flags);
		if (cache.size >= 1000) cache.clear();
		cache.set(key, re);
	}
	return re;
}
