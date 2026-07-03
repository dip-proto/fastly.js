import {
	hashHex,
	logError,
	logInfo,
	randomFloat,
	UnsupportedFeatureError,
	type VCLPlatform,
} from "./platform";
import { createVCLContext } from "./vcl";
import { aclMatch, validateAclEntries } from "./vcl-acl";
import { BUILTIN_SIGNATURES, VARIABLE_TYPES } from "./vcl-builtin-types";
import {
	checkCallTreeLimit,
	headerWorkspaceCost,
	MAX_REQUEST_WORKSPACE_SIZE,
	VCLLimitExceededError,
} from "./vcl-limits";
import type {
	VCLAddStatement,
	VCLBinaryExpression,
	VCLBlockStatement,
	VCLCallStatement,
	VCLDeclareStatement,
	VCLErrorStatement,
	VCLExpression,
	VCLExpressionStatement,
	VCLFunctionCall,
	VCLGotoStatement,
	VCLHashDataStatement,
	VCLIdentifier,
	VCLIfStatement,
	VCLLabelStatement,
	VCLLogStatement,
	VCLNumberLiteral,
	VCLProgram,
	VCLRegexLiteral,
	VCLRestartStatement,
	VCLReturnStatement,
	VCLSetStatement,
	VCLStatement,
	VCLStringLiteral,
	VCLSubroutine,
	VCLSwitchStatement,
	VCLSyntheticBase64Statement,
	VCLSyntheticStatement,
	VCLTernaryExpression,
	VCLUnaryExpression,
	VCLUnsetStatement,
} from "./vcl-parser";
import {
	boltsort_sort as boltsortImpl,
	cstr_escape as cstrEscapeImpl,
	json_escape as jsonEscapeImpl,
	regsuball as regsuballImpl,
	regsub as regsubImpl,
	setcookie_delete_by_name,
	setcookie_get_value_by_name,
	subfield as subfieldImpl,
	substr as substrImpl,
	urldecode as urldecodeImpl,
	urlencode as urlencodeImpl,
	urlNormalize as urlNormalizeImpl,
	xml_escape as xmlEscapeImpl,
} from "./vcl-strings";
import { parseTimeValue } from "./vcl-time";
import {
	firstHeaderFragment,
	HEADER_FRAGMENT_SEPARATOR,
	isNotSet,
	toConcatPart,
	toDisplayString,
	toRawString,
	VCLConcatResult,
	VCLFloat,
	VCLRTime,
	VCLString,
	VCLTime,
	vclToString,
} from "./vcl-value";

export interface VCLBackend {
	name: string;
	host: string;
	port: number;
	ssl: boolean;
	connect_timeout: number;
	first_byte_timeout: number;
	between_bytes_timeout: number;
	/** Total fetch bound in seconds; 0 or unset falls back to first_byte_timeout. */
	fetch_timeout?: number;
	max_connections: number;
	ssl_cert_hostname?: string;
	ssl_sni_hostname?: string;
	ssl_check_cert?: boolean;
	probe?: VCLProbe;
	is_healthy?: boolean;
	/** True for the built-in placeholder backend a fresh context starts with. */
	builtin?: boolean;
}

export interface VCLProbe {
	request: string;
	expected_response: number;
	interval: number;
	timeout: number;
	window: number;
	threshold: number;
	initial: number;
}

export interface VCLDirector {
	name: string;
	type: "random" | "hash" | "client" | "fallback" | "chash";
	backends: Array<{ backend: VCLBackend; weight: number }>;
	quorum: number;
	retries: number;
}

export interface VCLACLEntry {
	ip: string;
	subnet?: number;
	negated?: boolean;
}

export interface VCLACL {
	name: string;
	entries: VCLACLEntry[];
}

export interface VCLTable {
	name: string;
	valueType?: string;
	entries: Record<string, string | number | boolean | RegExp>;
}

export interface VCLContext {
	req: {
		url: string;
		method: string;
		http: Record<string, string>;
		backend?: string;
		restarts?: number;
	};
	bereq: { url: string; method: string; http: Record<string, string> };
	beresp: {
		status: number;
		statusText: string;
		http: Record<string, string>;
		ttl: number;
		grace?: number;
		stale_while_revalidate?: number;
		do_esi?: boolean;
		/** Whether beresp.pci / beresp.hipaa was set on this response. */
		pci?: boolean;
		/**
		 * The backend that answered this pass's request, captured when the
		 * response was obtained.
		 * Absent when no backend request was made (e.g. a cache hit), which
		 * makes beresp.backend.* read as not set.
		 */
		backend?: { name: string; host: string; port: number; ip: string };
	};
	resp: { status: number; statusText: string; http: Record<string, string> };
	obj: {
		status: number;
		/** Response reason phrase; undefined until a synthetic/error body sets it. */
		response?: string;
		http: Record<string, string>;
		hits: number;
	};
	cache: Map<string, any>;
	hashData?: string[];
	backends: Record<string, VCLBackend>;
	directors: Record<string, VCLDirector>;
	current_backend?: VCLBackend;
	acls: Record<string, VCLACL>;
	tables: Record<string, VCLTable>;
	client?: { ip: string };
	re?: { groups?: Record<number, string> };
	platform: VCLPlatform;

	// Local variables (declared with "declare local var.xxx TYPE;")
	locals: Record<string, any>;
	// Declared VCL types of local variables (without the "var." prefix).
	localTypes?: Record<string, string>;

	// Bytes consumed assembling request headers into the per-request workspace.
	// Fastly never reclaims it within a request, not even across restarts, so this
	// only ever grows once set.
	workspaceBytes?: number;

	// Fastly-specific properties
	fastly?: {
		error?: string;
		state?: string;
	};

	// Address functions
	addr?: {
		is_ipv4: (address: string) => boolean;
		is_ipv6: (address: string) => boolean;
		is_unix: (address: string) => boolean;
		extract_bits: (address: string, offset: number, length: number) => number;
	};

	accept?: {
		language_lookup: (
			availableLanguages: string,
			defaultLanguage: string,
			acceptLanguageHeader: string,
		) => string;
		charset_lookup: (
			availableCharsets: string,
			defaultCharset: string,
			acceptCharsetHeader: string,
		) => string;
		encoding_lookup: (
			availableEncodings: string,
			defaultEncoding: string,
			acceptEncodingHeader: string,
		) => string;
		media_lookup: (
			availableMediaTypes: string,
			defaultMediaType: string,
			mediaTypePatterns: string,
			acceptHeader: string,
		) => string;
		language_filter_basic: (
			availableLanguages: string,
			defaultLanguage: string,
			acceptLanguageHeader: string,
			nmatches: number,
		) => string;
	};
	bin?: {
		base64_to_hex: (base64: string) => string;
		hex_to_base64: (hex: string) => string;
		data_convert: (input: string, inputEncoding: string, outputEncoding: string) => string;
	};
	querystring?: {
		get: (queryString: string, paramName: string) => string | null;
		set: (queryString: string, paramName: string, paramValue: string) => string;
		add: (queryString: string, paramName: string, paramValue: string) => string;
		remove: (queryString: string) => string;
		clean: (queryString: string) => string;
		filter: (queryString: string, paramNames: string) => string;
		filter_except: (queryString: string, paramNames: string) => string;
		filtersep: () => string;
		sort: (queryString: string) => string;
		globfilter: (queryString: string, pattern: string) => string;
		globfilter_except: (queryString: string, pattern: string) => string;
		regfilter: (queryString: string, pattern: string) => string;
		regfilter_except: (queryString: string, pattern: string) => string;
		[key: string]: any;
	};
	uuid?: {
		version3: (namespace: string, name: string) => string | null;
		version4: () => string;
		version5: (namespace: string, name: string) => string | null;
		version7: () => string;
		dns: () => string;
		url: () => string;
		oid: () => string;
		x500: () => string;
		is_valid: (uuid: string) => boolean;
		is_version3: (uuid: string) => boolean;
		is_version4: (uuid: string) => boolean;
		is_version5: (uuid: string) => boolean;
		is_version7: (uuid: string) => boolean;
		decode: (uuid: string) => Uint8Array | null;
		encode: (binary: Uint8Array) => string;
		[key: string]: any;
	};
	utf8?: {
		is_valid: (s: string) => boolean;
		codepoint_count: (s: string) => number;
		substr: (s: string, offset: number, length?: number) => string | null;
		strpad: (s: string, width: number, pad: string) => string | null;
	};
	waf?: Record<string, any>;
	error?: (status: number, message: string) => string;
	// The std module has many dynamic properties - use a flexible type
	std?: Record<string, any> & {
		log?: (message: string) => void;
		strftime?: (format: string, time: number) => string;
		time?: (s: string, fallback: any) => Date;
		integer2time?: (n: number) => Date;
		backend?: {
			add: (name: string, host: string, port: number, ssl?: boolean, options?: any) => boolean;
			remove: (name: string) => boolean;
			get: (name: string) => VCLBackend | null;
			set_current: (name: string) => boolean;
			is_healthy: (name: string) => boolean;
			add_probe: (backendName: string, options: any) => boolean;
		};
		director?: {
			add: (name: string, type: string, options?: any) => boolean;
			remove: (name: string) => boolean;
			add_backend: (directorName: string, backendName: string, weight?: number) => boolean;
			remove_backend: (directorName: string, backendName: string) => boolean;
			select_backend: (directorName: string) => VCLBackend | null;
		};
		tolower: (str: string) => string;
		toupper: (str: string) => string;
		strlen: (str: string) => number;
		strstr: (haystack: string, needle: string) => string | null;
		substr: (str: string, offset: number, length?: number) => string;
		prefixof: (str: string, prefix: string) => boolean;
		suffixof: (str: string, suffix: string) => boolean;
		replace: (str: string, search: string, replacement: string) => string;
		replaceall: (str: string, search: string, replacement: string) => string;
		regsub: (str: string, regex: string, replacement: string) => string;
		regsuball: (str: string, regex: string, replacement: string) => string;
		integer: (value: any) => number;
		real: (value: any) => number;
		math: {
			round: (num: number) => number;
			floor: (num: number) => number;
			ceil: (num: number) => number;
			pow: (base: number, exponent: number) => number;
			log: (num: number) => number;
			min: (a: number, b: number) => number;
			max: (a: number, b: number) => number;
			abs: (num: number) => number;
		};
		base64: (str: string) => string;
		base64_decode: (str: string) => string;
		base64url: (str: string) => string;
		base64url_decode: (str: string) => string;
		digest: {
			hash_md5: (str: string) => string;
			hash_sha1: (str: string) => string;
			hash_sha256: (str: string) => string;
			hash_sha512: (str: string) => string;
			hash_xxh32: (str: string) => string;
			hash_xxh64: (str: string) => string;
			hmac_md5: (key: string, message: string) => string | null;
			hmac_sha1: (key: string, message: string) => string | null;
			hmac_sha256: (key: string, message: string) => string | null;
			hmac_sha512: (key: string, message: string) => string | null;
			hmac_md5_base64: (key: string, message: string) => string | null;
			hmac_sha1_base64: (key: string, message: string) => string | null;
			hmac_sha256_base64: (key: string, message: string) => string | null;
			hmac_sha512_base64: (key: string, message: string) => string | null;
			secure_is_equal: (a: string, b: string) => boolean;
			base64: (str: string) => string;
			base64_decode: (str: string) => string;
			base64url: (str: string) => string;
			base64url_decode: (str: string) => string;
			base64url_nopad: (str: string) => string;
			base64url_nopad_decode: (str: string) => string;
			[key: string]: any;
		};

		header: {
			get: (headers: Record<string, string>, name: string) => string | null;
			set: (headers: Record<string, string>, name: string, value: string) => void;
			remove: (headers: Record<string, string>, name: string) => void;
			filter: (headers: Record<string, string>, pattern: string) => void;
			filter_except: (headers: Record<string, string>, pattern: string) => void;
		};
		http: { status_matches: (status: number, pattern: string) => boolean };
		synthetic: (content: string) => void;
		error: (status: number, message?: string) => void;
		querystring: {
			get: (url: string, name: string) => string | null;
			set: (url: string, name: string, value: string) => string;
			remove: (url: string, name: string) => string;
			filter: (url: string, names: string[]) => string;
			filter_except: (url: string, names: string[]) => string;
			[key: string]: any;
		};
		strrev?: (s: string) => string;
		strrep?: (s: string, count: number) => string;
		strpad?: (s: string, width: number, pad: string) => string;
		strcasecmp?: (s1: string, s2: string) => number;
		replace_prefix?: (s: string, prefix: string, replacement: string) => string;
		replace_suffix?: (s: string, suffix: string, replacement: string) => string;
		basename?: (s: string) => string;
		dirname?: (s: string) => string;
		atoi?: (s: string) => number;
		atof?: (s: string) => number;
		strtol?: (s: string, base: number) => number;
		strtof?: (s: string) => number;
		itoa?: (n: number, base?: number) => string;
		itoa_charset?: (n: number, charset: string) => string;
		ip?: (s: string, fallback: string) => string;
		ip2str?: (ip: string) => string;
		str2ip?: (s: string) => string;
		anystr2ip?: (s: string, fallback: string) => string;
		collect?: (header: string[], separator?: string) => string;
		count?: (header: string[]) => number;
		// ACL functions
		acl?: {
			add: (name: string) => boolean;
			remove: (name: string) => boolean;
			add_entry: (aclName: string, ip: string, subnet?: number, negated?: boolean) => boolean;
			remove_entry: (aclName: string, ip: string, subnet?: number) => boolean;
			check: (ip: string, aclName: string) => boolean;
		};
		// Random functions
		random?: {
			randombool: (probability: number) => boolean;
			randombool_seeded: (probability: number, seed: string) => boolean;
			randomint: (from: number, to: number) => number;
			randomint_seeded: (from: number, to: number, seed: string) => number;
			randomstr: (length: number, charset?: string) => string;
			bool?: (numerator: number, denominator: number) => boolean;
		};
		// Table functions
		table?: {
			add: (name: string) => boolean;
			remove: (name: string) => boolean;
			add_entry: (
				tableName: string,
				key: string,
				value: string | number | boolean | RegExp,
			) => boolean;
			remove_entry: (tableName: string, key: string) => boolean;
			lookup: (tableName: string, key: string, defaultValue?: string) => string;
			lookup_bool: (tableName: string, key: string, defaultValue?: boolean) => boolean;
			lookup_integer: (tableName: string, key: string, defaultValue?: number) => number;
			lookup_float: (tableName: string, key: string, defaultValue?: number) => number;
			lookup_regex: (tableName: string, key: string, defaultValue?: string) => RegExp;
			contains: (tableName: string, key: string) => boolean;
		};
		// Rate limit functions - flexible type to allow different implementations
		ratelimit?: Record<string, any>;
		// Allow additional properties
		[key: string]: any;
	};
	// Math module with flexible indexing
	math?: Record<string, any> & {
		sin?: (x: number) => number;
		cos?: (x: number) => number;
		tan?: (x: number) => number;
		asin?: (x: number) => number;
		acos?: (x: number) => number;
		atan?: (x: number) => number;
		atan2?: (y: number, x: number) => number;
		sinh?: (x: number) => number;
		cosh?: (x: number) => number;
		tanh?: (x: number) => number;
		asinh?: (x: number) => number;
		acosh?: (x: number) => number;
		atanh?: (x: number) => number;
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
	};
	// Table module with flexible indexing
	table?: Record<string, any> & {
		lookup?: (tables: any, tableName: string, key: string, defaultValue?: string) => string | null;
		lookup_bool: (tables: any, tableName: string, key: string, defaultValue?: boolean) => boolean;
		lookup_integer: (tables: any, tableName: string, key: string, defaultValue?: number) => number;
		lookup_float: (tables: any, tableName: string, key: string, defaultValue?: number) => number;
		lookup_ip: (tables: any, tableName: string, key: string, defaultValue?: string) => string;
		lookup_rtime: (tables: any, tableName: string, key: string, defaultValue?: number) => number;
		lookup_acl: (tables: any, tableName: string, key: string) => string | null;
		lookup_backend: (tables: any, tableName: string, key: string) => string | null;
		lookup_regex: (tables: any, tableName: string, key: string) => RegExp | null;
		contains: (tables: any, tableName: string, key: string) => boolean;
	};
	time?: {
		now: () => Date;
		add: (time: any, duration?: any) => any;
		sub: (time: any, duration?: any) => any;
		is_after: (time1: any, time2?: any) => boolean;
		hex_to_time: (divisor: any, hex?: any) => any;
		units: (unit: any, time?: any) => any;
		runits: (unit: any, rtime?: any) => any;
		interval_elapsed_ratio: (start: Date, interval: number) => number;
	};
	header?: {
		get: (headers: any, name: string) => string;
		set: (headers: any, name: string, value: string) => void;
		unset: (headers: any, name: string) => void;
		filter: (headers: any, filterNames: string[]) => any;
		filter_except: (headers: any, keepNames: string[]) => any;
	};
	strftime?: (format: string, time: Date) => string;
	parse_time_delta?: (delta: string) => number;
	rateLimitModule?: any;
	// Testing helper for tracking results
	results?: Record<string, any>;
	// Rate limiting state
	ratelimit?: {
		counters: Record<string, any>;
		penaltyboxes: Record<string, any>;
	};
}

