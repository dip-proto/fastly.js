/**
 * VCLString represents VCL's three-valued string system: NOTSET, empty string, and a value.
 *
 * In Fastly VCL:
 * - `declare local var.S STRING;` creates a NOTSET variable
 * - Unset/missing HTTP headers are NOTSET
 * - `!var.S` is true when NOTSET, false when empty string
 * - `var.S == ""` is false when NOTSET, true when empty string
 * - Stringifying NOTSET produces "(null)"
 * - `std.strlen` of NOTSET returns 0
 */
export class VCLString {
	readonly value: string;
	readonly isNotSet: boolean;

	private constructor(value: string, isNotSet: boolean) {
		this.value = value;
		this.isNotSet = isNotSet;
	}

	static notset(): VCLString {
		return new VCLString("", true);
	}

	static from(value: string): VCLString {
		return new VCLString(value, false);
	}

	toString(): string {
		return this.isNotSet ? "(null)" : this.value;
	}

	get length(): number {
		return this.value.length;
	}
}

/**
 * VCLFloat wraps a JS number that carries the VCL FLOAT type.
 *
 * Fastly renders FLOAT values with three decimal places ("8.000", "2.303"),
 * while INTEGER values render without a decimal point. JS numbers cannot carry
 * that distinction, so FLOAT-typed values are wrapped. valueOf() lets
 * arithmetic and comparisons treat the wrapper as a plain number.
 */
export class VCLFloat {
	readonly value: number;

	constructor(value: number) {
		this.value = value;
	}

	valueOf(): number {
		return this.value;
	}

	toString(): string {
		if (Number.isNaN(this.value)) return "NaN";
		if (this.value === Number.POSITIVE_INFINITY) return "inf";
		if (this.value === Number.NEGATIVE_INFINITY) return "-inf";
		// toFixed switches to exponential notation beyond 1e21; Fastly always
		// renders the full decimal expansion. Doubles that large are integral,
		// so BigInt conversion is exact.
		if (Math.abs(this.value) >= 1e21) return `${BigInt(this.value)}.000`;
		return this.value.toFixed(3);
	}
}

/**
 * VCLRTime is a relative-time (RTIME) value, stored in seconds.
 * Stringifies with millisecond precision and three decimals ("90.000").
 */
export class VCLRTime {
	readonly seconds: number;

	constructor(seconds: number) {
		this.seconds = seconds;
	}

	valueOf(): number {
		return this.seconds;
	}

	toString(): string {
		if (!Number.isFinite(this.seconds)) return "0.000";
		return (Math.trunc(this.seconds * 1000) / 1000).toFixed(3);
	}
}

/**
 * VCLTime is an absolute TIME value. It extends Date so existing code that
 * expects Date instances (getTime() etc.) keeps working; stringification uses
 * the IMF-fixdate format Fastly uses ("Mon, 02 Jan 2006 22:04:05 GMT").
 */
export class VCLTime extends Date {
	override toString(): string {
		return this.toUTCString();
	}
}

/**
 * Separator between stored fragments of a multi-value HTTP header (one per
 * `add` statement). A plain read returns the first fragment; std.collect
 * merges them; serializers emit one header line per fragment.
 */
export const HEADER_FRAGMENT_SEPARATOR = "\n";

/** First fragment of a possibly multi-fragment header value. */
export function firstHeaderFragment(value: string): string {
	const idx = value.indexOf(HEADER_FRAGMENT_SEPARATOR);
	return idx === -1 ? value : value.slice(0, idx);
}

/** Convert any runtime value to its VCL string form. */
export function vclToString(v: any): string {
	if (typeof v === "string") return v;
	if (v === null || v === undefined) return "(null)";
	if (typeof v === "boolean") return v ? "1" : "0";
	if (v instanceof VCLString) return v.toString();
	if (v instanceof VCLFloat || v instanceof VCLRTime) return v.toString();
	if (v instanceof Date) return v.toUTCString();
	if (typeof v === "number") {
		if (Number.isNaN(v)) return "NaN";
		if (v === Number.POSITIVE_INFINITY) return "inf";
		if (v === Number.NEGATIVE_INFINITY) return "-inf";
		// Shortest-round-trip formatting turns large integral doubles like
		// -(2^63) into "-9223372036854776000"; BigInt prints them exactly.
		if (Number.isInteger(v) && Math.abs(v) >= 2 ** 53) return BigInt(v).toString();
		return String(v);
	}
	return String(v);
}

/** Check if a value is a NOTSET VCLString */
export function isNotSet(v: any): v is VCLString {
	return v instanceof VCLString && v.isNotSet;
}

/** Get the raw string value (empty string for NOTSET) */
export function toRawString(v: any): string {
	if (v instanceof VCLString) return v.value;
	return String(v ?? "");
}

/** Get the display string value ("(null)" for NOTSET) */
export function toDisplayString(v: any): string {
	if (v instanceof VCLString) return v.toString();
	return String(v ?? "");
}

/**
 * Result of string concatenation that tracks NOTSET parts.
 * The final string depends on the storage target (header vs local).
 */
export class VCLConcatResult {
	/** The parts of the concatenation with their NOTSET status */
	readonly parts: Array<{ value: string; notset: boolean }>;
	/** Whether ALL parts are NOTSET */
	readonly allNotSet: boolean;

	constructor(parts: Array<{ value: string; notset: boolean }>) {
		this.parts = parts;
		this.allNotSet = parts.length > 0 && parts.every((p) => p.notset);
	}

	/** Resolve for storing in a local variable: NOTSET parts become empty, flag is lost */
	forLocal(): string {
		return this.parts.map((p) => (p.notset ? "" : p.value)).join("");
	}

	/** Resolve for storing in a header: NOTSET parts become "(null)" */
	forHeader(): string | VCLString {
		if (this.allNotSet) return VCLString.notset();
		return this.display();
	}

	/** Full display string: NOTSET parts render as "(null)". */
	display(): string {
		return this.parts.map((p) => (p.notset ? "(null)" : p.value)).join("");
	}
}

/** Parse a value into concat parts for tracking NOTSET through concatenation */
export function toConcatPart(v: any): { value: string; notset: boolean } {
	if (v instanceof VCLString) {
		return { value: v.value, notset: v.isNotSet };
	}
	if (v instanceof VCLConcatResult) {
		// Flatten nested concat - shouldn't normally happen but handle gracefully
		return { value: v.forLocal(), notset: v.allNotSet };
	}
	if (v === null || v === undefined) {
		return { value: "", notset: true };
	}
	return { value: vclToString(v), notset: false };
}
