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
	return { value: String(v ?? ""), notset: false };
}