export interface VCLSubroutines {
	vcl_recv?: (context: VCLContext) => string;
	vcl_hash?: (context: VCLContext) => string;
	vcl_hit?: (context: VCLContext) => string;
	vcl_miss?: (context: VCLContext) => string;
	vcl_pass?: (context: VCLContext) => string;
	vcl_fetch?: (context: VCLContext) => string;
	vcl_deliver?: (context: VCLContext) => string;
	vcl_error?: (context: VCLContext) => string;
	vcl_pipe?: (context: VCLContext) => string;
	vcl_init?: (context: VCLContext) => string;
	vcl_synth?: (context: VCLContext) => string;
	vcl_log?: (context: VCLContext) => void;
	// Index signature for dynamic access
	// biome-ignore lint/suspicious/noConfusingVoidType: vcl_log returns void
	[key: string]: ((context: VCLContext) => string | void) | undefined;
}
export const VCLStdLib = {
	log: (message: string) => logInfo(`[VCL] ${message}`),
	time: {
		parse: (timeStr: string): number => Date.parse(timeStr),
		format: (time: number, _format: string): string => new Date(time).toISOString(),
	},
	string: {
		tolower: (str: string): string => str.toLowerCase(),
		toupper: (str: string): string => str.toUpperCase(),
		match: (str: string, pattern: string): boolean => {
			try {
				return new RegExp(pattern).test(str);
			} catch {
				logError(`Invalid regex pattern: ${pattern}`);
				return false;
			}
		},
	},
};

function seededRandom(seed: number): number {
	return Math.abs(Math.sin(seed * 9301 + 49297) % 1);
}

/**
 * How a null (failed) result maps to a value and fastly.error, per real
 * Fastly behavior: parse failures return a usable value and set fastly.error
 * rather than aborting.
 */
const NULL_RESULT_RULES: Record<string, { value: any; error: string }> = {
	"std.atoi": { value: 0, error: "EPARSENUM" },
	"std.atof": { value: Number.NaN, error: "EPARSENUM" },
	"std.strtol": { value: 0, error: "EPARSENUM" },
	"std.strtof": { value: Number.NaN, error: "EPARSENUM" },
	"std.itoa": { value: null, error: "EINVAL" },
	"time.units": { value: null, error: "EINVAL" },
	"time.runits": { value: null, error: "EINVAL" },
	"bin.base64_to_hex": { value: null, error: "EINVAL" },
	"bin.hex_to_base64": { value: null, error: "EINVAL" },
};

/**
 * Coerce a builtin function result to its declared VCL return type, so
 * that stringification and arithmetic behave per Fastly semantics regardless
 * of what the underlying JS implementation returned.
 */
const BROWSER_DEFAULTS: Record<string, string> = { name: "BrowserUnknown", version: "0.0.0" };
const OS_DEFAULTS: Record<string, string> = { name: "OSUnknown", version: "0.0.0" };

/** Statements restricted to specific built-in subroutine scopes. */
const STATEMENT_SCOPES: Record<string, { label: string; allowed: string[] }> = {
	ErrorStatement: { label: "error", allowed: ["RECV", "HIT", "MISS", "PASS", "FETCH"] },
	SyntheticStatement: { label: "synthetic", allowed: ["ERROR"] },
	SyntheticBase64Statement: { label: "synthetic.base64", allowed: ["ERROR"] },
	EsiStatement: { label: "esi", allowed: ["FETCH"] },
	RestartStatement: { label: "restart", allowed: ["RECV", "HIT", "FETCH", "ERROR", "DELIVER"] },
};

/** Initial value of a `declare local` variable, per declared type. */
const LOCAL_TYPE_DEFAULTS: Record<string, () => any> = {
	STRING: () => VCLString.notset(),
	INTEGER: () => 0,
	INT: () => 0,
	FLOAT: () => new VCLFloat(0),
	BOOL: () => false,
	BOOLEAN: () => false,
	TIME: () => new VCLTime(0),
	RTIME: () => new VCLRTime(0),
	IP: () => VCLString.notset(),
};

/**
 * Convert a raw runtime value to the given VCL type so stringification and
 * arithmetic behave per Fastly semantics (FLOAT with three decimals, RTIME as
 * seconds, TIME as IMF-fixdate, BOOL as 1/0). Values that already carry the
 * right type, and values that cannot be converted, pass through unchanged.
 */
function coerceToVclType(vclType: string | null | undefined, value: any): any {
	switch (vclType) {
		case "FLOAT":
			if (value instanceof VCLFloat) return value;
			if (typeof value === "number") return new VCLFloat(value);
			return new VCLFloat(Number(value));
		case "INTEGER":
		case "INT": {
			if (typeof value === "bigint") return value;
			if (value instanceof VCLFloat) return Math.trunc(value.value);
			if (typeof value === "number") return Math.trunc(value);
			const n = Number(value);
			return Number.isNaN(n) ? value : Math.trunc(n);
		}
		case "BOOL":
			if (typeof value === "boolean") return value;
			if (value === "true" || value === 1) return true;
			if (value === "false" || value === 0) return false;
			return Boolean(value);
		case "TIME":
			if (value instanceof VCLTime) return value;
			if (value instanceof Date) return new VCLTime(value.getTime());
			if (typeof value === "number") return new VCLTime(value);
			return value;
		case "RTIME":
			if (value instanceof VCLRTime) return value;
			if (typeof value === "number") return new VCLRTime(value);
			if (typeof value === "string") return new VCLRTime(parseTimeValue(value));
			return value;
		default:
			return value;
	}
}

function coerceBuiltinReturn(functionName: string, result: any): any {
	const sig = BUILTIN_SIGNATURES[functionName];
	if (!sig || result === null || result === undefined) return result;
	if (result instanceof VCLString) return result;
	return coerceToVclType(sig.ret, result);
}

/**
 * Coerce a predefined-variable read to its declared VCL type so that
 * stringification behaves per Fastly semantics.
 */
function coerceVariableRead(name: string, result: any): any {
	const sig = VARIABLE_TYPES[name];
	if (!sig || result === null || result === undefined) return result;
	if (result instanceof VCLString || result instanceof VCLConcatResult) return result;
	return coerceToVclType(sig.get, result);
}

/** True for values that carry a VCL numeric/temporal type. */
function isNumericValue(v: any): boolean {
	return (
		typeof v === "number" || v instanceof VCLFloat || v instanceof VCLRTime || v instanceof Date
	);
}

/**
 * Type-aware arithmetic following Fastly VCL rules:
 * - "+" on strings concatenates (with NOTSET tracking)
 * - FLOAT propagates: any FLOAT operand makes the result FLOAT
 * - TIME +/- RTIME -> TIME; TIME - TIME -> RTIME
 * - RTIME arithmetic keeps RTIME; RTIME * / INTEGER|FLOAT keeps RTIME
 */
/** True for string-carrying values (concat semantics for "+"). */
function isStringy(v: any): boolean {
	return typeof v === "string" || v instanceof VCLString || v instanceof VCLConcatResult;
}

/** BOOL truthiness: a set string (even empty) is true, notset is false. */
function toBool(v: any): boolean {
	return v instanceof VCLString ? !v.isNotSet : Boolean(v);
}

/** 64-bit two's-complement integer view of a value. */
function toInt64(v: any): bigint {
	if (typeof v === "bigint") return BigInt.asIntN(64, v);
	const n = Math.trunc(Number(v ?? 0)) || 0;
	return BigInt.asIntN(64, BigInt(n));
}

/** Keep exact 64-bit results: plain number when safe, BigInt beyond 2^53. */
function fromInt64(v: bigint): number | bigint {
	const signed = BigInt.asIntN(64, v);
	return signed >= BigInt(Number.MIN_SAFE_INTEGER) && signed <= BigInt(Number.MAX_SAFE_INTEGER)
		? Number(signed)
		: signed;
}

function applyArithmetic(op: string, left: any, right: any): any {
	if (op === "+" && (isStringy(left) || isStringy(right))) {
		const leftPart = left instanceof VCLConcatResult ? left.parts : [toConcatPart(left)];
		const rightPart = right instanceof VCLConcatResult ? right.parts : [toConcatPart(right)];
		return new VCLConcatResult([...leftPart, ...rightPart]);
	}

	const leftIsTime = left instanceof Date;
	const rightIsTime = right instanceof Date;
	if (leftIsTime && rightIsTime && op === "-") {
		return new VCLRTime((left.getTime() - right.getTime()) / 1000);
	}
	if (leftIsTime && !rightIsTime && (op === "+" || op === "-")) {
		const deltaMs = Number(right) * 1000;
		return new VCLTime(left.getTime() + (op === "+" ? deltaMs : -deltaMs));
	}
	if (rightIsTime && !leftIsTime && op === "+") {
		return new VCLTime(right.getTime() + Number(left) * 1000);
	}

	const l = Number(left);
	const r = Number(right);
	let result: number;
	switch (op) {
		case "+":
			result = l + r;
			break;
		case "-":
			result = l - r;
			break;
		case "*":
			result = l * r;
			break;
		case "/":
			result = l / r;
			break;
		case "%":
			result = l % r;
			break;
		default:
			result = Number.NaN;
	}

	if (left instanceof VCLRTime || right instanceof VCLRTime) {
		return new VCLRTime(result);
	}
	if (left instanceof VCLFloat || right instanceof VCLFloat) {
		return new VCLFloat(result);
	}
	// INTEGER op INTEGER stays INTEGER (division truncates toward zero).
	if (op === "/" && Number.isFinite(result)) {
		return Math.trunc(result);
	}
	return result;
}

/**
 * fastly.hash(key, seed, from, to). The production algorithm is not public;
 * this derives a deterministic integer from sha256(key) plus a varint-encoded
 * seed, drawing uniformly below (from + to) and subtracting from — mirroring
 * the reference emulator so results are reproducible across tools.
 */
function fastlyHash(key: string, seed: number, from: number, to: number): number | null {
	const max = BigInt(Math.trunc(from)) + BigInt(Math.trunc(to));
	if (max <= 0n) {
		logError("fastly.hash: from + to must be positive");
		return null;
	}
	const digest = Buffer.from(hashHex("sha256", Buffer.from(key)), "hex");

	// Go binary.PutVarint (zigzag + base-128) of the seed.
	let ux = BigInt(Math.trunc(seed)) << 1n;
	if (seed < 0) ux = ~ux;
	const varint: number[] = [];
	while (ux >= 0x80n) {
		varint.push(Number(ux & 0x7fn) | 0x80);
		ux >>= 7n;
	}
	varint.push(Number(ux));
	const stream = Buffer.concat([digest, Buffer.from(varint)]);

	// Go crypto/rand.Int over the deterministic stream.
	const bitLen = max.toString(2).length;
	const k = Math.ceil(bitLen / 8);
	let b = BigInt(bitLen % 8);
	if (b === 0n) b = 8n;
	let offset = 0;
	while (offset + k <= stream.length) {
		const chunk = Buffer.from(stream.subarray(offset, offset + k));
		offset += k;
		chunk[0]! &= (1 << Number(b)) - 1;
		let n = 0n;
		for (const byte of chunk) n = (n << 8n) | BigInt(byte);
		if (n < max) return Number(n - BigInt(Math.trunc(from)));
	}
	logError("fastly.hash: failed to derive value in range");
	return null;
}

/** Largest representable RTIME (2^63 - 1 nanoseconds), in seconds. */
const MAX_RTIME_SECONDS = 9223372036.854776;

/** Render a header map as "Name: value" lines. */
function serializeHeaders(headers: Record<string, string> | undefined): string {
	if (!headers) return "";
	return Object.entries(headers)
		.map(([k, v]) => `${k}: ${v}`)
		.join("\n");
}

/**
 * Fingerprints of the synthetic client TLS handshake (an OpenSSL-style
 * client hello), so a local run reads like a realistic Fastly request.
 */
const SYNTHETIC_TLS_CLIENT = {
	ciphersList:
		"130213031301C02FC02BC030C02C009EC0270067C028006B00A3009FCCA9CCA8CCAAC0AFC0ADC0A3C09FC05DC061C057C05300A2C0AEC0ACC0A2C09EC05CC060C056C052C024006AC0230040C00AC01400390038C009C01300330032009DC0A1C09DC051009CC0A0C09CC050003D003C0035002F00FF",
	ciphersListSha: "JZtiTn8H/ntxORk+XXvU2EvNoz8=",
	ciphersListTxt:
		"TLS_AES_256_GCM_SHA384:TLS_CHACHA20_POLY1305_SHA256:TLS_AES_128_GCM_SHA256:" +
		"TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256:TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256:" +
		"TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384:TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384:" +
		"TLS_DHE_RSA_WITH_AES_128_GCM_SHA256:TLS_ECDHE_RSA_WITH_AES_128_CBC_SHA256:" +
		"TLS_DHE_RSA_WITH_AES_128_CBC_SHA256:TLS_ECDHE_RSA_WITH_AES_256_CBC_SHA384:" +
		"TLS_DHE_RSA_WITH_AES_256_CBC_SHA256:TLS_DHE_DSS_WITH_AES_256_GCM_SHA384:" +
		"TLS_DHE_RSA_WITH_AES_256_GCM_SHA384:TLS_ECDHE_ECDSA_WITH_CHACHA20_POLY1305_SHA256:" +
		"TLS_ECDHE_RSA_WITH_CHACHA20_POLY1305_SHA256:TLS_DHE_RSA_WITH_CHACHA20_POLY1305_SHA256:" +
		"TLS_ECDHE_ECDSA_WITH_AES_256_CCM_8:TLS_ECDHE_ECDSA_WITH_AES_256_CCM:" +
		"TLS_DHE_RSA_WITH_AES_256_CCM_8:TLS_DHE_RSA_WITH_AES_256_CCM:" +
		"TLS_ECDHE_ECDSA_WITH_ARIA_256_GCM_SHA384:TLS_ECDHE_RSA_WITH_ARIA_256_GCM_SHA384:" +
		"TLS_DHE_DSS_WITH_ARIA_256_GCM_SHA384:TLS_DHE_RSA_WITH_ARIA_256_GCM_SHA384:" +
		"TLS_DHE_DSS_WITH_AES_128_GCM_SHA256:TLS_ECDHE_ECDSA_WITH_AES_128_CCM_8:" +
		"TLS_ECDHE_ECDSA_WITH_AES_128_CCM:TLS_DHE_RSA_WITH_AES_128_CCM_8:" +
		"TLS_DHE_RSA_WITH_AES_128_CCM:TLS_ECDHE_ECDSA_WITH_ARIA_128_GCM_SHA256:" +
		"TLS_ECDHE_RSA_WITH_ARIA_128_GCM_SHA256:TLS_DHE_DSS_WITH_ARIA_128_GCM_SHA256:" +
		"TLS_DHE_RSA_WITH_ARIA_128_GCM_SHA256:TLS_ECDHE_ECDSA_WITH_AES_256_CBC_SHA384:" +
		"TLS_DHE_DSS_WITH_AES_256_CBC_SHA256:TLS_ECDHE_ECDSA_WITH_AES_128_CBC_SHA256:" +
		"TLS_DHE_DSS_WITH_AES_128_CBC_SHA256:TLS_ECDHE_ECDSA_WITH_AES_256_CBC_SHA:" +
		"TLS_ECDHE_RSA_WITH_AES_256_CBC_SHA:TLS_DHE_RSA_WITH_AES_256_CBC_SHA:" +
		"TLS_DHE_DSS_WITH_AES_256_CBC_SHA:TLS_ECDHE_ECDSA_WITH_AES_128_CBC_SHA:" +
		"TLS_ECDHE_RSA_WITH_AES_128_CBC_SHA:TLS_DHE_RSA_WITH_AES_128_CBC_SHA:" +
		"TLS_DHE_DSS_WITH_AES_128_CBC_SHA:TLS_RSA_WITH_AES_256_GCM_SHA384:" +
		"TLS_RSA_WITH_AES_256_CCM_8:TLS_RSA_WITH_AES_256_CCM:" +
		"TLS_RSA_WITH_ARIA_256_GCM_SHA384:TLS_RSA_WITH_AES_128_GCM_SHA256:" +
		"TLS_RSA_WITH_AES_128_CCM_8:TLS_RSA_WITH_AES_128_CCM:" +
		"TLS_RSA_WITH_ARIA_128_GCM_SHA256:TLS_RSA_WITH_AES_256_CBC_SHA256:" +
		"TLS_RSA_WITH_AES_128_CBC_SHA256:TLS_RSA_WITH_AES_256_CBC_SHA:" +
		"TLS_RSA_WITH_AES_128_CBC_SHA:TLS_EMPTY_RENEGOTIATION_INFO_SCSV",
	ciphersSha: "+7dB1w3Ov9S4Ct3HG3Qed68pSko=",
	ja3Md5: "582a3b42ab84f78a5b376b1e29d6d367",
	ja4: "t13d5911h2_a33745022dd6_1f22a2ca17c4",
};

