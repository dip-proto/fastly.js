/**
 * VCL Math Functions Module
 *
 * Implements all math.* functions from Fastly VCL.
 * Reference: https://developer.fastly.com/reference/vcl/functions/math-trig/
 */

export interface MathModule {
	sin: (x: number) => number;
	cos: (x: number) => number;
	tan: (x: number) => number;
	asin: (x: number) => number;
	acos: (x: number) => number;
	atan: (x: number) => number;
	atan2: (y: number, x: number) => number;
	sinh: (x: number) => number;
	cosh: (x: number) => number;
	tanh: (x: number) => number;
	asinh: (x: number) => number;
	acosh: (x: number) => number;
	atanh: (x: number) => number;
	exp: (x: number) => number;
	exp2: (x: number) => number;
	log: (x: number) => number;
	log2: (x: number) => number;
	log10: (x: number) => number;
	pow: (base: number, exp: number) => number;
	sqrt: (x: number) => number;
	ceil: (x: number) => number;
	floor: (x: number) => number;
	round: (x: number) => number;
	roundeven: (x: number) => number;
	roundhalfdown: (x: number) => number;
	roundhalfup: (x: number) => number;
	trunc: (x: number) => number;
	abs: (x: number) => number;
	min: (a: number, b: number) => number;
	max: (a: number, b: number) => number;
	fmod: (x: number, y: number) => number;
	is_finite: (x: number) => boolean;
	is_infinite: (x: number) => boolean;
	is_nan: (x: number) => boolean;
	is_normal: (x: number) => boolean;
	is_subnormal: (x: number) => boolean;
}

// Minimum normal positive number for IEEE 754 double precision
const MIN_NORMAL = 2.2250738585072014e-308;
const MIN_SUBNORMAL = 5e-324;

function requireFinite(x: number, fn: (x: number) => number): number {
	return Number.isFinite(x) ? fn(x) : NaN;
}

function logWithZeroCheck(x: number, fn: (x: number) => number): number {
	if (x < 0) return NaN;
	if (x === 0) return -Infinity;
	return fn(x);
}

function roundingWrapper(x: number, fn: (x: number) => number): number {
	return Number.isFinite(x) ? fn(x) : x;
}

export function createMathModule(): MathModule {
	return {
		sin: (x: number): number => requireFinite(x, Math.sin),
		cos: (x: number): number => requireFinite(x, Math.cos),
		tan: (x: number): number => requireFinite(x, Math.tan),

		asin: (x: number): number => (x < -1 || x > 1 ? NaN : Math.asin(x)),
		acos: (x: number): number => (x < -1 || x > 1 ? NaN : Math.acos(x)),
		atan: Math.atan,
		atan2: Math.atan2,

		sinh: Math.sinh,
		cosh: Math.cosh,
		tanh: Math.tanh,
		asinh: Math.asinh,
		acosh: (x: number): number => (x < 1 ? NaN : Math.acosh(x)),
		atanh: (x: number): number => (x <= -1 || x >= 1 ? NaN : Math.atanh(x)),

		exp: Math.exp,
		exp2: (x: number): number => 2 ** x,
		log: (x: number): number => logWithZeroCheck(x, Math.log),
		log2: (x: number): number => logWithZeroCheck(x, Math.log2),
		log10: (x: number): number => logWithZeroCheck(x, Math.log10),
		pow: Math.pow,
		sqrt: (x: number): number => (x < 0 ? NaN : Math.sqrt(x)),

		ceil: (x: number): number => roundingWrapper(x, Math.ceil),
		floor: (x: number): number => roundingWrapper(x, Math.floor),
		round: (x: number): number => roundingWrapper(x, Math.round),

		// Banker's rounding: round to nearest even
		roundeven: (x: number): number => {
			if (!Number.isFinite(x)) return x;
			const rounded = Math.round(x);
			const diff = Math.abs(x - rounded);
			if (Math.abs(diff - 0.5) < Number.EPSILON) {
				return rounded % 2 === 0 ? rounded : rounded - Math.sign(x);
			}
			return rounded;
		},

		// Round half values towards zero
		roundhalfdown: (x: number): number => {
			if (!Number.isFinite(x)) return x;
			const sign = Math.sign(x);
			const abs = Math.abs(x);
			const fraction = abs - Math.floor(abs);
			return fraction <= 0.5 ? sign * Math.floor(abs) : sign * Math.ceil(abs);
		},

		roundhalfup: (x: number): number => roundingWrapper(x, Math.round),
		trunc: (x: number): number => roundingWrapper(x, Math.trunc),

		abs: Math.abs,
		min: Math.min,
		max: Math.max,
		fmod: (x: number, y: number): number => (y === 0 ? NaN : x % y),

		is_finite: Number.isFinite,
		is_infinite: (x: number): boolean => x === Infinity || x === -Infinity,
		is_nan: Number.isNaN,

		is_normal: (x: number): boolean => {
			if (!Number.isFinite(x) || x === 0) return false;
			return Math.abs(x) >= MIN_NORMAL;
		},

		is_subnormal: (x: number): boolean => {
			if (!Number.isFinite(x) || x === 0) return false;
			const abs = Math.abs(x);
			return abs < MIN_NORMAL && abs >= MIN_SUBNORMAL;
		},
	};
}