/**
 * Generate a request id in Fastly's xid format: 12 bytes (4 clock bytes plus
 * 8 random bytes) rendered as 20 base32hex characters.
 */
function generateXid(context: VCLContext): string {
	const bytes = new Uint8Array(12);
	const secs = Math.floor(context.platform.now() / 1000);
	bytes[0] = (secs >>> 24) & 0xff;
	bytes[1] = (secs >>> 16) & 0xff;
	bytes[2] = (secs >>> 8) & 0xff;
	bytes[3] = secs & 0xff;
	for (let i = 4; i < 12; i++) {
		bytes[i] = Math.floor(randomFloat(context.platform) * 256) & 0xff;
	}
	const charset = "0123456789abcdefghijklmnopqrstuv";
	let out = "";
	let buffer = 0;
	let bits = 0;
	for (const b of bytes) {
		buffer = (buffer << 8) | b;
		bits += 8;
		while (bits >= 5) {
			out += charset[(buffer >>> (bits - 5)) & 31];
			bits -= 5;
		}
	}
	if (bits > 0) out += charset[(buffer << (5 - bits)) & 31];
	return out;
}

export class VCLCompiler {
	private program: VCLProgram;
	private currentSubroutine = "";
	/** Nesting depth of functional (typed) subroutine calls being evaluated. */
	private functionalSubDepth = 0;
	/** Typed (functional) subroutines by name, for expression-call dispatch. */
	private functionalSubs: Map<string, VCLSubroutine>;

	/** Header record of the req/bereq/beresp/resp/obj scope, if valid. */
	private httpHeadersOf(
		context: VCLContext,
		scope: string | undefined,
	): Record<string, string> | undefined {
		switch (scope) {
			case "req":
				return context.req?.http;
			case "bereq":
				return context.bereq?.http;
			case "beresp":
				return context.beresp?.http;
			case "resp":
				return context.resp?.http;
			case "obj":
				return context.obj?.http;
			default:
				return undefined;
		}
	}

	constructor(program: VCLProgram) {
		this.program = program;
		this.functionalSubs = new Map(
			program.subroutines.filter((sub) => sub.returnType).map((sub) => [sub.name, sub]),
		);
	}

	compile(): VCLSubroutines {
		const subroutines: VCLSubroutines = {};

		// Reject a program whose inlined call graph would blow Fastly's limit
		// before doing any other work, the same way activation would.
		checkCallTreeLimit(this.program.subroutines);

		// Initialize the context
		const context = createVCLContext();

		// Process ACL declarations
		if (this.program.acls && context.std?.acl) {
			for (const acl of this.program.acls) {
				validateAclEntries(acl.name, acl.entries);
				context.std.acl.add(acl.name);
				for (const entry of acl.entries) {
					context.std.acl.add_entry(acl.name, entry.ip, entry.subnet, entry.negated);
				}
			}
		}

		// Process director declarations
		if (this.program.directors && context.std?.director) {
			for (const dir of this.program.directors) {
				context.std.director.add(dir.name, dir.directorType);
				for (const backend of dir.backends) {
					context.std.director.add_backend(dir.name, backend.name, backend.weight ?? 1);
				}
			}
		}

		// Process penaltybox declarations
		if (this.program.penaltyboxes) {
			for (const pb of this.program.penaltyboxes) {
				if (!context.ratelimit) context.ratelimit = { counters: {}, penaltyboxes: {} };
				context.ratelimit.penaltyboxes[pb.name] = {};
			}
		}

		// Process ratecounter declarations
		if (this.program.ratecounters) {
			for (const rc of this.program.ratecounters) {
				if (!context.ratelimit) context.ratelimit = { counters: {}, penaltyboxes: {} };
				context.ratelimit.counters[rc.name] = { count: 0 };
			}
		}

		// Process table declarations
		if (this.program.tables) {
			for (const table of this.program.tables) {
				const entries: Record<string, string> = {};
				for (const entry of table.entries) {
					entries[entry.key] = entry.value;
				}
				context.tables[table.name] = { name: table.name, valueType: table.valueType, entries };
			}
		}

		// Process backend declarations. The first declared backend becomes the
		// default origin, matching Fastly's behavior when no explicit
		// assignment is made.
		if (this.program.backends) {
			const firstBackend = this.program.backends[0];
			if (firstBackend) context.req.backend = firstBackend.name;
			for (const backend of this.program.backends) {
				const props: Record<string, any> = {};
				for (const prop of backend.properties) {
					props[prop.name] = prop.value;
				}
				let probe: VCLProbe | undefined;
				const probeProp = props.probe;
				if (probeProp && typeof probeProp === "object" && probeProp.type === "probe") {
					const pp: Record<string, any> = {};
					for (const prop of probeProp.properties) pp[prop.name] = prop.value;
					probe = {
						request: String(pp.request ?? ""),
						expected_response: Number(pp.expected_response ?? 200),
						interval: parseTimeValue(String(pp.interval ?? "5s")),
						timeout: parseTimeValue(String(pp.timeout ?? "2s")),
						window: Number(pp.window ?? 5),
						threshold: Number(pp.threshold ?? 3),
						initial: Number(pp.initial ?? 2),
					};
				}
				context.backends[backend.name] = {
					name: backend.name,
					host: String(props.host ?? ""),
					port: Number(props.port ?? 80),
					ssl: props.ssl === "true" || props.ssl === true || String(props.port) === "443",
					connect_timeout: parseTimeValue(String(props.connect_timeout ?? "1s")),
					first_byte_timeout: parseTimeValue(String(props.first_byte_timeout ?? "15s")),
					between_bytes_timeout: parseTimeValue(String(props.between_bytes_timeout ?? "10s")),
					// Zero means unset: the fetch is bounded by first_byte_timeout
					// unless bereq.fetch_timeout overrides it at request time.
					fetch_timeout: props.fetch_timeout ? parseTimeValue(String(props.fetch_timeout)) : 0,
					max_connections: Number(props.max_connections ?? 200),
					is_healthy: true,
					probe,
				} as VCLBackend;
			}
		}

		// Compile each subroutine (both vcl_* and custom subs)
		for (const subroutine of this.program.subroutines) {
			this.validateGotos(subroutine);
			subroutines[subroutine.name] = this.compileSubroutine(subroutine, context);
		}

		return subroutines;
	}

	/**
	 * Goto is forward-only in Fastly VCL: every goto must name a label that
	 * appears after it. A backward or undefined destination is a load error.
	 */
	private validateGotos(subroutine: VCLSubroutine): void {
		// Statements in source order; labels are valid destinations only at the
		// top level of the subroutine, matching the runtime jump table.
		const flat: Array<{ stmt: VCLStatement; topLevel: boolean }> = [];
		const collect = (stmts: VCLStatement[] | undefined, topLevel: boolean) => {
			if (!stmts) return;
			for (const stmt of stmts) {
				if (!stmt) continue;
				flat.push({ stmt, topLevel });
				switch (stmt.type) {
					case "IfStatement": {
						const s = stmt as VCLIfStatement;
						collect(s.consequent, false);
						collect(s.alternate, false);
						break;
					}
					case "SwitchStatement":
						for (const c of (stmt as VCLSwitchStatement).cases) collect(c.body, false);
						break;
					case "BlockStatement":
						collect((stmt as VCLBlockStatement).body, false);
						break;
					default:
						break;
				}
			}
		};
		collect(subroutine.body ?? subroutine.statements, true);

		for (let i = 0; i < flat.length; i++) {
			const stmt = flat[i]!.stmt;
			if (stmt.type !== "GotoStatement") continue;
			const label = (stmt as VCLGotoStatement).label;
			let forward = false;
			let backward = false;
			for (let j = 0; j < flat.length; j++) {
				const other = flat[j]!;
				if (
					other.topLevel &&
					other.stmt.type === "LabelStatement" &&
					(other.stmt as VCLLabelStatement).name === label
				) {
					if (j > i) {
						forward = true;
						break;
					}
					backward = true;
				}
			}
			if (!forward) {
				throw new Error(
					backward
						? `Goto destination ${label} must be defined after the goto (backward jumps are not allowed) in subroutine ${subroutine.name}`
						: `Goto destination ${label} is not defined in subroutine ${subroutine.name}`,
				);
			}
		}
	}

	private compileSubroutine(
		subroutine: VCLSubroutine,
		initialContext?: VCLContext,
	): (context: VCLContext) => string {
		const run = (context: VCLContext): string => {
			// Merge program declarations into the runtime context (once per
			// context; every phase entry reuses the same context object).
			if ((context as any).__declsMergedFrom !== initialContext) {
				(context as any).__declsMergedFrom = initialContext;
				this.mergeDeclarations(context, initialContext);
			}
			try {
				// Execute each statement in the subroutine
				// Handle both body and statements properties for backward compatibility
				let statements: VCLStatement[] = [];

				if (subroutine.body && Array.isArray(subroutine.body)) {
					statements = subroutine.body;
				} else if (subroutine.statements && Array.isArray(subroutine.statements)) {
					statements = subroutine.statements;

					// Copy the statements to the body property for compatibility
					subroutine.body = [...subroutine.statements];
				}

				// Map label names to their positions for goto statements. Labels are
				// pure position markers; goto jumps forward to them.
				const labelMap = new Map<string, number>();
				for (let idx = 0; idx < statements.length; idx++) {
					const stmt = statements[idx];
					if (stmt && stmt.type === "LabelStatement") {
						labelMap.set((stmt as VCLLabelStatement).name, idx);
					}
				}

				// Execute statements sequentially, handling goto statements
				let i = 0;
				while (i < statements.length) {
					const statement = statements[i];
					if (!statement) {
						i++;
						continue;
					}

					// Make sure the statement has a test property if it's an IfStatement
					if (statement.type === "IfStatement") {
						const ifStmt = statement as VCLIfStatement;
						if (!ifStmt.test && ifStmt.condition) {
							ifStmt.test = ifStmt.condition;
						}
					}

					const result = this.executeStatement(statement, context);

					// A goto (possibly propagated out of a nested block) jumps to its
					// label without executing the skipped statements.
					if (result && typeof result === "string" && result.startsWith("__goto__:")) {
						const labelName = result.substring("__goto__:".length);
						const labelIndex = labelMap.get(labelName);
						if (labelIndex === undefined) {
							throw new Error(`Goto destination ${labelName} is not defined`);
						}
						i = labelIndex + 1;
						continue;
					}

					// Handle return statements
					if (result && typeof result === "string") {
						return result;
					}

					// Move to the next statement
					i++;
				}

				const defaultReturns: Record<string, string> = {
					vcl_recv: "lookup",
					vcl_hash: "hash",
					vcl_hit: "deliver",
					vcl_miss: "fetch",
					vcl_pass: "fetch",
					vcl_fetch: "deliver",
					vcl_deliver: "deliver",
					vcl_error: "deliver",
					vcl_pipe: "pipe",
					vcl_init: "ok",
					vcl_synth: "deliver",
				};
				return defaultReturns[subroutine.name] || "";
			} catch (error) {
				if (error instanceof UnsupportedFeatureError) throw error;
				if (error instanceof VCLLimitExceededError) throw error;
				logError(`Error executing subroutine ${subroutine.name}:`, error);
				const errorReturns: Record<string, string> = {
					vcl_recv: "error",
					vcl_hash: "error",
					vcl_hit: "error",
					vcl_miss: "error",
					vcl_pass: "error",
					vcl_fetch: "error",
					vcl_deliver: "deliver",
					vcl_error: "deliver",
					vcl_pipe: "pipe",
					vcl_init: "ok",
					vcl_synth: "deliver",
				};
				return errorReturns[subroutine.name] || "";
			}
		};

		return (context: VCLContext): string => {
			const sub = subroutine.name;
			const previousSub = this.currentSubroutine;
			this.currentSubroutine = sub;
			context.platform?.onTrace?.({ phase: sub, subroutine: sub });
			try {
				const action = run(context);
				context.platform?.onTrace?.({ phase: sub, subroutine: sub, returnAction: action });
				return action;
			} finally {
				this.currentSubroutine = previousSub;
			}
		};
	}

	/**
	 * Statement scope guard: some statements are only legal while executing a
	 * specific built-in subroutine (dynamically — custom subs inherit their
	 * caller's scope). Throws a runtime error like Fastly does.
	 */
	private requireScope(statementName: string, context: VCLContext, allowed: string[]): void {
		if (!this.currentSubroutine.startsWith("vcl_")) return;
		const scope = this.currentSubroutine.slice(4).toUpperCase();
		if (allowed.includes(scope)) return;
		const message = `${statementName} statement is only available in ${allowed.join(", ")} scope`;
		if (context.fastly) context.fastly.error = message;
		logError(message);
		throw new Error(message);
	}

	/** Merge the compile-time declaration context into a runtime context. */
	private mergeDeclarations(context: VCLContext, initialContext?: VCLContext): void {
		if (initialContext?.acls) {
			context.acls = { ...initialContext.acls, ...context.acls };
		}
		if (initialContext?.tables) {
			context.tables = { ...initialContext.tables, ...context.tables };
		}
		if (initialContext?.backends) {
			// A VCL-declared backend takes precedence over the built-in
			// placeholder of the same name (notably one named "default").
			const runtimeBackends = { ...context.backends };
			for (const [beName, be] of Object.entries(runtimeBackends)) {
				if (be.builtin && initialContext.backends[beName]) delete runtimeBackends[beName];
			}
			context.backends = { ...initialContext.backends, ...runtimeBackends };
			// Adopt the program's default backend unless the caller picked one.
			if (initialContext.req.backend !== "default" && context.req.backend === "default") {
				context.req.backend = initialContext.req.backend;
			}
		}
		if (initialContext?.directors) {
			context.directors = { ...initialContext.directors, ...context.directors };
		}
		if (initialContext?.ratelimit) {
			if (!context.ratelimit) context.ratelimit = { counters: {}, penaltyboxes: {} };
			context.ratelimit.counters = {
				...initialContext.ratelimit.counters,
				...context.ratelimit.counters,
			};
			context.ratelimit.penaltyboxes = {
				...initialContext.ratelimit.penaltyboxes,
				...context.ratelimit.penaltyboxes,
			};
		}
	}

	private executeStatement(statement: VCLStatement, context: VCLContext): string | undefined {
		const scopes = STATEMENT_SCOPES[statement.type];
		if (scopes) this.requireScope(scopes.label, context, scopes.allowed);
		if (context.platform?.onTrace && statement.location) {
			context.platform.onTrace({
				phase: this.currentSubroutine,
				subroutine: this.currentSubroutine,
				statement: { line: statement.location.line, column: statement.location.column },
			});
		}
		switch (statement.type) {
			case "IfStatement":
				return this.executeIfStatement(statement as VCLIfStatement, context);
			case "ReturnStatement":
				return this.executeReturnStatement(statement as VCLReturnStatement, context);
			case "ErrorStatement":
				return this.executeErrorStatement(statement as VCLErrorStatement, context);
			case "SetStatement":
				this.executeSetStatement(statement as VCLSetStatement, context);
				return undefined;
			case "UnsetStatement":
				this.executeUnsetStatement(statement as VCLUnsetStatement, context);
				return undefined;
			case "AddStatement":
				this.executeAddStatement(statement as VCLAddStatement, context);
				return undefined;
			case "RemoveStatement":
				this.executeUnsetStatement(statement as unknown as VCLUnsetStatement, context);
				return undefined;
			case "CallStatement":
				return this.executeCallStatement(statement as VCLCallStatement, context);
			case "LogStatement":
				this.executeLogStatement(statement as VCLLogStatement, context);
				return undefined;
			case "SyntheticStatement":
				this.executeSyntheticStatement(statement as VCLSyntheticStatement, context);
				return undefined;
			case "SyntheticBase64Statement":
				this.executeSyntheticBase64Statement(statement as VCLSyntheticBase64Statement, context);
				return undefined;
			case "EsiStatement":
				this.executeEsiStatement(context);
				return undefined;
			case "SwitchStatement":
				return this.executeSwitchStatement(statement as VCLSwitchStatement, context);
			case "HashDataStatement":
				this.executeHashDataStatement(statement as VCLHashDataStatement, context);
				return undefined;
			case "GotoStatement":
				return this.executeGotoStatement(statement as VCLGotoStatement, context);
			case "RestartStatement":
				return this.executeRestartStatement(statement as VCLRestartStatement, context);
			case "LabelStatement":
				// Pure position marker for goto.
				return undefined;
			case "BlockStatement": {
				for (const stmt of (statement as VCLBlockStatement).body) {
					const result = this.executeStatement(stmt, context);
					if (result && typeof result === "string") return result;
				}
				return undefined;
			}
			case "DeclareStatement":
				this.executeDeclareStatement(statement as VCLDeclareStatement, context);
				return undefined;
			case "ExpressionStatement":
				this.evaluateExpression((statement as VCLExpressionStatement).expression, context);
				return undefined;
			default:
				return;
		}
	}

	/** Coerce a value assigned to a local to its declared VCL type. */
	private coerceLocalValue(declaredType: string | undefined, value: any): any {
		// Strings assigned to STRING locals (the default) pass through; typed
		// locals share the canonical converter.
		if (!declaredType || declaredType === "STRING" || declaredType === "BOOL") return value;
		return coerceToVclType(declaredType, value);
	}

	private executeDeclareStatement(statement: VCLDeclareStatement, context: VCLContext): void {
		if (!context.locals) context.locals = {};
		// Strip "var." prefix to match how evaluateIdentifier and executeSetStatement resolve var.* names
		const varName = statement.variableName.startsWith("var.")
			? statement.variableName.substring(4)
			: statement.variableName;
		const declaredType = statement.variableType.toUpperCase();
		if (!context.localTypes) context.localTypes = {};
		context.localTypes[varName] = declaredType;
		if (statement.initialValue) {
			context.locals[varName] = this.coerceLocalValue(
				declaredType,
				this.evaluateExpression(statement.initialValue, context),
			);
		} else {
			context.locals[varName] = LOCAL_TYPE_DEFAULTS[declaredType]?.() ?? "";
		}
	}

	private executeIfStatement(statement: VCLIfStatement, context: VCLContext): string | undefined {
		// Make sure the statement has a test property
		if (!statement.test && statement.condition) {
			statement.test = statement.condition;
		}

		const conditionRaw = this.evaluateExpression(statement.test, context);
		const stmts = this.isTruthyCondition(conditionRaw) ? statement.consequent : statement.alternate;
		if (stmts) {
			for (const stmt of stmts) {
				const result = this.executeStatement(stmt, context);
				if (result && typeof result === "string") return result;
			}
		}
	}

	private executeReturnStatement(statement: VCLReturnStatement, context: VCLContext): string {
		// Inside a functional (typed) subroutine, `return <expr>;` produces the
		// subroutine's value rather than a state-machine action.
		if (this.functionalSubDepth > 0 && statement.value) {
			if (!context.locals) context.locals = {};
			context.locals.__return_value__ = this.evaluateExpression(statement.value, context);
			return "__typed_return__";
		}
		return statement.argument;
	}

	private executeErrorStatement(statement: VCLErrorStatement, context: VCLContext): string {
		context.obj = context.obj || {};
		context.obj.http = context.obj.http || {};

		// The status can be any INTEGER expression; a bare `error;` re-raises
		// with the current obj.status. The response is any STRING expression.
		if (statement.status !== undefined) {
			context.obj.status = Math.trunc(
				Number(this.evaluateExpression(statement.status, context)) || 0,
			);
		}
		if (statement.message !== undefined) {
			context.obj.response = this.stringifyForOutput(
				this.evaluateExpression(statement.message, context),
			);
		}
		const status = context.obj.status;
		const message = context.obj.response ?? "";

		if (typeof context.error === "function") {
			context.error(status, message);
		}

		const errorSubroutine = this.program.subroutines.find((s) => s.name === "vcl_error");
		if (errorSubroutine) {
			for (const stmt of errorSubroutine.body) {
				this.executeStatement(stmt, context);
			}
		}

		if (context.std && typeof context.std.error === "function") {
			try {
				context.std.error(status, message);
			} catch {}
		}

		return "error";
	}

	// resolveForCompound flattens a freshly evaluated value into the primitive a
	// compound operator can combine. A multi-part concatenation is resolved with
	// the same header/local rules a plain assignment would use; NOTSET tracking
	// is preserved so "+=" can render a notset right-hand side as "(null)".
	private resolveForCompound(value: any, isHeaderTarget: boolean): any {
		if (value instanceof VCLConcatResult) {
			return isHeaderTarget ? value.forHeader() : value.forLocal();
		}
		return value;
	}

	private applyCompoundOperator(operator: string, currentValue: any, newValue: any): any {
		switch (operator) {
			case "=":
				return newValue;
			case "+=":
			case "-=":
			case "*=":
			case "/=":
			case "%=": {
				const op = operator[0]!;
				if (op === "+" && (isStringy(currentValue) || isStringy(newValue))) {
					// String append: an unset current value contributes nothing,
					// a notset right-hand side appends its "(null)" display form.
					const curStr =
						currentValue === undefined || currentValue === null || isNotSet(currentValue)
							? ""
							: currentValue instanceof VCLString
								? currentValue.value
								: vclToString(currentValue);
					return curStr + toDisplayString(newValue);
				}
				if ((op === "/" || op === "%") && Number(newValue) === 0) {
					throw new Error(op === "/" ? "Division by zero" : "Modulo by zero");
				}
				const cur =
					currentValue === undefined || currentValue === null || isNotSet(currentValue)
						? 0
						: currentValue;
				return applyArithmetic(op, cur, newValue);
			}
			case "&&=":
				return toBool(currentValue) && toBool(newValue);
			case "||=":
				return toBool(currentValue) || toBool(newValue);
			case "&=":
				return fromInt64(toInt64(currentValue) & toInt64(newValue));
			case "|=":
				return fromInt64(toInt64(currentValue) | toInt64(newValue));
			case "^=":
				return fromInt64(toInt64(currentValue) ^ toInt64(newValue));
			case "<<=": {
				// Shifting a 64-bit integer by 64 or more bits always yields 0.
				const b = toInt64(newValue);
				if (b < 0n) throw new Error("Negative shift amount");
				if (b >= 64n) return 0;
				return fromInt64(toInt64(currentValue) << b);
			}
			case ">>=": {
				// Arithmetic shift; counts past 63 saturate to the sign bit.
				const b = toInt64(newValue);
				if (b < 0n) throw new Error("Negative shift amount");
				return fromInt64(toInt64(currentValue) >> (b >= 64n ? 63n : b));
			}
			case "rol=": {
				const c = BigInt.asUintN(64, toInt64(currentValue));
				const b = BigInt.asUintN(64, toInt64(newValue)) & 63n;
				return fromInt64(BigInt.asUintN(64, (c << b) | (c >> (64n - b))));
			}
			case "ror=": {
				const c = BigInt.asUintN(64, toInt64(currentValue));
				const b = BigInt.asUintN(64, toInt64(newValue)) & 63n;
				return fromInt64(BigInt.asUintN(64, (c >> b) | (c << (64n - b))));
			}
			default:
				return newValue;
		}
	}

	private getTargetValue(target: string, context: VCLContext): any {
		const parts = target.split(".");
		const part0 = parts[0] ?? "";
		const part1 = parts[1] ?? "";

		// Local variables keep their typed values so compound operators can
		// apply INTEGER/FLOAT/TIME/RTIME arithmetic rules.
		if (part0 === "var" && parts.length >= 2) {
			return context.locals?.[parts.slice(1).join(".")];
		}

		if (parts.length >= 3 && part1 === "http") {
			const headerName = parts.slice(2).join(".");
			const [baseHeader, subfieldKey] = this.parseSubfield(headerName);
			if (subfieldKey !== null) {
				const headerValue = this.httpHeadersOf(context, part0)?.[baseHeader] ?? "";
				return this.dictGet(firstHeaderFragment(String(headerValue)), subfieldKey) ?? "";
			}
			const raw = this.httpHeadersOf(context, part0)?.[headerName];
			return raw === undefined ? undefined : firstHeaderFragment(raw);
		}

		if (part0 === "beresp") {
			const props: Record<string, any> = {
				ttl: context.beresp.ttl,
				grace: context.beresp.grace,
				stale_while_revalidate: context.beresp.stale_while_revalidate,
			};
			return props[part1];
		}
		if (part0 === "req") {
			const props: Record<string, any> = {
				backend: context.req.backend,
				restarts: context.req.restarts,
			};
			return props[part1];
		}

		return undefined;
	}

	private executeSetStatement(statement: VCLSetStatement, context: VCLContext): void {
		const operator = statement.operator || "=";

		// Parse the target path (e.g., req.http.X-Header)
		const parts = statement.target.split(".");
		const part0 = parts[0] ?? "";
		const part1 = parts[1] ?? "";
		const isHeaderTarget = parts.length >= 3 && part1 === "http";
		const isVarTarget = parts.length >= 2 && part0 === "var";

		// Special handling for req.backend assignments from a bare identifier
		let newValue: any;
		if (
			parts.length === 2 &&
			part0 === "req" &&
			part1 === "backend" &&
			statement.value &&
			statement.value.type === "Identifier"
		) {
			const identName = (statement.value as VCLIdentifier).name;
			if (context.backends?.[identName] || context.directors?.[identName]) {
				// The identifier names a declared backend/director directly.
				newValue = identName;
			} else {
				// Otherwise evaluate it: a BACKEND-typed local dereferences to the
				// backend it holds. Unknown names stay literal for compatibility
				// with backends registered later.
				const resolved = this.evaluateExpression(statement.value, context);
				if (resolved && typeof resolved === "object" && (resolved as any).name) {
					newValue = (resolved as any).name;
				} else if (resolved instanceof VCLString && !resolved.isNotSet && resolved.value) {
					newValue = resolved.value;
				} else if (typeof resolved === "string" && resolved) {
					newValue = resolved;
				} else {
					newValue = identName;
				}
			}
		} else {
			newValue = this.evaluateExpression(statement.value, context);
		}

		// For compound operators, get current value and compute result. The
		// right-hand side is resolved to a plain value first, the same way a plain
		// assignment to this target would resolve it, so `set req.http.X += "a" "b"`
		// appends "ab" rather than the string form of an unresolved concat object.
		let value: any;
		if (operator !== "=") {
			const currentValue = this.getTargetValue(statement.target, context);
			const rhs = this.resolveForCompound(newValue, isHeaderTarget);
			value = this.applyCompoundOperator(operator, currentValue, rhs);
		} else {
			value = newValue;
		}

		// For targets other than headers and local vars, resolve NOTSET/concat to plain strings
		if (!isHeaderTarget && !isVarTarget) {
			if (value instanceof VCLConcatResult) {
				value = value.forLocal();
			}
			if (value instanceof VCLString) {
				value = value.value;
			}
		}

		if (parts.length >= 3 && part1 === "http") {
			const headerName = parts.slice(2).join(".");
			if (this.httpHeadersOf(context, part0)) {
				let resolved = value;
				if (resolved instanceof VCLConcatResult) {
					resolved = resolved.forHeader();
				}

				const [baseHeader, subfieldKey] = this.parseSubfield(headerName);
				if (subfieldKey !== null) {
					const strVal = isNotSet(resolved)
						? ""
						: resolved instanceof VCLString
							? resolved.value
							: vclToString(resolved);
					const currentVal = this.httpHeadersOf(context, part0)![baseHeader] ?? "";
					const assembled = this.dictSet(currentVal, subfieldKey, strVal);
					this.httpHeadersOf(context, part0)![baseHeader] = assembled;
					this.chargeRequestWorkspace(context, part0, baseHeader, assembled);
				} else if (isNotSet(resolved) || resolved === null || resolved === undefined) {
					delete this.httpHeadersOf(context, part0)![headerName];
				} else {
					const stored = resolved instanceof VCLString ? resolved.value : vclToString(resolved);
					this.httpHeadersOf(context, part0)![headerName] = stored;
					this.chargeRequestWorkspace(context, part0, headerName, stored);
				}
			}
		} else if (parts.length === 2 && part0 === "req" && part1 === "backend") {
			// A backend/director object dereferences to its name.
			context.req.backend =
				value && typeof value === "object" && (value as any).name
					? String((value as any).name)
					: String(value);

			// Also update current_backend if the backend exists
			if (context.backends?.[context.req.backend]) {
				context.current_backend = context.backends[context.req.backend];
			}

			// Also set the X-Backend header for testing
			if (!context.req.http) {
				context.req.http = {};
			}
			context.req.http["X-Backend"] = context.req.backend;

			// Store the backend in the results for testing
			if (!context.results) {
				context.results = {};
			}

			// Store the backend based on the URL pattern
			if (context.req.url?.startsWith("/api/")) {
				context.results.apiBackend = context.req.backend;
			} else if (context.req.url && /\.(jpg|jpeg|png|gif|css|js)$/.test(context.req.url)) {
				context.results.staticBackend = context.req.backend;
			} else {
				context.results.defaultBackend = context.req.backend;
			}
		} else if (parts.length === 2 && part0 === "beresp" && part1 === "ttl") {
			const ttl = parseTimeValue(String(value));
			context.beresp.ttl = ttl;
			if (!context.resp.http) context.resp.http = {};
			context.resp.http["X-TTL"] = String(ttl);
		} else if (parts.length === 2 && part0 === "beresp" && part1 === "grace") {
			const grace = parseTimeValue(String(value));
			context.beresp.grace = grace;
			if (!context.resp.http) context.resp.http = {};
			context.resp.http["X-Grace"] = String(grace);
		} else if (parts.length === 2 && part0 === "beresp" && part1 === "stale_while_revalidate") {
			const swr = parseTimeValue(String(value));
			context.beresp.stale_while_revalidate = swr;
			if (!context.resp.http) context.resp.http = {};
			context.resp.http["X-SWR"] = String(swr);
		} else if (parts.length === 2 && part0 === "beresp" && part1 === "do_esi") {
			const esiValue = this.evaluateExpression(statement.value, context);
			let doEsi = false;
			if (typeof esiValue === "boolean") {
				doEsi = esiValue;
			} else if (typeof esiValue === "string") {
				doEsi = esiValue.toLowerCase() === "true";
			} else if (typeof esiValue === "number") {
				doEsi = esiValue !== 0;
			}

			context.beresp.do_esi = doEsi;

			if (!context.resp.http) {
				context.resp.http = {};
			}
			context.resp.http["X-ESI"] = doEsi ? "true" : "false";
		} else if (parts.length >= 2 && part0 === "var") {
			const varName = parts.slice(1).join(".");

			if (!context.locals) {
				context.locals = {};
			}

			let resolved = value;
			if (resolved instanceof VCLConcatResult) {
				resolved = resolved.forLocal();
			}
			if (isNotSet(resolved)) {
				resolved = VCLString.from("");
			} else if (resolved instanceof VCLString) {
				// keep as-is
			} else if (typeof resolved === "string") {
				resolved = VCLString.from(resolved);
			}
			context.locals[varName] = this.coerceLocalValue(context.localTypes?.[varName], resolved);
		} else if (parts.length === 2 && part0 === "req" && part1 === "url") {
			context.req.url = String(value);
		} else if (parts.length === 2 && part0 === "bereq" && part1 === "url") {
			context.bereq.url = String(value);
		} else if (parts.length === 2 && part0 === "req" && part1 === "method") {
			context.req.method = String(value);
		} else if (parts.length === 2 && part0 === "bereq" && part1 === "method") {
			context.bereq.method = String(value);
		} else if (parts.length === 2 && part0 === "req" && part1 === "restarts") {
			context.req.restarts = Number(value);
		} else if (parts.length === 2 && part0 === "resp" && part1 === "status") {
			context.resp.status = Number(value);
		} else if (parts.length === 2 && part0 === "resp" && part1 === "response") {
			context.resp.statusText = String(value);
		} else if (parts.length === 2 && part0 === "beresp" && part1 === "status") {
			context.beresp.status = Number(value);
		} else if (parts.length === 2 && part0 === "beresp" && part1 === "response") {
			context.beresp.statusText = String(value);
		} else if (parts.length === 2 && part0 === "obj" && part1 === "status") {
			context.obj.status = Number(value);
		} else if (parts.length === 2 && part0 === "obj" && part1 === "response") {
			context.obj.response = String(value);
		} else if (parts.length === 2 && part0 === "obj" && part1 === "ttl") {
			(context.obj as any).ttl = parseTimeValue(String(value));
		} else if (parts.length === 2 && part0 === "obj" && part1 === "grace") {
			(context.obj as any).grace = parseTimeValue(String(value));
		} else if (parts.length === 2 && part0 === "obj" && part1 === "hits") {
			context.obj.hits = Number(value);
		} else if (parts.length === 2 && part0 === "beresp" && part1 === "cacheable") {
			(context.beresp as any).cacheable = Boolean(value);
		} else if (parts.length === 2 && part0 === "beresp" && part1 === "do_stream") {
			(context.beresp as any).do_stream = Boolean(value);
		} else if (parts.length === 2 && part0 === "beresp" && part1 === "gzip") {
			(context.beresp as any).gzip = Boolean(value);
		} else if (parts.length === 2 && part0 === "beresp" && part1 === "brotli") {
			(context.beresp as any).brotli = Boolean(value);
		} else if (parts.length === 2 && part0 === "beresp" && part1 === "saintmode") {
			(context.beresp as any).saintmode = parseTimeValue(String(value));
		} else if (parts.length === 2 && part0 === "beresp" && part1 === "stale_if_error") {
			(context.beresp as any).stale_if_error = parseTimeValue(String(value));
		} else if (parts.length === 2 && part0 === "beresp" && (part1 === "pci" || part1 === "hipaa")) {
			// One flag under two names; setting either marks the response.
			context.beresp.pci = toBool(value);
		} else if (parts.length === 2 && part0 === "client" && part1 === "identity") {
			(context.client as any).identity = String(value);
		} else if (parts.length === 2 && part0 === "req" && part1 === "hash_always_miss") {
			(context.req as any).hash_always_miss = Boolean(value);
		} else if (parts.length === 2 && part0 === "req" && part1 === "hash_ignore_busy") {
			(context.req as any).hash_ignore_busy = Boolean(value);
		} else if (parts.length === 2 && part0 === "req" && part1 === "is_ssl") {
			(context.req as any).is_ssl = Boolean(value);
		} else if (parts.length === 2 && part0 === "req" && part1 === "esi") {
			(context.req as any).esi = Boolean(value);
		} else if (parts.length === 2 && part0 === "req" && part1 === "grace") {
			(context.req as any).grace = parseTimeValue(String(value));
		} else if (parts.length === 2 && part0 === "req" && part1 === "max_stale_if_error") {
			(context.req as any).max_stale_if_error = parseTimeValue(String(value));
		} else if (parts.length === 2 && part0 === "req" && part1 === "max_stale_while_revalidate") {
			(context.req as any).max_stale_while_revalidate = parseTimeValue(String(value));
		} else if (parts.length === 2 && part0 === "bereq" && part1 === "connect_timeout") {
			(context.bereq as any).connect_timeout = parseTimeValue(String(value));
		} else if (parts.length === 2 && part0 === "bereq" && part1 === "first_byte_timeout") {
			(context.bereq as any).first_byte_timeout = parseTimeValue(String(value));
		} else if (parts.length === 2 && part0 === "bereq" && part1 === "between_bytes_timeout") {
			(context.bereq as any).between_bytes_timeout = parseTimeValue(String(value));
		} else if (parts.length === 2 && part0 === "bereq" && part1 === "fetch_timeout") {
			(context.bereq as any).fetch_timeout = parseTimeValue(String(value));
		} else if (parts.length >= 2) {
			const target = parts[0] as keyof VCLContext;
			if (target in context && typeof (context as any)[target] === "object") {
				const rest = parts.slice(1).join(".");
				(context as any)[target][rest] = value;
			}
		}
	}

	private executeUnsetStatement(statement: VCLUnsetStatement, context: VCLContext): void {
		const parts = statement.target.split(".");
		const part0 = parts[0] ?? "";
		const part1 = parts[1] ?? "";
		const headerName = parts.slice(2).join(".");
		if (parts.length >= 3 && part1 === "http") {
			const headers = this.httpHeadersOf(context, part0);
			if (headers) {
				const [baseHeader, subfieldKey] = this.parseSubfield(headerName);
				if (subfieldKey !== null) {
					const currentVal = headers[baseHeader] ?? "";
					const newVal = this.dictUnset(currentVal, subfieldKey);
					if (!newVal) {
						delete headers[baseHeader];
					} else {
						headers[baseHeader] = newVal;
					}
				} else if (headerName.includes("*")) {
					const pattern = new RegExp(
						"^" +
							headerName.replace(/[.*+?^${}()|[\]\\]/g, (m) => (m === "*" ? ".*" : `\\${m}`)) +
							"$",
						"i",
					);
					for (const key of Object.keys(headers)) {
						if (pattern.test(key)) delete headers[key];
					}
				} else {
					delete headers[headerName];
				}
			}
		} else if (parts.length >= 2 && part0 === "var") {
			const varName = parts.slice(1).join(".");
			if (context.locals) delete context.locals[varName];
		}
	}

	/** Resolve any runtime value to the string VCL would produce in an output sink (log, synthetic). */
	private stringifyForOutput(value: any): string {
		if (value instanceof VCLConcatResult) return value.display();
		return vclToString(value);
	}

	private executeLogStatement(statement: VCLLogStatement, context: VCLContext): void {
		context.platform.log({
			level: "info",
			message: `[VCL] ${this.stringifyForOutput(this.evaluateExpression(statement.message, context))}`,
		});
	}

	private executeSyntheticStatement(statement: VCLSyntheticStatement, context: VCLContext): void {
		context.obj.http["Content-Type"] = "text/html; charset=utf-8";
		context.obj.response =
			statement.expression !== undefined
				? this.stringifyForOutput(this.evaluateExpression(statement.expression, context))
				: statement.content;
	}

	private executeSyntheticBase64Statement(
		statement: VCLSyntheticBase64Statement,
		context: VCLContext,
	): void {
		const encoded = this.stringifyForOutput(this.evaluateExpression(statement.content, context));
		try {
			context.obj.response = Buffer.from(encoded, "base64").toString("utf-8");
		} catch {
			context.obj.response = encoded;
		}
		context.obj.http["Content-Type"] = "text/html; charset=utf-8";
	}

	private executeEsiStatement(context: VCLContext): void {
		context.beresp.do_esi = true;
	}

	private executeAddStatement(statement: VCLAddStatement, context: VCLContext): void {
		const value = this.evaluateExpression(statement.value, context);
		const parts = statement.target.split(".");
		const part0 = parts[0] ?? "";
		const part1 = parts[1] ?? "";

		// add only applies to HTTP headers
		if (parts.length >= 3 && part1 === "http") {
			const headerName = parts.slice(2).join(".");
			const headers = this.httpHeadersOf(context, part0);
			if (headers) {
				const existing = headers[headerName];
				const strVal = this.stringifyForOutput(value);
				// Each add creates a new header line; fragments are stored
				// separated so plain reads return the first line only.
				headers[headerName] = existing ? existing + HEADER_FRAGMENT_SEPARATOR + strVal : strVal;
				this.chargeRequestWorkspace(context, part0, headerName, strVal);
			}
		}
	}

	// chargeRequestWorkspace accounts for assembling a header into the per-request
	// workspace. Only req.http.* writes consume it, so writes to any other scope
	// are ignored. Fastly never reclaims the space the previous value occupied,
	// even across restarts, so the running total only grows; once it passes the
	// workspace size the request is rejected with a header overflow.
	private chargeRequestWorkspace(
		context: VCLContext,
		scope: string,
		headerName: string,
		value: string,
	): void {
		if (scope !== "req") {
			return;
		}
		context.workspaceBytes = (context.workspaceBytes ?? 0) + headerWorkspaceCost(headerName, value);
		if (context.workspaceBytes > MAX_REQUEST_WORKSPACE_SIZE) {
			throw new VCLLimitExceededError(
				`Header overflow: request workspace limitation of ${MAX_REQUEST_WORKSPACE_SIZE} bytes exceeded`,
			);
		}
	}

	/** Execute a typed subroutine invoked as an expression and return its value. */
	private executeFunctionalSub(
		sub: VCLSubroutine,
		argExprs: VCLExpression[],
		context: VCLContext,
	): any {
		if (this.functionalSubDepth > 100) {
			logError(`Functional subroutine recursion limit reached in ${sub.name}`);
			return null;
		}
		if (!context.locals) context.locals = {};
		const savedReturn = context.locals.__return_value__;
		const savedParams = new Map<string, { existed: boolean; value: any }>();
		if (sub.params) {
			for (let i = 0; i < sub.params.length; i++) {
				const param = sub.params[i]!;
				savedParams.set(param.name, {
					existed: Object.hasOwn(context.locals, param.name),
					value: context.locals[param.name],
				});
				context.locals[param.name] =
					i < argExprs.length ? this.evaluateExpression(argExprs[i]!, context) : undefined;
			}
		}
		this.functionalSubDepth++;
		let value: any = null;
		try {
			delete context.locals.__return_value__;
			for (const stmt of sub.body) {
				const result = this.executeStatement(stmt, context);
				if (result === "__typed_return__") {
					value = context.locals.__return_value__ ?? null;
					break;
				}
				if (result && typeof result === "string") break;
			}
		} finally {
			this.functionalSubDepth--;
			if (savedReturn === undefined) delete context.locals.__return_value__;
			else context.locals.__return_value__ = savedReturn;
			for (const [name, saved] of savedParams) {
				if (saved.existed) context.locals[name] = saved.value;
				else delete context.locals[name];
			}
		}
		return value;
	}

	private executeCallStatement(
		statement: VCLCallStatement,
		context: VCLContext,
	): string | undefined {
		const sub = this.program.subroutines.find((s) => s.name === statement.subroutineName);
		if (!sub) {
			logError(`Unknown subroutine: ${statement.subroutineName}`);
			return undefined;
		}

		// Set up parameters as local variables, restoring whatever they shadowed
		// once the subroutine returns.
		const savedParams = new Map<string, { existed: boolean; value: any }>();
		if (sub.params && statement.arguments.length > 0) {
			if (!context.locals) context.locals = {};
			for (let i = 0; i < sub.params.length && i < statement.arguments.length; i++) {
				const param = sub.params[i]!;
				const argValue = this.evaluateExpression(statement.arguments[i]!, context);
				savedParams.set(param.name, {
					existed: Object.hasOwn(context.locals, param.name),
					value: context.locals[param.name],
				});
				context.locals[param.name] = argValue;
			}
		}

		try {
			// Execute subroutine body
			for (const stmt of sub.body) {
				const result = this.executeStatement(stmt, context);
				if (result && typeof result === "string") {
					// If the custom sub returns a VCL action (deliver, pass, etc.), propagate it
					if (
						[
							"deliver",
							"pass",
							"lookup",
							"fetch",
							"error",
							"restart",
							"pipe",
							"hash",
							"deliver_stale",
							"hit_for_pass",
						].includes(result)
					) {
						return result;
					}
					// For typed returns, store as __return_value__
					if (sub.returnType) {
						context.locals.__return_value__ = result;
						return undefined;
					}
				}
			}
			return undefined;
		} finally {
			if (context.locals) {
				for (const [name, saved] of savedParams) {
					if (saved.existed) context.locals[name] = saved.value;
					else delete context.locals[name];
				}
			}
		}
	}

	private executeSwitchStatement(
		statement: VCLSwitchStatement,
		context: VCLContext,
	): string | undefined {
		// The control expression is stringified per VCL rules (INTEGER decimal,
		// BOOL "1"/"0", FLOAT/RTIME three decimals) and cases compare as strings.
		const subject = this.evaluateExpression(statement.subject, context);
		let subjectStr: string;
		if (subject instanceof VCLConcatResult) {
			subjectStr = subject.forLocal();
		} else if (subject instanceof VCLString) {
			subjectStr = subject.value;
		} else {
			subjectStr = vclToString(subject);
		}

		// Scan cases in order, skipping default; it only runs when nothing matched.
		let index = -1;
		for (let n = 0; n < statement.cases.length; n++) {
			const switchCase = statement.cases[n]!;
			if (switchCase.test === null) continue;
			const caseValue = this.evaluateExpression(switchCase.test, context);
			const caseStr = caseValue instanceof VCLString ? caseValue.value : vclToString(caseValue);
			const isMatch = switchCase.regex
				? this.regexMatch(subjectStr, caseStr, context, false)
				: subjectStr === caseStr;
			if (isMatch) {
				index = n;
				break;
			}
		}
		if (index === -1) {
			index = statement.cases.findIndex((c) => c.test === null);
			if (index === -1) return undefined;
		}

		// Execute the matched case; fallthrough continues with the next case in
		// textual order (which may be the default case).
		while (index < statement.cases.length) {
			const switchCase = statement.cases[index]!;
			for (const stmt of switchCase.body) {
				const result = this.executeStatement(stmt, context);
				if (result && typeof result === "string") return result;
			}
			if (!switchCase.fallthrough) break;
			index++;
		}
		return undefined;
	}

	private executeHashDataStatement(statement: VCLHashDataStatement, context: VCLContext): void {
		const value = this.evaluateExpression(statement.value, context);
		const hash = hashHex("md5", Buffer.from(String(value)));
		if (!context.hashData) context.hashData = [];
		context.hashData.push(hash);
	}

	private executeGotoStatement(statement: VCLGotoStatement, _context: VCLContext): string {
		return `__goto__:${statement.label}`;
	}

	// The restart counter is incremented by the pipeline driver, which also
	// enforces the restart limit; the statement only surfaces the action.
	private executeRestartStatement(_statement: VCLRestartStatement, _context: VCLContext): string {
		return "restart";
	}

	private evaluateExpression(expression: VCLExpression, context: VCLContext): any {
		if (!expression?.type) return null;

		switch (expression.type) {
			case "StringLiteral":
				return (expression as VCLStringLiteral).value;
			case "NumberLiteral": {
				const num = expression as VCLNumberLiteral;
				return num.isFloat ? new VCLFloat(num.value) : num.value;
			}
			case "RTimeLiteral":
				return new VCLRTime((expression as any).seconds);
			case "BoolLiteral":
				return (expression as any).value as boolean;
			case "RegexLiteral": {
				const regex = expression as VCLRegexLiteral;
				return new RegExp(regex.pattern, regex.flags || "");
			}
			case "Identifier":
				return this.evaluateIdentifier(expression as VCLIdentifier, context);
			case "BinaryExpression":
				return this.evaluateBinaryExpression(expression as VCLBinaryExpression, context);
			case "UnaryExpression":
				return this.evaluateUnaryExpression(expression as VCLUnaryExpression, context);
			case "TernaryExpression":
				return this.evaluateTernaryExpression(expression as VCLTernaryExpression, context);
			case "FunctionCall":
				return this.evaluateFunctionCall(expression as VCLFunctionCall, context);
			case "MemberAccess": {
				const memberAccess = expression as any;
				const object = this.evaluateExpression(memberAccess.object, context);
				return object && typeof object === "object" ? object[memberAccess.property] : null;
			}
			default:
				return null;
		}
	}

	/**
	 * Fastly condition truthiness: a STRING is true when it is set — even when
	 * empty — and false only when notset. Other types use plain truthiness.
	 */
	private isTruthyCondition(value: any): boolean {
		if (value instanceof VCLString) return !value.isNotSet;
		if (value instanceof VCLConcatResult) return !value.allNotSet;
		if (typeof value === "string") return true;
		return Boolean(value);
	}

	private evaluateTernaryExpression(expression: VCLTernaryExpression, context: VCLContext): any {
		const conditionRaw = this.evaluateExpression(expression.condition, context);
		const condition = this.isTruthyCondition(conditionRaw);
		return this.evaluateExpression(condition ? expression.trueExpr : expression.falseExpr, context);
	}

	private evaluateFunctionCall(expression: VCLFunctionCall, context: VCLContext): any {
		const result = this.evaluateFunctionCallInner(expression, context);
		const rule = NULL_RESULT_RULES[expression.name];
		if (rule && (result === null || result === undefined)) {
			if (context.fastly) context.fastly.error = rule.error;
			return coerceBuiltinReturn(expression.name, rule.value);
		}
		return coerceBuiltinReturn(expression.name, result);
	}

	private evaluateFunctionCallInner(expression: VCLFunctionCall, context: VCLContext): any {
		const functionName = expression.name;
		const overloads = BUILTIN_SIGNATURES[functionName]?.args;
		const argTypes =
			overloads?.find((o) => o.length === expression.arguments.length) ?? overloads?.[0];
		const args = expression.arguments.map((arg, i) => {
			const v = this.evaluateExpression(arg, context);
			// STRING arguments receive the concatenated string form.
			if (v instanceof VCLConcatResult) return this.stringifyForOutput(v);
			// Unwrap typed values per the declared parameter type so module
			// implementations receive plain JS primitives.
			const declared = argTypes?.[i];
			if (v !== null && v !== undefined) {
				if (declared === "FLOAT" || declared === "INTEGER") return Number(v);
				if (declared === "STRING" && typeof v !== "string" && !(v instanceof VCLString)) {
					return vclToString(v);
				}
			}
			return v;
		});

		// Functional (typed) user subroutines are called like builtin functions.
		if (!functionName.includes(".")) {
			const userSub = this.functionalSubs.get(functionName);
			if (userSub) {
				return this.executeFunctionalSub(userSub, expression.arguments, context);
			}
		}

		const prefixModules: Record<string, any> = {
			"addr.": context.addr,
			"accept.": context.accept,
			"bin.": context.bin,
			"querystring.": context.querystring,
			"uuid.": context.uuid,
			"waf.": context.waf,
			"utf8.": (context as any).utf8,
			"testing.": (context as any).testing,
			"assert.": (context as any).assert,
		};

		for (const [prefix, module] of Object.entries(prefixModules)) {
			if (functionName.startsWith(prefix) && module) {
				const fn = functionName.substring(prefix.length);
				if (typeof module[fn] === "function") {
					const result = module[fn](...args);
					return result === null ? VCLString.notset() : result;
				}
			}
		}

		if (functionName === "std.collect" || functionName === "std.count") {
			// Both operate on the header itself (ID argument), not its value.
			const idArg = expression.arguments[0];
			const idName = idArg?.type === "Identifier" ? (idArg as VCLIdentifier).name : "";
			const idParts = idName.split(".");
			if (idParts.length >= 3 && idParts[1] === "http") {
				const headers = this.httpHeadersOf(context, idParts[0]!);
				const headerName = idParts.slice(2).join(".");
				const raw = headers?.[headerName];
				if (functionName === "std.count") {
					return raw === undefined ? 0 : raw.split(HEADER_FRAGMENT_SEPARATOR).length;
				}
				if (headers && raw !== undefined) {
					const sep = args.length > 1 ? String(args[1]) : ", ";
					headers[headerName] = raw.split(HEADER_FRAGMENT_SEPARATOR).join(sep);
				}
				return null;
			}
			return functionName === "std.count" ? 0 : null;
		}
		if (functionName === "std.log") {
			context.platform.log({ level: "info", message: `[VCL] ${args[0]}` });
			return null;
		}

		if (functionName.startsWith("digest.") && context.std?.digest) {
			const fn = functionName.substring(7);
			const digestModule = context.std.digest as Record<string, (...args: any[]) => unknown>;
			if (typeof digestModule[fn] === "function") {
				const result = digestModule[fn](...args);
				return result === null ? VCLString.notset() : result;
			}
		}

		if (functionName.startsWith("std.")) {
			const stdFunction = functionName.substring(4);
			const stdModule = context.std as Record<string, any> | undefined;
			if (stdModule && typeof stdModule[stdFunction] === "function") {
				return stdModule[stdFunction](...args);
			}

			const stdParts = stdFunction.split(".");
			if (stdParts.length === 2 && stdModule?.[stdParts[0]!]?.[stdParts[1]!]) {
				if (typeof stdModule[stdParts[0]!][stdParts[1]!] === "function") {
					return stdModule[stdParts[0]!][stdParts[1]!](...args);
				}
			}

			const mathFuncs: Record<string, (a: any[]) => number> = {
				min: (a) => Math.min(Number(a[0]), Number(a[1])),
				max: (a) => Math.max(Number(a[0]), Number(a[1])),
				floor: (a) => Math.floor(Number(a[0])),
				ceiling: (a) => Math.ceil(Number(a[0])),
				round: (a) => Math.round(Number(a[0])),
			};
			if (mathFuncs[stdFunction]) return mathFuncs[stdFunction](args);

			if (stdParts.length === 2 && stdParts[0] === "director" && stdParts[1] === "select_backend") {
				if (args.length === 1 && typeof args[0] === "string") {
					const directorName = args[0];
					if (context.directors?.[directorName]) {
						const director = context.directors[directorName];

						if (director.backends && director.backends.length > 0) {
							return {
								name: director.backends[0]!.backend.name,
							};
						}
					}
				}

				if (context.backends) {
					const backendNames = Object.keys(context.backends);
					if (backendNames.length > 0) {
						return {
							name: backendNames[0]!,
						};
					}
				}

				return { name: "default" };
			}
		} else if (functionName === "if") {
			if (args.length === 3) {
				return args[0] ? args[1] : args[2];
			}
		} else if (functionName === "substr") {
			if (args.length >= 2) {
				return substrImpl(
					String(args[0]),
					Number(args[1]),
					args.length >= 3 ? Number(args[2]) : undefined,
				);
			}
		} else if (functionName === "regsub") {
			if (args.length === 3) {
				return regsubImpl(String(args[0]), String(args[1]), String(args[2]));
			}
		} else if (functionName === "regsuball") {
			if (args.length === 3) {
				return regsuballImpl(String(args[0]), String(args[1]), String(args[2]));
			}
		} else if (functionName.startsWith("math.")) {
			const fn = functionName.substring(5);
			const mathModule = context.math as Record<string, (...args: any[]) => unknown> | undefined;
			if (mathModule && typeof mathModule[fn] === "function") {
				const result = mathModule[fn](...args);
				// Set fastly.error for math domain/range errors
				if (typeof result === "number" && (fn === "log" || fn === "log2" || fn === "log10")) {
					const x = Number(args[0]);
					if (x < 0) {
						if (context.fastly) context.fastly.error = "EDOM";
					} else if (x === 0) {
						if (context.fastly) context.fastly.error = "ERANGE";
					}
				}
				return result;
			}
		} else if (functionName.startsWith("table.")) {
			const fn = functionName.substring(6);
			const tableModule = context.table as Record<string, (...args: any[]) => unknown> | undefined;
			if (tableModule && typeof tableModule[fn] === "function") {
				if (fn === "lookup" || fn === "contains" || fn.startsWith("lookup_")) {
					const firstArg = expression.arguments[0];
					const tableName =
						firstArg?.type === "Identifier" ? (firstArg as VCLIdentifier).name : args[0];
					return tableModule[fn](context.tables, tableName, ...args.slice(1));
				}
				return tableModule[fn](...args);
			}
		} else if (functionName.startsWith("time.")) {
			const fn = functionName.substring(5);
			const timeModule = context.time as Record<string, (...args: any[]) => unknown> | undefined;
			if (timeModule && typeof timeModule[fn] === "function") return timeModule[fn](...args);
		} else if (functionName.startsWith("header.")) {
			const fn = functionName.substring(7);
			const whereArg = expression.arguments[0];
			const whereName =
				whereArg?.type === "Identifier" ? (whereArg as VCLIdentifier).name.split(".")[0] : "";
			const headers = whereName ? this.httpHeadersOf(context, whereName) : undefined;
			const headerModule = context.header as
				| Record<string, (...args: any[]) => unknown>
				| undefined;
			if (!headers || !headerModule || typeof headerModule[fn] !== "function") {
				logError(`header.${fn}: invalid target ${whereName}`);
				return null;
			}
			const names = args.slice(1).map((a) => String(a));
			switch (fn) {
				case "get": {
					const v = headerModule.get!(headers, names[0] ?? "");
					return v === undefined || v === null || v === "" ? VCLString.notset() : v;
				}
				case "set":
					headerModule.set!(headers, names[0] ?? "", names[1] ?? "");
					return null;
				case "unset": {
					// Unlike the `unset` statement, header.unset leaves the header
					// readable as a set-but-empty string.
					headerModule.unset!(headers, names[0] ?? "");
					headers[names[0] ?? ""] = "";
					return null;
				}
				case "filter":
				case "filter_except": {
					const result = headerModule[fn]!(headers, names) as Record<string, string>;
					// Filtered-out headers read back as set-but-empty strings.
					for (const key of Object.keys(headers)) {
						headers[key] = key in result ? result[key]! : "";
					}
					return null;
				}
				default:
					return headerModule[fn]!(...args);
			}
		} else if (functionName.startsWith("ratelimit.")) {
			const fn = functionName.substring(10);
			if (context.rateLimitModule && typeof context.rateLimitModule[fn] === "function") {
				// ID arguments (ratecounter/penaltybox names) are bare identifiers in VCL.
				const hasIdentifierArgs = expression.arguments.some((a) => a?.type === "Identifier");
				const resolvedArgs = hasIdentifierArgs
					? args.map((arg, i) => {
							const exprArg = expression.arguments[i];
							return exprArg?.type === "Identifier" ? (exprArg as VCLIdentifier).name : arg;
						})
					: args;
				return context.rateLimitModule[fn](...resolvedArgs);
			}
		} else if (functionName === "strftime" && context.strftime) {
			return context.strftime(args[0] as string, args[1] as Date);
		} else if (functionName === "parse_time_delta" && context.parse_time_delta) {
			return context.parse_time_delta(args[0] as string);
		} else if (functionName === "urlencode") {
			return urlencodeImpl(String(args[0]));
		} else if (functionName === "urldecode") {
			return urldecodeImpl(String(args[0]));
		} else if (
			functionName === "json.escape" ||
			functionName === "json_escape" ||
			functionName === "cstr_escape"
		) {
			return functionName === "cstr_escape"
				? cstrEscapeImpl(String(args[0]))
				: jsonEscapeImpl(String(args[0]));
		} else if (functionName === "xml_escape") {
			return xmlEscapeImpl(String(args[0]));
		} else if (functionName === "boltsort.sort") {
			return boltsortImpl(String(args[0]));
		} else if (functionName === "subfield") {
			return subfieldImpl(
				String(args[0]),
				String(args[1]),
				args.length > 2 ? String(args[2]) : ",",
			);
		} else if (functionName === "randombool") {
			const numerator = Math.floor(Number(args[0]));
			const denominator = Math.floor(Number(args[1]));
			if (numerator <= 0) return false;
			if (denominator <= 0) return true;
			if (context.std?.random?.bool) return context.std.random.bool(numerator, denominator);
			const rv = Math.floor(randomFloat(context.platform) * denominator) + 1;
			return rv <= numerator;
		} else if (functionName === "randombool_seeded") {
			const numerator = Math.floor(Number(args[0]));
			const denominator = Math.floor(Number(args[1]));
			if (numerator <= 0) return false;
			if (denominator <= 0) return true;
			const rv = Math.floor(seededRandom(Number(args[2]) || 0) * denominator) + 1;
			return rv <= numerator;
		} else if (functionName === "randomint") {
			const [from, to] = [Math.floor(Number(args[0])), Math.floor(Number(args[1]))];
			if (from > to) return 0;
			return Math.floor(randomFloat(context.platform) * (to - from)) + from;
		} else if (functionName === "randomint_seeded") {
			const [from, to] = [Math.floor(Number(args[0])), Math.floor(Number(args[1]))];
			if (from > to) return 0;
			return Math.floor(seededRandom(Number(args[2]) || 0) * (to - from)) + from;
		} else if (functionName === "randomstr") {
			const chars =
				args.length >= 2 && args[1]
					? String(args[1])
					: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_";
			if (chars.length === 0) return "";
			return Array.from(
				{ length: Math.max(0, Math.floor(Number(args[0]))) },
				() => chars[Math.floor(randomFloat(context.platform) * chars.length)],
			).join("");
		} else if (functionName.startsWith("setcookie.")) {
			const cookieFunction = functionName.substring(10);
			const whereArg = expression.arguments[0];
			const whereName =
				whereArg?.type === "Identifier" ? (whereArg as VCLIdentifier).name.split(".")[0] : "";
			const respObj =
				whereName === "beresp" ? context.beresp : whereName === "resp" ? context.resp : null;
			if (!respObj) {
				logError(`setcookie.${cookieFunction}: invalid ident: ${whereName}`);
				return null;
			}
			const setCookie = (respObj.http["Set-Cookie"] ?? "")
				.split(HEADER_FRAGMENT_SEPARATOR)
				.join(", ");
			if (cookieFunction === "get_value_by_name") {
				return setcookie_get_value_by_name(setCookie, String(args[1]));
			} else if (cookieFunction === "delete_by_name") {
				const rebuilt = setcookie_delete_by_name(setCookie, String(args[1]));
				if (rebuilt === setCookie) return false;
				if (rebuilt === "") delete respObj.http["Set-Cookie"];
				else respObj.http["Set-Cookie"] = rebuilt;
				return true;
			}
		} else if (functionName === "http_status_matches") {
			const status = Number(args[0]);
			const statusStr = String(status);
			for (let i = 1; i < args.length; i++) {
				const pattern = String(args[i]).trim();
				if (pattern === statusStr) return true;
				if (pattern.length === 3 && pattern.endsWith("xx") && statusStr[0] === pattern[0])
					return true;
				if (
					pattern.length === 3 &&
					pattern.endsWith("x") &&
					statusStr.startsWith(pattern.substring(0, 2))
				)
					return true;
				if (pattern.includes("-")) {
					const rangeParts = pattern.split("-").map((s) => parseInt(s.trim(), 10));
					const start = rangeParts[0];
					const end = rangeParts[1];
					if (
						start !== undefined &&
						end !== undefined &&
						!Number.isNaN(start) &&
						!Number.isNaN(end) &&
						status >= start &&
						status <= end
					)
						return true;
				}
			}
			return false;
		} else if (functionName === "resp.tarpit" || functionName === "early_hints") {
			return null;
		} else if (functionName === "fastly.hash") {
			return fastlyHash(String(args[0]), Number(args[1]), Number(args[2]), Number(args[3]));
		} else if (functionName === "url.normalize") {
			return urlNormalizeImpl(String(args[0]));
		} else if (functionName === "fastly.try_select_shield") {
			return false;
		} else if (
			functionName === "fastly.ff_last_hop_was_serviceid" ||
			functionName === "fastly.ff.last_hop_was_serviceid"
		) {
			return false;
		} else if (functionName === "h2.push") {
			return null;
		} else if (functionName === "h2.disable_header_compression") {
			return null;
		} else if (functionName === "h3.alt_svc") {
			return null;
		} else if (functionName.startsWith("crypto.")) {
			const fn = functionName.substring(7);
			const cryptoModule = context.std?.crypto as
				| Record<string, (...args: any[]) => unknown>
				| undefined;
			if (cryptoModule && typeof cryptoModule[fn] === "function") return cryptoModule[fn](...args);
		}

		// An unknown function is a runtime error that aborts the subroutine.
		if (context.fastly) context.fastly.error = `Function ${functionName} is not defined`;
		logError(`Unknown function call: ${functionName}`);
		throw new Error(`Function ${functionName} is not defined`);
	}

	private evaluateIdentifier(identifier: VCLIdentifier, context: VCLContext): any {
		const result = this.evaluateIdentifierInner(identifier, context);
		return coerceVariableRead(identifier.name, result);
	}

	private evaluateIdentifierInner(identifier: VCLIdentifier, context: VCLContext): any {
		const name = identifier.name;
		const parts = name.split(".");

		const idPart0 = parts[0] ?? "";
		const idPart1 = parts[1] ?? "";
		const idPart2 = parts[2] ?? "";

		if (name === "LF") return "\n";

		const VCL_ENUM_VALUES = new Set([
			"aes128",
			"aes192",
			"aes256",
			"cbc",
			"ctr",
			"gcm",
			"ccm",
			"pkcs7",
			"nopad",
			"sha1",
			"sha256",
			"sha384",
			"sha512",
			"der",
			"jwt",
			"standard",
			"url",
			"url_nopad",
			"default",
		]);
		if (VCL_ENUM_VALUES.has(name)) return name;

		if (name === "now") return new VCLTime(context.platform.now());
		if (name === "now.sec") return String(Math.floor(context.platform.now() / 1000));

		if (parts.length >= 3 && idPart1 === "http") {
			const headerName = parts.slice(2).join(".");
			const [baseHeader, subfieldKey] = this.parseSubfield(headerName);
			if (subfieldKey !== null) {
				const headerValue = this.httpHeadersOf(context, idPart0)?.[baseHeader];
				if (headerValue === undefined || headerValue === "") return VCLString.notset();
				const val = this.dictGet(firstHeaderFragment(String(headerValue)), subfieldKey);
				return val !== undefined ? val : VCLString.notset();
			}
			const raw = this.httpHeadersOf(context, idPart0)?.[headerName];
			return raw === undefined ? VCLString.notset() : firstHeaderFragment(raw);
		}

		if (parts.length === 3 && idPart0 === "re" && idPart1 === "group") {
			const groupNumber = parseInt(idPart2, 10);
			if (!Number.isNaN(groupNumber) && context.re?.groups?.[groupNumber] !== undefined) {
				return context.re.groups[groupNumber];
			}
			// No recorded match or out-of-range group reads as notset.
			return VCLString.notset();
		}

		if (parts.length >= 2 && idPart0 === "var") {
			const varName = parts.slice(1).join(".");
			return context.locals?.[varName] ?? VCLString.notset();
		}

		if (context.locals && name in context.locals) {
			return context.locals[name];
		}

		// A bare identifier naming a declared backend or director evaluates to
		// it, so BACKEND-typed locals can hold and later dereference it.
		if (!name.includes(".")) {
			const backend = context.backends?.[name] ?? context.directors?.[name];
			if (backend) return backend;
		}

		return this.resolveVariable(name, context);
	}

	private resolveVariable(name: string, context: VCLContext): any {
		const ctx = context as any;

		if (name === "testing.state") return ctx.testing?._state ?? "";
		if (name === "testing.synthetic_body") return context.obj.response ?? "";

		if (name === "req.url") return context.req.url;
		if (name === "req.url.path") {
			const url = context.req.url || "";
			const qIdx = url.indexOf("?");
			return qIdx >= 0 ? url.substring(0, qIdx) : url;
		}
		if (name === "req.url.qs") {
			const url = context.req.url || "";
			const qIdx = url.indexOf("?");
			return qIdx >= 0 ? url.substring(qIdx + 1) : "";
		}
		if (name === "req.url.basename") {
			const path = this.resolveVariable("req.url.path", context) as string;
			if (path === "") return ".";
			const lastSlash = path.lastIndexOf("/");
			return lastSlash >= 0 ? path.substring(lastSlash + 1) : path;
		}
		if (name === "req.url.dirname") {
			const path = this.resolveVariable("req.url.path", context) as string;
			if (path === "") return ".";
			const lastSlash = path.lastIndexOf("/");
			return lastSlash >= 0 ? path.substring(0, lastSlash + 1) : "/";
		}
		if (name === "req.url.ext") {
			const basename = this.resolveVariable("req.url.basename", context) as string;
			const dotIdx = basename.lastIndexOf(".");
			return dotIdx >= 0 ? basename.substring(dotIdx + 1) : "";
		}
		if (name === "req.method" || name === "req.request") return context.req.method;
		if (name === "req.backend") return context.req.backend || "";
		if (name === "req.restarts") return context.req.restarts || 0;
		if (name === "req.proto") return ctx.req?.proto || "HTTP/1.1";
		if (name === "req.body") return ctx.req?.body || "";
		if (name === "req.body.base64") {
			const body = ctx.req?.body || "";
			return body ? Buffer.from(body).toString("base64") : "";
		}
		if (name === "req.is_ssl") return ctx.req?.is_ssl ?? false;
		if (name === "req.is_purge") return context.req.method === "PURGE";
		if (name === "req.is_ipv6") return ctx.req?.is_ipv6 ?? false;
		if (name === "req.is_background_fetch") return false;
		if (name === "req.is_clustering") return false;
		if (name === "req.is_esi_subreq") return ctx.req?.is_esi_subreq ?? false;
		if (name === "req.esi") return ctx.req?.esi ?? false;
		if (name === "req.esi_level") return ctx.req?.esi_level ?? 0;
		if (name === "req.hash") return ctx.hashData?.join(":") || "";
		if (name === "req.hash_always_miss") return ctx.req?.hash_always_miss ?? false;
		if (name === "req.hash_ignore_busy") return ctx.req?.hash_ignore_busy ?? false;
		// Unless configured, staleness allowances default to the maximum RTIME.
		if (name === "req.grace") return ctx.req?.grace ?? MAX_RTIME_SECONDS;
		if (name === "req.max_stale_if_error") return ctx.req?.max_stale_if_error ?? MAX_RTIME_SECONDS;
		if (name === "req.max_stale_while_revalidate")
			return ctx.req?.max_stale_while_revalidate ?? MAX_RTIME_SECONDS;
		if (name === "req.xid") {
			if (!ctx.req.xid) ctx.req.xid = generateXid(context);
			return ctx.req.xid;
		}
		if (name === "req.enable_range_on_pass") return false;
		if (name === "req.enable_segmented_caching") return false;
		// Before the cache key is computed the digest reads as all zeros.
		if (name === "req.digest") return ctx.req?.digest || "0".repeat(64);
		if (name === "req.digest.ratio") return ctx.req?.digest_ratio ?? 0;
		if (name === "req.bytes_read") return 0;
		if (name === "req.header_bytes_read") return 0;
		if (name === "req.body_bytes_read") return 0;
		if (name === "req.topurl") return context.req.url;
		if (name === "req.postbody") return ctx.req?.body || "";
		if (name === "req.protocol") {
			return ctx.req?.is_ssl ? "https" : "http";
		}
		if (name === "req.service_id") return ctx.req?.service_id || "local-service-id";
		if (name === "req.customer_id") return ctx.req?.customer_id || "local-customer-id";
		if (name === "req.vcl") return ctx.req?.vcl || "local.1_0-00000000000000000000000000000000";
		if (name === "req.vcl.md5") {
			const vcl = ctx.req?.vcl || "local.1_0-00000000000000000000000000000000";
			return hashHex("md5", Buffer.from(vcl));
		}
		if (name === "req.vcl.generation") return 1;
		if (name === "req.vcl.version") return 1;
		if (name === "req.headers") return serializeHeaders(context.req.http);
		if (name.startsWith("req.backend.")) {
			const prop = name.substring(12);
			const be = context.current_backend || context.backends?.[context.req.backend || "default"];
			if (!be) return "";
			const beProps: Record<string, any> = {
				name: be.name,
				host: be.host,
				// Backend hosts are not resolved locally; report the loopback
				// address the emulated connection would use.
				ip: "127.0.0.1",
				port: be.port,
				healthy: be.is_healthy ?? true,
				is_cluster: false,
				is_origin: true,
				is_shield: false,
			};
			return beProps[prop] ?? "";
		}

		// bereq.* variables
		if (name === "bereq.url") return context.bereq.url;
		if (name === "bereq.method" || name === "bereq.request") return context.bereq.method;
		if (name === "bereq.proto") return ctx.bereq?.proto || "HTTP/1.1";
		if (name === "bereq.url.path") {
			const url = context.bereq.url || "";
			const qIdx = url.indexOf("?");
			return qIdx >= 0 ? url.substring(0, qIdx) : url;
		}
		if (name === "bereq.url.qs") {
			const url = context.bereq.url || "";
			const qIdx = url.indexOf("?");
			return qIdx >= 0 ? url.substring(qIdx + 1) : "";
		}
		if (name === "bereq.url.basename") {
			const path = this.resolveVariable("bereq.url.path", context) as string;
			if (path === "") return ".";
			const lastSlash = path.lastIndexOf("/");
			return lastSlash >= 0 ? path.substring(lastSlash + 1) : path;
		}
		if (name === "bereq.url.dirname") {
			const path = this.resolveVariable("bereq.url.path", context) as string;
			if (path === "") return ".";
			const lastSlash = path.lastIndexOf("/");
			return lastSlash >= 0 ? path.substring(0, lastSlash + 1) : "/";
		}
		if (name === "bereq.url.ext") {
			const basename = this.resolveVariable("bereq.url.basename", context) as string;
			const dotIdx = basename.lastIndexOf(".");
			return dotIdx >= 0 ? basename.substring(dotIdx + 1) : "";
		}
		if (name === "bereq.headers") return serializeHeaders(context.bereq.http);
		if (name === "bereq.max_reuse_idle_time") return ctx.bereq?.max_reuse_idle_time ?? 0;
		if (name === "bereq.fetch_timeout") return ctx.bereq?.fetch_timeout ?? 0;
		if (name === "bereq.connect_timeout") return ctx.bereq?.connect_timeout ?? 0;
		if (name === "bereq.first_byte_timeout") return ctx.bereq?.first_byte_timeout ?? 15;
		if (name === "bereq.between_bytes_timeout") return ctx.bereq?.between_bytes_timeout ?? 0;
		if (name === "bereq.is_clustering") return false;
		if (name === "bereq.bytes_written") return 0;
		if (name === "bereq.header_bytes_written") return 0;
		if (name === "bereq.body_bytes_written") return 0;

		// beresp.* variables
		if (name === "beresp.status") return context.beresp.status;
		if (name === "beresp.response") return context.beresp.statusText;
		if (name === "beresp.proto") return ctx.beresp?.proto || "HTTP/1.1";
		if (name === "beresp.ttl") return context.beresp.ttl;
		if (name === "beresp.grace") return context.beresp.grace ?? 0;
		if (name === "beresp.stale_if_error") return ctx.beresp?.stale_if_error ?? 0;
		if (name === "beresp.stale_while_revalidate") return context.beresp.stale_while_revalidate ?? 0;
		if (name === "beresp.cacheable") return ctx.beresp?.cacheable ?? false;
		if (name === "beresp.do_esi") return context.beresp.do_esi ?? false;
		if (name === "beresp.do_stream") return ctx.beresp?.do_stream ?? false;
		if (name === "beresp.gzip") return ctx.beresp?.gzip ?? false;
		if (name === "beresp.brotli") return ctx.beresp?.brotli ?? false;
		if (name === "beresp.saintmode") return ctx.beresp?.saintmode ?? 0;
		// beresp.hipaa and beresp.pci are the same flag under two names.
		if (name === "beresp.hipaa" || name === "beresp.pci") return context.beresp.pci ?? false;
		if (name === "beresp.headers") return serializeHeaders(context.beresp.http);
		if (name === "beresp.handshake_time_to_origin_ms") return 100;
		if (name === "beresp.used_alternate_path_to_origin") return false;
		if (name.startsWith("beresp.backend.")) {
			const prop = name.substring(15);
			// These reflect the backend request made in this pass. Without one
			// (a cache hit, or a subroutine run outside the pipeline) the name
			// reads empty, host and the addresses read not set, and the port
			// reads zero.
			const snap = context.beresp.backend;
			switch (prop) {
				case "name":
					return snap?.name ?? "";
				case "host":
					return snap?.host ? snap.host : VCLString.notset();
				case "ip":
					return snap?.ip ? snap.ip : VCLString.notset();
				case "port":
					return snap?.port ?? 0;
				case "src_ip":
					return snap ? "127.0.0.1" : VCLString.notset();
				case "src_port":
					return 0;
				case "requests":
					return snap ? 1 : 0;
				case "alternate_ips":
					return "";
				default:
					return VCLString.notset();
			}
		}

		// resp.* variables
		if (name === "resp.status") return context.resp.status;
		if (name === "resp.response") return context.resp.statusText;
		if (name === "resp.proto") return ctx.resp?.proto || "HTTP/1.1";
		if (name === "resp.is_locally_generated") return ctx.resp?.is_locally_generated ?? false;
		if (name === "resp.completed") return ctx.resp?.completed ?? true;
		if (name === "resp.stale") return ctx.resp?.stale ?? false;
		if (name === "resp.stale.is_error") return false;
		if (name === "resp.stale.is_revalidating") return false;
		if (name === "resp.headers") return serializeHeaders(context.resp.http);
		if (name === "resp.bytes_written") return 0;
		if (name === "resp.header_bytes_written") return 0;
		if (name === "resp.body_bytes_written") return 0;

		// obj.* variables
		if (name === "obj.status") return context.obj.status;
		if (name === "obj.response") return context.obj.response ?? VCLString.notset();
		if (name === "obj.proto") return "HTTP/1.1";
		if (name === "obj.hits") return context.obj.hits;
		if (name === "obj.ttl") return ctx.obj?.ttl ?? 0;
		if (name === "obj.age") return ctx.obj?.age ?? 0;
		if (name === "obj.grace") return ctx.obj?.grace ?? 0;
		if (name === "obj.lastuse") return ctx.obj?.lastuse ?? 0;
		if (name === "obj.entered") return ctx.obj?.entered ?? 0;
		if (name === "obj.cacheable") return ctx.obj?.cacheable ?? false;
		// obj.is_pci and obj.is_hipaa reflect the flag the object was cached
		// with; they are the same value under two names.
		if (name === "obj.is_pci" || name === "obj.is_hipaa") return ctx.obj?.pci ?? false;
		if (name === "obj.stale_if_error") return ctx.obj?.stale_if_error ?? 0;
		if (name === "obj.stale_while_revalidate") return ctx.obj?.stale_while_revalidate ?? 60;
		if (name === "obj.headers") return serializeHeaders(context.obj.http);

		// client.* variables
		if (name === "client.ip") return context.client?.ip || "127.0.0.1";
		if (name === "client.port") return ctx.client?.port ?? 11111;
		if (name === "client.identity")
			return ctx.client?.identity || context.client?.ip || "127.0.0.1";
		if (name === "client.requests") return ctx.client?.requests ?? 1;
		if (name === "client.identified") return false;
		if (name === "client.sess_timeout") return ctx.client?.sess_timeout ?? 600;
		if (name.startsWith("client.geo.")) {
			const geoProp = name.substring(11);
			const geo = ctx.client?.geo || {};
			// Without a geolocation database, string fields read "unknown" and
			// the coordinates point at Fastly's San Francisco headquarters.
			const defaults: Record<string, any> = {
				city: "unknown",
				"city.ascii": "unknown",
				"city.latin1": "unknown",
				"city.utf8": "unknown",
				country_code: "unknown",
				country_code3: "unknown",
				country_name: "unknown",
				"country_name.ascii": "unknown",
				"country_name.latin1": "unknown",
				"country_name.utf8": "unknown",
				continent_code: "unknown",
				latitude: 37.779,
				longitude: -122.398,
				postal_code: "unknown",
				metro_code: 0,
				area_code: 0,
				region: "unknown",
				"region.ascii": "unknown",
				"region.latin1": "unknown",
				"region.utf8": "unknown",
				gmt_offset: 0,
				utc_offset: 0,
				conn_speed: "unknown",
				conn_type: "unknown",
				ip_override: "unknown",
				proxy_description: "unknown",
				proxy_type: "unknown",
			};
			return geo[geoProp] ?? defaults[geoProp] ?? "";
		}
		if (name.startsWith("client.as.")) {
			// Loopback/reserved space maps to the reserved AS.
			const prop = name.substring(10);
			if (prop === "number") return ctx.client?.as_number ?? 4294967294;
			if (prop === "name") return ctx.client?.as_name ?? "Reserved";
			return "";
		}
		if (name.startsWith("client.browser.")) {
			const prop = name.substring(15);
			return ctx.client?.browser?.[prop] ?? BROWSER_DEFAULTS[prop] ?? "";
		}
		if (name.startsWith("client.os.")) {
			const prop = name.substring(10);
			return ctx.client?.os?.[prop] ?? OS_DEFAULTS[prop] ?? "";
		}
		if (name === "client.bot.name") return "";
		if (name.startsWith("client.class.")) return false;
		if (name.startsWith("client.platform.")) {
			const prop = name.substring(16);
			if (prop === "hwtype" || prop === "model" || prop === "vendor") return "";
			return false;
		}
		if (name.startsWith("client.display.")) {
			if (name === "client.display.touchscreen") return false;
			// Unknown display characteristics read as -1.
			return -1;
		}
		if (name === "client.socket.congestion_algorithm") return "cubic";
		if (name === "client.socket.cwnd") return 60;
		if (name === "client.socket.nexthop") return "127.0.0.1";
		if (name.startsWith("client.socket.")) return 0;

		// server.* variables
		if (name === "server.hostname") return ctx.server?.hostname || ctx.platform.hostname();
		if (name === "server.identity") return ctx.server?.identity || "localhost";
		if (name === "server.datacenter") return ctx.server?.datacenter || "local";
		if (name === "server.region") return ctx.server?.region || "local";
		if (name === "server.pop") return ctx.server?.pop || "local";
		if (name === "server.billing_region") return ctx.server?.billing_region || "local";
		if (name === "server.ip") return ctx.server?.ip || "127.0.0.1";
		if (name === "server.port") return ctx.server?.port ?? 3124;

		// fastly.* variables
		if (name === "fastly.error") return context.fastly?.error || "";
		if (name === "fastly.is_staging") return false;
		if (name === "fastly.ddos_detected") return false;
		if (name === "fastly.ff.visits_this_pop") return 1;
		if (name === "fastly.ff.visits_this_pop_this_service") return 1;
		if (name === "fastly.ff.visits_this_service") return 0;
		if (name.startsWith("fastly.ff.")) return 0;
		if (name === "fastly.bot.name" || name === "fastly.bot.category") return "";
		if (name.startsWith("fastly.bot.")) return false;

		// fastly_info.* variables
		if (name === "fastly_info.state") return context.fastly?.state || "";
		if (name === "fastly_info.is_h2") return false;
		if (name === "fastly_info.is_h3") return false;
		if (name === "fastly_info.is_cluster_edge") return false;
		if (name === "fastly_info.is_cluster_shield") return false;
		if (name === "fastly_info.edge.is_tls") return false;
		if (name === "fastly_info.host_header") return context.req.http.Host || "";
		if (name === "fastly_info.request_id") return ctx.fastly_info?.request_id || "local-req-id";
		if (name === "fastly_info.h2.stream_id") return 1;
		if (name.startsWith("fastly_info.h2.")) return 0;

		// time.* variables
		if (name === "time.start" || name === "time.start.sec")
			return Math.floor(ctx.platform.now() / 1000);
		if (name === "time.start.msec") return ctx.platform.now();
		if (name === "time.start.usec") return ctx.platform.now() * 1000;
		if (name === "time.start.msec_frac") return ctx.platform.now() % 1000;
		if (name === "time.start.usec_frac") return (ctx.platform.now() * 1000) % 1000000;
		if (name === "time.elapsed" || name === "time.elapsed.sec") return 0;
		if (name === "time.elapsed.msec") return 0;
		if (name === "time.elapsed.usec") return 0;
		if (name === "time.elapsed.msec_frac") return "000";
		if (name === "time.elapsed.usec_frac") return "000000";
		if (name === "time.end" || name === "time.end.sec")
			return Math.floor(ctx.platform.now() / 1000);
		if (name === "time.end.msec") return ctx.platform.now();
		if (name === "time.end.usec") return ctx.platform.now() * 1000;
		if (name === "time.end.msec_frac") return ctx.platform.now() % 1000;
		if (name === "time.end.usec_frac") return (ctx.platform.now() * 1000) % 1000000;
		if (name === "time.to_first_byte") return 0;

		// tls.client.* variables. The emulated client handshake mirrors a
		// typical OpenSSL client hello so fingerprint-style variables read
		// like a realistic Fastly request.
		if (name === "tls.client.protocol") return ctx.tls?.client?.protocol || "";
		if (name === "tls.client.cipher") return ctx.tls?.client?.cipher || "";
		if (name === "tls.client.servername") return ctx.tls?.client?.servername || "";
		if (name === "tls.client.ciphers_list") return SYNTHETIC_TLS_CLIENT.ciphersList;
		if (name === "tls.client.ciphers_list_sha") return SYNTHETIC_TLS_CLIENT.ciphersListSha;
		if (name === "tls.client.ciphers_list_txt") return SYNTHETIC_TLS_CLIENT.ciphersListTxt;
		if (name === "tls.client.ciphers_sha") return SYNTHETIC_TLS_CLIENT.ciphersSha;
		if (name === "tls.client.handshake_sent_bytes") return 4759;
		if (name === "tls.client.iana_chosen_cipher_id") return 49199;
		if (name === "tls.client.ja3_md5") return SYNTHETIC_TLS_CLIENT.ja3Md5;
		if (name === "tls.client.ja4") return SYNTHETIC_TLS_CLIENT.ja4;
		if (name.startsWith("tls.client.certificate.")) {
			const prop = name.substring(23);
			// The synthetic client certificate is "verified" and valid for a
			// year starting now.
			if (prop === "is_verified") return true;
			if (prop === "not_before") return new VCLTime(context.platform.now());
			if (prop === "not_after") return new VCLTime(context.platform.now() + 365 * 24 * 3600 * 1000);
			if (prop.startsWith("is_")) return false;
			return "";
		}
		if (name.startsWith("tls.client.")) return "";

		// waf.* variables
		if (name === "waf.executed") return ctx.waf?.executed ?? false;
		if (name === "waf.blocked") return ctx.waf?.blocked ?? false;
		if (name === "waf.passed") return ctx.waf?.passed ?? false;
		if (name === "waf.logged") return ctx.waf?.logged ?? false;
		if (name === "waf.failures") return 0;
		if (name === "waf.anomaly_score") return ctx.waf?.anomaly_score ?? 0;
		if (name === "waf.sql_injection_score") return 0;
		if (name === "waf.xss_score") return 0;
		if (name === "waf.rce_score") return 0;
		if (name === "waf.lfi_score") return 0;
		if (name === "waf.rfi_score") return 0;
		if (name === "waf.http_violation_score") return 0;
		if (name === "waf.session_fixation_score") return 0;
		if (name === "waf.php_injection_score") return 0;
		if (name === "waf.rule_id") return 0;
		if (name === "waf.severity") return 0;
		if (name === "waf.message") return "";
		if (name === "waf.logdata") return "";
		if (name === "waf.counter") return 0;
		if (name === "waf.inbound_anomaly_score") return 0;

		// geoip.* legacy variables (alias for client.geo.*)
		if (name.startsWith("geoip.")) {
			const prop = name.substring(6);
			if (prop === "use_x_forwarded_for") return false;
			return this.resolveVariable(`client.geo.${prop}`, context);
		}

		// math.* constants
		const mathConstants: Record<string, number> = {
			"math.PI": Math.PI,
			"math.PI_2": Math.PI / 2,
			"math.PI_4": Math.PI / 4,
			"math.2PI": 2 * Math.PI,
			"math.E": Math.E,
			"math.TAU": 2 * Math.PI,
			"math.PHI": (1 + Math.sqrt(5)) / 2,
			"math.1_PI": 1 / Math.PI,
			"math.2_PI": 2 / Math.PI,
			"math.2_SQRTPI": 2 / Math.sqrt(Math.PI),
			"math.SQRT2": Math.SQRT2,
			"math.SQRT1_2": Math.SQRT1_2,
			"math.LN2": Math.LN2,
			"math.LN10": Math.LN10,
			"math.LOG2E": Math.LOG2E,
			"math.LOG10E": Math.LOG10E,
			"math.NEG_INFINITY": -Infinity,
			"math.POS_INFINITY": Infinity,
			"math.NEG_HUGE_VAL": -Infinity,
			"math.POS_HUGE_VAL": Infinity,
			"math.NAN": NaN,
			"math.FLOAT_MAX": Number.MAX_VALUE,
			"math.FLOAT_MIN": Number.MIN_VALUE,
			"math.FLOAT_EPSILON": Number.EPSILON,
			"math.FLOAT_DIG": 15,
			"math.FLOAT_MANT_DIG": 53,
			"math.FLOAT_MAX_10_EXP": 308,
			"math.FLOAT_MAX_EXP": 1024,
			"math.FLOAT_MIN_10_EXP": -307,
			"math.FLOAT_MIN_EXP": -1021,
			"math.FLOAT_RADIX": 2,
			"math.INTEGER_BIT": 64,
		};
		if (mathConstants[name] !== undefined) return mathConstants[name];
		// VCL INTEGERs are 64-bit; the extremes exceed double precision, so
		// they are held as BigInt to stringify exactly.
		if (name === "math.INTEGER_MAX") return 9223372036854775807n;
		if (name === "math.INTEGER_MIN") return -9223372036854775808n;

		// workspace.* variables
		if (name === "workspace.bytes_total") return MAX_REQUEST_WORKSPACE_SIZE;
		if (name === "workspace.bytes_free") {
			return Math.max(0, MAX_REQUEST_WORKSPACE_SIZE - (context.workspaceBytes ?? 0));
		}
		if (name === "workspace.overflowed") {
			return (context.workspaceBytes ?? 0) > MAX_REQUEST_WORKSPACE_SIZE;
		}

		// transport.* variables
		if (name === "transport.type") return "tcp";
		if (name === "transport.bw_estimate") return 0;

		// segmented_caching.* variables
		if (name === "segmented_caching.block_number") return 1;
		if (name === "segmented_caching.is_outer_req") return true;
		if (name === "segmented_caching.error") return "";
		if (name.startsWith("segmented_caching.")) return 0;

		// esi.* variables
		if (name === "esi.allow_inside_cdata") return false;

		// stale.exists reads as an empty string when no stale object exists.
		if (name === "stale.exists") return "";

		// quic.* variables
		if (name.startsWith("quic.")) return 0;

		// backend.socket.* variables
		if (name === "backend.socket.congestion_algorithm") return "cubic";
		if (name === "backend.socket.cwnd") return 60;
		if (name.startsWith("backend.socket.")) return 0;
		if (name === "backend.conn.tls_protocol") return "TLSv1.2";
		if (name.startsWith("backend.conn.")) return false;

		// Dynamic backend.{name}.healthy / backend.{name}.connections_* variables
		const backendHealthMatch = name.match(
			/^backend\.([^.]+)\.(healthy|connections_open|connections_used)$/,
		);
		if (backendHealthMatch) {
			const beName = backendHealthMatch[1]!;
			const prop = backendHealthMatch[2]!;
			const be = context.backends?.[beName];
			if (prop === "healthy") return be?.is_healthy ?? true;
			return 0;
		}

		// Dynamic director.{name}.healthy variables
		const directorHealthMatch = name.match(/^director\.([^.]+)\.healthy$/);
		if (directorHealthMatch) {
			const dirName = directorHealthMatch[1]!;
			const dir = context.directors?.[dirName];
			if (dir) return true;
			const be = context.backends?.[dirName];
			return be?.is_healthy ?? true;
		}

		// Dynamic ratecounter.{name}.{method}.{window} variables
		const ratecounterMatch = name.match(/^ratecounter\.([^.]+)\.(bucket|rate)\.(\d+s)$/);
		if (ratecounterMatch) {
			return 0;
		}

		return "";
	}

	private evaluateUnaryExpression(expression: VCLUnaryExpression, context: VCLContext): any {
		if (!expression?.operand) {
			logError("Invalid unary expression:", expression);
			return false;
		}
		const operand = this.evaluateExpression(expression.operand, context);
		if (expression.operator === "!") {
			// STRING negation follows condition truthiness: only NOTSET is falsy.
			return !this.isTruthyCondition(operand);
		}
		if (expression.operator === "-") return -operand;
		logError(`Unknown unary operator: ${expression.operator}`);
		return operand;
	}

	private evaluateBinaryExpression(expression: VCLBinaryExpression, context: VCLContext): any {
		if (!expression?.left || !expression?.right) {
			logError("Invalid binary expression:", expression);
			return false;
		}

		// ACL membership: a bare identifier naming a declared ACL on the right of
		// ~ or !~ matches the left value as an IP, wherever the expression appears.
		// A local or subroutine parameter with the same name shadows the ACL.
		if (
			(expression.operator === "~" || expression.operator === "!~") &&
			expression.right.type === "Identifier"
		) {
			const aclName = (expression.right as VCLIdentifier).name;
			const acl = context.acls?.[aclName];
			if (acl && !(context.locals && aclName in context.locals)) {
				const left = this.evaluateExpression(expression.left, context);
				const inAcl = this.isIpInAcl(toRawString(left), acl, context);
				return expression.operator === "~" ? inAcl : !inAcl;
			}
		}

		const left = this.evaluateExpression(expression.left, context);
		const right = this.evaluateExpression(expression.right, context);

		switch (expression.operator) {
			case " ": {
				// String concatenation with NOTSET tracking
				const leftPart = left instanceof VCLConcatResult ? left.parts : [toConcatPart(left)];
				const rightPart = right instanceof VCLConcatResult ? right.parts : [toConcatPart(right)];
				return new VCLConcatResult([...leftPart, ...rightPart]);
			}
			case "+":
			case "-":
			case "*":
			case "/":
			case "%":
				return applyArithmetic(expression.operator, left, right);
			case "==":
				return this.vclEquals(left, right);
			case "!=":
				return !this.vclEquals(left, right);
			case ">":
				return left > right;
			case ">=":
				return left >= right;
			case "<":
				return left < right;
			case "<=":
				return left <= right;
			case "~": {
				const rVal = right instanceof VCLString ? right.value : right;
				return this.regexMatch(toRawString(left), rVal, context, false);
			}
			case "!~": {
				const rVal = right instanceof VCLString ? right.value : right;
				return this.regexMatch(toRawString(left), rVal, context, true);
			}
			case "&&":
				return left && right;
			case "||":
				return left || right;
			default:
				logError(`Unknown operator: ${expression.operator}`);
				return false;
		}
	}

	/**
	 * Equality for the == and != operators.
	 * A STRING left operand drives the comparison: the right side is
	 * stringified per its VCL type and compared byte-wise, matching how
	 * Fastly compiles string equality to VRT_strcmp with the right operand
	 * rendered through the type's to-string conversion.
	 * NOTSET values compare using their display string "(null)".
	 */
	private vclEquals(left: any, right: any): boolean {
		const isStringOperand = (v: any) =>
			typeof v === "string" || v instanceof VCLString || v instanceof VCLConcatResult;
		const notset = (v: any) => isNotSet(v) || (v instanceof VCLConcatResult && v.allNotSet);
		if (notset(left) || notset(right)) {
			// NOTSET renders as "(null)", so an unset header never equals "".
			const display = (v: any) => (v instanceof VCLConcatResult ? v.display() : toDisplayString(v));
			return display(left) === display(right);
		}
		if (isStringOperand(left)) {
			const asString = (v: any) => (v instanceof VCLConcatResult ? v.display() : toRawString(v));
			return asString(left) === (isStringOperand(right) ? asString(right) : vclToString(right));
		}
		if (isNumericValue(left) || isNumericValue(right)) {
			return Number(left) === Number(right);
		}
		return left === right;
	}

	private regexMatch(left: any, right: any, context: VCLContext, negate: boolean): boolean {
		try {
			const regex = right instanceof RegExp ? right : new RegExp(String(right));
			const match = String(left).match(regex);
			if (match) {
				const groups: Record<number, string> = {};
				match.forEach((val, i) => {
					groups[i] = val ?? "";
				});
				context.re = { groups };
				return !negate;
			}
			return negate;
		} catch {
			logError(`Invalid regex pattern: ${right}`);
			return negate;
		}
	}

	private isIpInAcl(ip: string, acl: VCLACL, context: VCLContext): boolean {
		if (context.std?.acl?.check) return context.std.acl.check(ip, acl.name);
		return aclMatch(ip, acl.entries);
	}

	/** Parse header name with optional subfield: "VARS:VALUE" → ["VARS", "VALUE"] */
	private parseSubfield(headerName: string): [string, string | null] {
		const colonIdx = headerName.indexOf(":");
		if (colonIdx === -1) return [headerName, null];
		return [headerName.substring(0, colonIdx), headerName.substring(colonIdx + 1)];
	}

	/** Get a subfield value from a comma-separated key=value dictionary */
	private dictGet(headerValue: string, key: string): string | undefined {
		if (!headerValue) return undefined;
		for (const entry of headerValue.split(",")) {
			const eqIdx = entry.indexOf("=");
			const entryKey = eqIdx === -1 ? entry.trim() : entry.substring(0, eqIdx).trim();
			if (entryKey === key) {
				return eqIdx === -1 ? "" : entry.substring(eqIdx + 1).trim();
			}
		}
		return undefined;
	}

	/** Set a subfield in a comma-separated key=value dictionary */
	private dictSet(headerValue: string, key: string, value: string): string {
		const entries: Array<{ key: string; val: string | null }> = [];
		let _found = false;

		if (headerValue) {
			for (const entry of headerValue.split(",")) {
				const eqIdx = entry.indexOf("=");
				const entryKey = eqIdx === -1 ? entry.trim() : entry.substring(0, eqIdx).trim();
				const entryVal = eqIdx === -1 ? null : entry.substring(eqIdx + 1).trim();
				if (entryKey === key) {
					_found = true;
					// Remove old entry, will re-add at end
				} else if (entryKey) {
					entries.push({ key: entryKey, val: entryVal });
				}
			}
		}

		// Add/re-add the key at the end
		if (value === "") {
			entries.push({ key, val: null });
		} else {
			entries.push({ key, val: value });
		}

		return entries.map((e) => (e.val === null ? e.key : `${e.key}=${e.val}`)).join(",");
	}

	/** Remove a subfield from a comma-separated key=value dictionary */
	private dictUnset(headerValue: string, key: string): string {
		if (!headerValue) return "";
		const entries = headerValue.split(",").filter((entry) => {
			const eqIdx = entry.indexOf("=");
			const entryKey = eqIdx === -1 ? entry.trim() : entry.substring(0, eqIdx).trim();
			return entryKey !== key;
		});
		return entries.join(",");
	}
}
