import { createVCLContext } from "./vcl";
import type {
	VCLAddStatement,
	VCLBinaryExpression,
	VCLCallStatement,
	VCLDeclareStatement,
	VCLEsiStatement,
	VCLErrorStatement,
	VCLExpression,
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
	VCLRemoveStatement,
	VCLRestartStatement,
	VCLReturnStatement,
	VCLSetStatement,
	VCLStatement,
	VCLStringLiteral,
	VCLSubroutine,
	VCLSwitchCase,
	VCLSwitchStatement,
	VCLSyntheticBase64Statement,
	VCLSyntheticStatement,
	VCLTernaryExpression,
	VCLUnaryExpression,
	VCLUnsetStatement,
} from "./vcl-parser";

export interface VCLBackend {
	name: string;
	host: string;
	port: number;
	ssl: boolean;
	connect_timeout: number;
	first_byte_timeout: number;
	between_bytes_timeout: number;
	max_connections: number;
	ssl_cert_hostname?: string;
	ssl_sni_hostname?: string;
	ssl_check_cert?: boolean;
	probe?: VCLProbe;
	is_healthy?: boolean;
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
}

export interface VCLACL {
	name: string;
	entries: VCLACLEntry[];
}

export interface VCLTable {
	name: string;
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
	};
	resp: { status: number; statusText: string; http: Record<string, string> };
	obj: {
		status: number;
		response: string;
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

	// Local variables (declared with "declare local var.xxx TYPE;")
	locals: Record<string, any>;

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
		remove: (queryString: string, paramName: string) => string;
		clean: (queryString: string) => string;
		filter: (queryString: string, paramNames: string[]) => string;
		filter_except: (queryString: string, paramNames: string[]) => string;
		filtersep: (queryString: string, prefix: string, separator: string) => string;
		sort: (queryString: string) => string;
		globfilter: (queryString: string, pattern: string) => string;
		globfilter_except: (queryString: string, pattern: string) => string;
		regfilter: (queryString: string, pattern: string) => string;
		regfilter_except: (queryString: string, pattern: string) => string;
		[key: string]: any;
	};
	uuid?: {
		version3: (namespace: string, name: string) => string;
		version4: () => string;
		version5: (namespace: string, name: string) => string;
		dns: (name: string) => string;
		url: (name: string) => string;
		is_valid: (uuid: string) => boolean;
		is_version3: (uuid: string) => boolean;
		is_version4: (uuid: string) => boolean;
		is_version5: (uuid: string) => boolean;
		decode: (uuid: string) => Uint8Array | null;
		encode: (binary: Uint8Array) => string;
		[key: string]: any;
	};
	waf?: Record<string, any>;
	error?: (status: number, message: string) => string;
	// The std module has many dynamic properties - use a flexible type
	std?: Record<string, any> & {
		log?: (message: string) => void;
		strftime?: (format: string, time: number) => string;
		time?: {
			now: () => number;
			add: (time: number, offset: string | number) => number;
			sub: (time1: number, time2: number) => number;
			is_after: (time1: number, time2: number) => boolean;
			hex_to_time: (hex: string) => number;
		};
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
			hmac_md5: (key: string, message: string) => string;
			hmac_sha1: (key: string, message: string) => string;
			hmac_sha256: (key: string, message: string) => string;
			hmac_sha512: (key: string, message: string) => string;
			hmac_md5_base64: (key: string, message: string) => string;
			hmac_sha1_base64: (key: string, message: string) => string;
			hmac_sha256_base64: (key: string, message: string) => string;
			hmac_sha512_base64: (key: string, message: string) => string;
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
			add_entry: (aclName: string, ip: string, subnet?: number) => boolean;
			remove_entry: (aclName: string, ip: string, subnet?: number) => boolean;
			check: (ip: string, aclName: string) => boolean;
			isIpInCidr?: (ip: string, cidrIp: string, cidrSubnet: number) => boolean;
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
		lookup?: (tables: any, tableName: string, key: string, defaultValue?: string) => string;
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
		add: (time: Date, duration: number) => Date;
		sub: (time1: Date, time2: Date) => number;
		is_after: (time1: Date, time2: Date) => boolean;
		hex_to_time: (hex: string) => Date;
		units: (duration: string) => number;
		runits: (seconds: number) => string;
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
	log: (message: string) => console.log(`[VCL] ${message}`),
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
				console.error(`Invalid regex pattern: ${pattern}`);
				return false;
			}
		},
	},
};

const MAX_RESTARTS = 4;

const TIME_MULTIPLIERS: Record<string, number> = {
	s: 1,
	m: 60,
	h: 60 * 60,
	d: 60 * 60 * 24,
};

function parseTimeValue(value: string): number {
	const str = value.replace(/"/g, "");
	for (const [suffix, multiplier] of Object.entries(TIME_MULTIPLIERS)) {
		if (str.endsWith(suffix)) {
			return (parseInt(str, 10) || 0) * multiplier;
		}
	}
	return parseInt(str, 10) || 0;
}

export class VCLCompiler {
	private program: VCLProgram;

	constructor(program: VCLProgram) {
		this.program = program;
	}

	compile(): VCLSubroutines {
		const subroutines: VCLSubroutines = {};

		// Initialize the context
		const context = createVCLContext();

		// Process ACL declarations
		if (this.program.acls && context.std?.acl) {
			for (const acl of this.program.acls) {
				context.std.acl.add(acl.name);
				for (const entry of acl.entries) {
					context.std.acl.add_entry(acl.name, entry.ip, entry.subnet);
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

		// Compile each subroutine (both vcl_* and custom subs)
		for (const subroutine of this.program.subroutines) {
			subroutines[subroutine.name] = this.compileSubroutine(subroutine, context);
		}

		return subroutines;
	}

	private compileSubroutine(
		subroutine: VCLSubroutine,
		initialContext?: VCLContext,
	): (context: VCLContext) => string {
		return (context: VCLContext) => {
			// Merge the initial context (with ACLs) into the current context
			if (initialContext?.acls) {
				context.acls = { ...initialContext.acls, ...context.acls };
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

				// Create a map of label names to statement indices for goto statements
				const labelMap = new Map<string, number>();

				// First pass: manually look for labels in the raw VCL code
				const vclCode = subroutine.raw || "";
				const labelRegex = /^\s*([a-zA-Z0-9_]+):\s*$/gm;
				let match;

				while ((match = labelRegex.exec(vclCode)) !== null) {
					const labelName = match[1];

					// Find the corresponding statement index
					for (let i = 0; i < statements.length; i++) {
						const stmt = statements[i];
						if (
							stmt &&
							stmt.type === "LabelStatement" &&
							(stmt as VCLLabelStatement).name === labelName
						) {
							labelMap.set(labelName!, i);
							break;
						}
					}
				}

				// Second pass: look for label statements
				for (let i = 0; i < statements.length; i++) {
					const stmt = statements[i];
					if (stmt && stmt.type === "LabelStatement") {
						const labelName = (stmt as VCLLabelStatement).name;
						labelMap.set(labelName, i);
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

					let result = this.executeStatement(statement, context);

					// Handle goto statements
					if (result && typeof result === "string" && result.startsWith("__goto__:")) {
						const labelName = result.substring("__goto__:".length);
						const labelIndex = labelMap.get(labelName);

						if (labelIndex !== undefined) {
							// Jump to the label
							i = labelIndex;

							// Execute the label statement itself if it's a LabelStatement
							const labelStatement = statements[i];
							if (
								i < statements.length &&
								labelStatement &&
								labelStatement.type === "LabelStatement"
							) {
								const labelStmt = labelStatement as VCLLabelStatement;

								// Execute the statement associated with the label, if any
								if (labelStmt.statement) {
									this.executeStatement(labelStmt.statement, context);
								}

								i++;
							}

							// Execute all statements after the label until the next goto or return
							while (i < statements.length) {
								const stmt = statements[i];
								if (!stmt) {
									i++;
									continue;
								}

								// Skip label statements
								if (stmt.type === "LabelStatement") {
									i++;
									continue;
								}

								// Special handling for set statements after labels
								if (stmt.type === "SetStatement") {
									const setStmt = stmt as VCLSetStatement;

									// Execute the set statement
									this.executeSetStatement(setStmt, context);

									// Move to the next statement
									i++;
									continue;
								}

								// Execute the statement
								const stmtResult = this.executeStatement(stmt, context);

								// If the statement returns a value, handle it
								if (stmtResult && typeof stmtResult === "string") {
									if (stmtResult.startsWith("__goto__:")) {
										// Another goto, handle it
										result = stmtResult;
										break;
									} else {
										// Return statement, return from the subroutine
										return stmtResult;
									}
								}

								// Move to the next statement
								i++;

								// If we encounter another label, stop execution
								const nextStmt = statements[i];
								if (i < statements.length && nextStmt && nextStmt.type === "LabelStatement") {
									break;
								}
							}

							// If we have another goto, continue the loop
							if (result && typeof result === "string" && result.startsWith("__goto__:")) {
								continue;
							}

							// Otherwise, continue with the next statement
							continue;
						} else {
							console.error(`Label not found: ${labelName}`);
							// Continue with the next statement
							i++;
							continue;
						}
					}

					// Handle return statements
					if (result && typeof result === "string" && !result.startsWith("__goto__:")) {
						return result;
					}

					// Move to the next statement
					i++;
				}

				const defaultReturns: Record<string, string> = {
					vcl_recv: "lookup",
					vcl_hash: "hash",
					vcl_hit: "fetch",
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
				console.error(`Error executing subroutine ${subroutine.name}:`, error);
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
	}

	private executeStatement(statement: VCLStatement, context: VCLContext): string | undefined {
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
			case "LabelStatement": {
				const labelStmt = statement as VCLLabelStatement;
				if (labelStmt.statement) return this.executeStatement(labelStmt.statement, context);
				return;
			}
			case "DeclareStatement":
				this.executeDeclareStatement(statement as VCLDeclareStatement, context);
				return undefined;
			default:
				return;
		}
	}

	private executeDeclareStatement(statement: VCLDeclareStatement, context: VCLContext): void {
		const typeDefaults: Record<string, any> = {
			STRING: "",
			INTEGER: 0,
			INT: 0,
			FLOAT: 0.0,
			BOOL: false,
			BOOLEAN: false,
			TIME: 0,
			RTIME: 0,
			IP: "0.0.0.0",
		};
		if (!context.locals) context.locals = {};
		// Strip "var." prefix to match how evaluateIdentifier and executeSetStatement resolve var.* names
		const varName = statement.variableName.startsWith("var.")
			? statement.variableName.substring(4)
			: statement.variableName;
		if (statement.initialValue) {
			context.locals[varName] = this.evaluateExpression(
				statement.initialValue,
				context,
			);
		} else {
			context.locals[varName] =
				typeDefaults[statement.variableType.toUpperCase()] ?? "";
		}
	}

	private executeIfStatement(statement: VCLIfStatement, context: VCLContext): string | undefined {
		// Make sure the statement has a test property
		if (!statement.test && statement.condition) {
			statement.test = statement.condition;
		}

		// Check if the test is a binary expression with the ~ operator
		if (
			statement.test &&
			statement.test.type === "BinaryExpression" &&
			(statement.test as VCLBinaryExpression).operator === "~"
		) {
			const binaryExpr = statement.test as VCLBinaryExpression;

			// Check if this is an ACL check (client.ip ~ acl_name)
			if (
				binaryExpr.left &&
				binaryExpr.left.type === "Identifier" &&
				(binaryExpr.left as VCLIdentifier).name === "client.ip" &&
				binaryExpr.right &&
				binaryExpr.right.type === "Identifier"
			) {
				const aclName = (binaryExpr.right as VCLIdentifier).name;
				const clientIp = context.client?.ip || "";

				// Check if the ACL exists in the context
				if (context.acls?.[aclName]) {
					// Use our ACL checking function
					const isInAcl = this.isIpInAcl(clientIp, context.acls[aclName], context);

					if (isInAcl) {
						// Execute the consequent statements
						for (const stmt of statement.consequent) {
							const result = this.executeStatement(stmt, context);

							// If the statement returns a value, return it from the if statement
							if (result && typeof result === "string") {
								return result;
							}
						}

						return;
					} else if (statement.alternate) {
						// Execute the alternate statements
						for (const stmt of statement.alternate) {
							const result = this.executeStatement(stmt, context);

							// If the statement returns a value, return it from the if statement
							if (result && typeof result === "string") {
								return result;
							}
						}

						return;
					}

					return;
				}
			}
		}

		const condition = this.evaluateExpression(statement.test, context);
		const stmts = condition ? statement.consequent : statement.alternate;
		if (stmts) {
			for (const stmt of stmts) {
				const result = this.executeStatement(stmt, context);
				if (result && typeof result === "string") return result;
			}
		}
	}

	private executeReturnStatement(statement: VCLReturnStatement, _context: VCLContext): string {
		return statement.argument;
	}

	private executeErrorStatement(statement: VCLErrorStatement, context: VCLContext): string {
		context.obj = context.obj || {};
		context.obj.status = statement.status;
		context.obj.response = statement.message;
		context.obj.http = context.obj.http || {};

		if (typeof context.error === "function") {
			context.error(statement.status, statement.message);
		}

		const errorSubroutine = this.program.subroutines.find((s) => s.name === "vcl_error");
		if (errorSubroutine) {
			for (const stmt of errorSubroutine.body) {
				this.executeStatement(stmt, context);
			}
		}

		if (context.std && typeof context.std.error === "function") {
			try {
				context.std.error(statement.status, statement.message);
			} catch {}
		}

		return "error";
	}

	private applyCompoundOperator(operator: string, currentValue: any, newValue: any): any {
		const cur = Number(currentValue) || 0;
		const val = Number(newValue) || 0;
		switch (operator) {
			case "=":
				return newValue;
			case "+=":
				if (typeof currentValue === "string" || typeof newValue === "string") {
					return String(currentValue || "") + String(newValue);
				}
				return cur + val;
			case "-=":
				return cur - val;
			case "*=":
				return cur * val;
			case "/=":
				if (val === 0) throw new Error("Division by zero");
				return cur / val;
			case "%=":
				if (val === 0) throw new Error("Modulo by zero");
				return cur % val;
			case "&&=":
				return Boolean(currentValue) && Boolean(newValue);
			case "||=":
				return Boolean(currentValue) || Boolean(newValue);
			case "&=":
				return cur & val;
			case "|=":
				return cur | val;
			case "^=":
				return cur ^ val;
			case "<<=":
				return cur << val;
			case ">>=":
				return cur >> val;
			default:
				return newValue;
		}
	}

	private getTargetValue(target: string, context: VCLContext): any {
		const parts = target.split(".");
		const part0 = parts[0] ?? "";
		const part1 = parts[1] ?? "";

		// Handle HTTP headers (*.http.*)
		if (parts.length >= 3 && part1 === "http") {
			const headerName = parts.slice(2).join(".");
			const httpObjects: Record<string, Record<string, string> | undefined> = {
				req: context.req.http,
				bereq: context.bereq.http,
				beresp: context.beresp.http,
				resp: context.resp.http,
				obj: context.obj.http,
			};
			return httpObjects[part0]?.[headerName];
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

		// Special handling for req.backend - treat identifier values as literal backend names
		let newValue: any;
		if (
			parts.length === 2 &&
			part0 === "req" &&
			part1 === "backend" &&
			statement.value &&
			statement.value.type === "Identifier"
		) {
			// For backend assignments, use the identifier name directly as the backend name
			newValue = (statement.value as VCLIdentifier).name;
		} else {
			newValue = this.evaluateExpression(statement.value, context);
		}

		// For compound operators, get current value and compute result
		let value: any;
		if (operator !== "=") {
			const currentValue = this.getTargetValue(statement.target, context);
			value = this.applyCompoundOperator(operator, currentValue, newValue);
		} else {
			value = newValue;
		}

		if (parts.length >= 3 && part1 === "http") {
			const headerName = parts.slice(2).join(".");
			const httpObjects: Record<string, Record<string, string>> = {
				req: context.req.http,
				bereq: context.bereq.http,
				beresp: context.beresp.http,
				resp: context.resp.http,
				obj: context.obj.http,
			};
			if (httpObjects[part0]) {
				httpObjects[part0]![headerName] = String(value);
			}
		}
		else if (parts.length === 2 && part0 === "req" && part1 === "backend") {
			context.req.backend = String(value);

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
		}
		else if (parts.length === 2 && part0 === "beresp" && part1 === "ttl") {
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
		}
		else if (parts.length >= 2 && part0 === "var") {
			const varName = parts.slice(1).join(".");

			if (!context.locals) {
				context.locals = {};
			}

			context.locals[varName] = value;
		}
		else if (parts.length === 2 && part0 === "req" && part1 === "url") {
			context.req.url = String(value);
		}
		else if (parts.length === 2 && part0 === "bereq" && part1 === "url") {
			context.bereq.url = String(value);
		}
		else if (parts.length === 2 && part0 === "req" && part1 === "method") {
			context.req.method = String(value);
		}
		else if (parts.length === 2 && part0 === "bereq" && part1 === "method") {
			context.bereq.method = String(value);
		}
		else if (parts.length === 2 && part0 === "req" && part1 === "restarts") {
			context.req.restarts = Number(value);
		}
		else if (parts.length === 2 && part0 === "resp" && part1 === "status") {
			context.resp.status = Number(value);
		}
		else if (parts.length === 2 && part0 === "resp" && part1 === "response") {
			context.resp.statusText = String(value);
		}
		else if (parts.length === 2 && part0 === "beresp" && part1 === "status") {
			context.beresp.status = Number(value);
		}
		else if (parts.length === 2 && part0 === "beresp" && part1 === "response") {
			context.beresp.statusText = String(value);
		}
		else if (parts.length === 2 && part0 === "obj" && part1 === "status") {
			context.obj.status = Number(value);
		}
		else if (parts.length === 2 && part0 === "obj" && part1 === "response") {
			context.obj.response = String(value);
		}
		else if (parts.length === 2 && part0 === "obj" && part1 === "ttl") {
			(context.obj as any).ttl = parseTimeValue(String(value));
		}
		else if (parts.length === 2 && part0 === "obj" && part1 === "grace") {
			(context.obj as any).grace = parseTimeValue(String(value));
		}
		else if (parts.length === 2 && part0 === "obj" && part1 === "hits") {
			context.obj.hits = Number(value);
		}
		else if (parts.length === 2 && part0 === "beresp" && part1 === "cacheable") {
			(context.beresp as any).cacheable = Boolean(value);
		}
		else if (parts.length === 2 && part0 === "beresp" && part1 === "do_stream") {
			(context.beresp as any).do_stream = Boolean(value);
		}
		else if (parts.length === 2 && part0 === "beresp" && part1 === "gzip") {
			(context.beresp as any).gzip = Boolean(value);
		}
		else if (parts.length === 2 && part0 === "beresp" && part1 === "brotli") {
			(context.beresp as any).brotli = Boolean(value);
		}
		else if (parts.length === 2 && part0 === "beresp" && part1 === "saintmode") {
			(context.beresp as any).saintmode = parseTimeValue(String(value));
		}
		else if (parts.length === 2 && part0 === "beresp" && part1 === "stale_if_error") {
			(context.beresp as any).stale_if_error = parseTimeValue(String(value));
		}
		else if (parts.length === 2 && part0 === "client" && part1 === "identity") {
			(context.client as any).identity = String(value);
		}
		else if (parts.length === 2 && part0 === "req" && part1 === "hash_always_miss") {
			(context.req as any).hash_always_miss = Boolean(value);
		}
		else if (parts.length === 2 && part0 === "req" && part1 === "hash_ignore_busy") {
			(context.req as any).hash_ignore_busy = Boolean(value);
		}
		else if (parts.length === 2 && part0 === "req" && part1 === "is_ssl") {
			(context.req as any).is_ssl = Boolean(value);
		}
		else if (parts.length === 2 && part0 === "req" && part1 === "esi") {
			(context.req as any).esi = Boolean(value);
		}
		else if (parts.length === 2 && part0 === "req" && part1 === "grace") {
			(context.req as any).grace = parseTimeValue(String(value));
		}
		else if (parts.length === 2 && part0 === "req" && part1 === "max_stale_if_error") {
			(context.req as any).max_stale_if_error = parseTimeValue(String(value));
		}
		else if (parts.length === 2 && part0 === "req" && part1 === "max_stale_while_revalidate") {
			(context.req as any).max_stale_while_revalidate = parseTimeValue(String(value));
		}
		else if (parts.length === 2 && part0 === "bereq" && part1 === "connect_timeout") {
			(context.bereq as any).connect_timeout = parseTimeValue(String(value));
		}
		else if (parts.length === 2 && part0 === "bereq" && part1 === "first_byte_timeout") {
			(context.bereq as any).first_byte_timeout = parseTimeValue(String(value));
		}
		else if (parts.length === 2 && part0 === "bereq" && part1 === "between_bytes_timeout") {
			(context.bereq as any).between_bytes_timeout = parseTimeValue(String(value));
		}
		else if (parts.length >= 2) {
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
			const httpObjects: Record<string, Record<string, string>> = {
				req: context.req.http,
				bereq: context.bereq.http,
				beresp: context.beresp.http,
				resp: context.resp.http,
				obj: context.obj.http,
			};
			const headers = httpObjects[part0];
			if (headers) {
				// Wildcard support: unset req.http.X-*
				if (headerName.includes("*")) {
					const pattern = new RegExp(
						"^" + headerName.replace(/[.*+?^${}()|[\]\\]/g, (m) => (m === "*" ? ".*" : `\\${m}`)) + "$",
						"i",
					);
					for (const key of Object.keys(headers)) {
						if (pattern.test(key)) delete headers[key];
					}
				} else {
					delete headers[headerName];
				}
			}
		}
		else if (parts.length >= 2 && part0 === "var") {
			const varName = parts.slice(1).join(".");
			if (context.locals) delete context.locals[varName];
		}
	}

	private executeLogStatement(statement: VCLLogStatement, context: VCLContext): void {
		console.log(`[VCL] ${this.evaluateExpression(statement.message, context)}`);
	}

	private executeSyntheticStatement(statement: VCLSyntheticStatement, context: VCLContext): void {
		context.obj.http["Content-Type"] = "text/html; charset=utf-8";
		context.obj.response = statement.content;
	}

	private executeSyntheticBase64Statement(
		statement: VCLSyntheticBase64Statement,
		context: VCLContext,
	): void {
		const encoded = this.evaluateExpression(statement.content, context);
		try {
			context.obj.response = Buffer.from(String(encoded), "base64").toString("utf-8");
		} catch {
			context.obj.response = String(encoded);
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
			const httpObjects: Record<string, Record<string, string>> = {
				req: context.req.http,
				bereq: context.bereq.http,
				beresp: context.beresp.http,
				resp: context.resp.http,
				obj: context.obj.http,
			};
			const headers = httpObjects[part0];
			if (headers) {
				const existing = headers[headerName];
				if (existing) {
					// Append with comma separation (standard HTTP multi-value)
					// For Set-Cookie, use newline separation
					const separator = headerName.toLowerCase() === "set-cookie" ? "\n" : ", ";
					headers[headerName] = existing + separator + String(value);
				} else {
					headers[headerName] = String(value);
				}
			}
		}
	}

	private executeCallStatement(statement: VCLCallStatement, context: VCLContext): string | undefined {
		const sub = this.program.subroutines.find((s) => s.name === statement.subroutineName);
		if (!sub) {
			console.error(`Unknown subroutine: ${statement.subroutineName}`);
			return undefined;
		}

		// Set up parameters as local variables
		if (sub.params && statement.arguments.length > 0) {
			if (!context.locals) context.locals = {};
			for (let i = 0; i < sub.params.length && i < statement.arguments.length; i++) {
				const param = sub.params[i]!;
				const argValue = this.evaluateExpression(statement.arguments[i]!, context);
				context.locals[param.name] = argValue;
			}
		}

		// Execute subroutine body
		for (const stmt of sub.body) {
			const result = this.executeStatement(stmt, context);
			if (result && typeof result === "string") {
				// If the custom sub returns a VCL action (deliver, pass, etc.), propagate it
				if (
					["deliver", "pass", "lookup", "fetch", "error", "restart", "pipe", "hash",
					 "deliver_stale", "hit_for_pass"].includes(result)
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
	}

	private executeSwitchStatement(
		statement: VCLSwitchStatement,
		context: VCLContext,
	): string | undefined {
		const subject = this.evaluateExpression(statement.subject, context);
		let matched = false;
		let falling = false;

		for (const switchCase of statement.cases) {
			if (!falling && switchCase.test !== null) {
				const caseValue = this.evaluateExpression(switchCase.test, context);
				if (subject === caseValue) {
					matched = true;
				}
			}

			if (matched || falling || switchCase.test === null) {
				if (!matched && switchCase.test === null && !falling) {
					// default case, only execute if nothing matched
					matched = true;
				}
				if (matched || falling) {
					for (const stmt of switchCase.body) {
						const result = this.executeStatement(stmt, context);
						if (result && typeof result === "string") return result;
					}
					if (switchCase.fallthrough) {
						falling = true;
					} else {
						return undefined;
					}
				}
			}
		}
		return undefined;
	}

	private executeHashDataStatement(statement: VCLHashDataStatement, context: VCLContext): void {
		const value = this.evaluateExpression(statement.value, context);
		const crypto = require("node:crypto");
		const hash = crypto.createHash("md5").update(String(value)).digest("hex");
		if (!context.hashData) context.hashData = [];
		context.hashData.push(hash);
	}

	private executeGotoStatement(statement: VCLGotoStatement, _context: VCLContext): string {
		return `__goto__:${statement.label}`;
	}

	private executeRestartStatement(_statement: VCLRestartStatement, context: VCLContext): string {
		if (context.req.restarts === undefined) context.req.restarts = 0;
		if (context.req.restarts >= MAX_RESTARTS) {
			throw new Error(`Max restarts (${MAX_RESTARTS}) exceeded`);
		}
		context.req.restarts++;
		return "restart";
	}

	private evaluateExpression(expression: VCLExpression, context: VCLContext): any {
		if (!expression || !expression.type) return null;

		switch (expression.type) {
			case "StringLiteral":
				return (expression as VCLStringLiteral).value;
			case "NumberLiteral":
				return (expression as VCLNumberLiteral).value;
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

	private evaluateTernaryExpression(expression: VCLTernaryExpression, context: VCLContext): any {
		const condition = this.evaluateExpression(expression.condition, context);
		return this.evaluateExpression(condition ? expression.trueExpr : expression.falseExpr, context);
	}

	private evaluateFunctionCall(expression: VCLFunctionCall, context: VCLContext): any {
		const functionName = expression.name;
		const args = expression.arguments.map((arg) => this.evaluateExpression(arg, context));

		const prefixModules: Record<string, any> = {
			"addr.": context.addr,
			"accept.": context.accept,
			"bin.": context.bin,
			"querystring.": context.querystring,
			"uuid.": context.uuid,
			"waf.": context.waf,
			"testing.": (context as any).testing,
			"assert.": (context as any).assert,
		};

		for (const [prefix, module] of Object.entries(prefixModules)) {
			if (functionName.startsWith(prefix) && module) {
				const fn = functionName.substring(prefix.length);
				if (typeof module[fn] === "function") return module[fn](...args);
			}
		}

		if (functionName === "std.log") {
			console.log(`[VCL] ${args[0]}`);
			return null;
		}

		if (functionName.startsWith("digest.") && context.std?.digest) {
			const fn = functionName.substring(7);
			const digestModule = context.std.digest as Record<string, Function>;
			if (typeof digestModule[fn] === "function") return digestModule[fn](...args);
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
				const str = String(args[0]);
				const offset = parseInt(args[1], 10);
				if (args.length >= 3) {
					const length = parseInt(args[2], 10);
					return str.substring(offset, offset + length);
				} else {
					return str.substring(offset);
				}
			}
		} else if (functionName === "regsub") {
			if (args.length === 3) {
				try {
					const regex = new RegExp(args[1]);
					return String(args[0]).replace(regex, args[2]);
				} catch (e) {
					console.error(`Invalid regex pattern: ${args[1]}`, e);
					return args[0];
				}
			}
		} else if (functionName === "regsuball") {
			if (args.length === 3) {
				try {
					const regex = new RegExp(args[1], "g");
					return String(args[0]).replace(regex, args[2]);
				} catch (e) {
					console.error(`Invalid regex pattern: ${args[1]}`, e);
					return args[0];
				}
			}
		} else if (functionName.startsWith("math.")) {
			const fn = functionName.substring(5);
			const mathModule = context.math as Record<string, Function> | undefined;
			if (mathModule && typeof mathModule[fn] === "function") return mathModule[fn](...args);
		} else if (functionName.startsWith("table.")) {
			const fn = functionName.substring(6);
			const tableModule = context.table as Record<string, Function> | undefined;
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
			const timeModule = context.time as Record<string, Function> | undefined;
			if (timeModule && typeof timeModule[fn] === "function") return timeModule[fn](...args);
		} else if (functionName.startsWith("header.")) {
			const fn = functionName.substring(7);
			const headerModule = context.header as Record<string, Function> | undefined;
			if (headerModule && typeof headerModule[fn] === "function") return headerModule[fn](...args);
		} else if (functionName.startsWith("ratelimit.")) {
			const fn = functionName.substring(10);
			if (context.rateLimitModule && typeof context.rateLimitModule[fn] === "function") {
				return context.rateLimitModule[fn](...args);
			}
		} else if (functionName === "strftime" && context.strftime) {
			return context.strftime(args[0] as string, args[1] as Date);
		} else if (functionName === "parse_time_delta" && context.parse_time_delta) {
			return context.parse_time_delta(args[0] as string);
		} else if (functionName === "urlencode") {
			return encodeURIComponent(String(args[0]));
		} else if (functionName === "urldecode") {
			try {
				return decodeURIComponent(String(args[0]).replace(/\+/g, " "));
			} catch {
				return String(args[0]);
			}
		} else if (
			functionName === "json.escape" ||
			functionName === "json_escape" ||
			functionName === "cstr_escape"
		) {
			return String(args[0])
				.replace(/\\/g, "\\\\")
				.replace(/"/g, '\\"')
				.replace(/\n/g, "\\n")
				.replace(/\r/g, "\\r")
				.replace(/\t/g, "\\t");
		} else if (functionName === "xml_escape") {
			return String(args[0])
				.replace(/&/g, "&amp;")
				.replace(/</g, "&lt;")
				.replace(/>/g, "&gt;")
				.replace(/"/g, "&quot;")
				.replace(/'/g, "&#39;");
		} else if (functionName === "boltsort.sort") {
			const url = String(args[0]);
			const qIdx = url.indexOf("?");
			if (qIdx === -1) return url;
			const base = url.substring(0, qIdx);
			const query = url.substring(qIdx + 1);
			const params = query.split("&").filter((p) => p.length > 0);
			params.sort((a, b) => (a.split("=")[0] || "").localeCompare(b.split("=")[0] || ""));
			return `${base}?${params.join("&")}`;
		} else if (functionName === "subfield") {
			const str = String(args[0]);
			const name = String(args[1]);
			const sep = args.length > 2 ? String(args[2]) : ";";
			const parts = str.split(sep).map((p) => p.trim());
			for (const part of parts) {
				const eqIdx = part.indexOf("=");
				if (eqIdx === -1) {
					if (part.trim() === name) return "";
				} else {
					const key = part.substring(0, eqIdx).trim();
					const value = part.substring(eqIdx + 1).trim();
					if (key === name) {
						if (
							(value.startsWith('"') && value.endsWith('"')) ||
							(value.startsWith("'") && value.endsWith("'"))
						) {
							return value.substring(1, value.length - 1);
						}
						return value;
					}
				}
			}
			return "";
		} else if (functionName === "randombool" || functionName === "randombool_seeded") {
			const numerator = Number(args[0]) || 1;
			const denominator = Number(args[1]) || 2;
			if (context.std?.random?.bool) return context.std.random.bool(numerator, denominator);
			return Math.random() < numerator / denominator;
		} else if (functionName === "randomint") {
			const [from, to] = [Math.floor(Number(args[0])), Math.floor(Number(args[1]))];
			return Math.floor(Math.random() * (to - from)) + from;
		} else if (functionName === "randomint_seeded") {
			const [from, to] = [Math.floor(Number(args[1])), Math.floor(Number(args[2]))];
			return Math.floor(Math.random() * (to - from)) + from;
		} else if (functionName === "randomstr") {
			const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
			return Array.from(
				{ length: Math.max(0, Math.floor(Number(args[0]))) },
				() => chars[Math.floor(Math.random() * chars.length)],
			).join("");
		} else if (functionName.startsWith("setcookie.")) {
			const cookieFunction = functionName.substring(10);
			if (cookieFunction === "get_value_by_name") {
				const header = String(args[0]);
				const name = String(args[1]);
				const cookies = header.split(",").map((c) => c.trim());
				for (const cookie of cookies) {
					const cookieParts = cookie.split(";")[0] ?? "";
					const eqIdx = cookieParts.indexOf("=");
					if (eqIdx !== -1) {
						const key = cookieParts.substring(0, eqIdx).trim();
						const value = cookieParts.substring(eqIdx + 1).trim();
						if (key === name) return value;
					}
				}
				return "";
			} else if (cookieFunction === "delete_by_name") {
				const header = String(args[0]);
				const name = String(args[1]);
				const cookies = header.split(",").map((c) => c.trim());
				const filtered = cookies.filter((cookie) => {
					const cookieParts = cookie.split(";")[0] ?? "";
					const eqIdx = cookieParts.indexOf("=");
					if (eqIdx !== -1) {
						const key = cookieParts.substring(0, eqIdx).trim();
						return key !== name;
					}
					return true;
				});
				return filtered.join(", ");
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
			return require("node:crypto").createHash("sha256").update(String(args[0])).digest("hex");
		} else if (functionName === "fastly.try_select_shield") {
			return false;
		} else if (functionName === "h2.push") {
			return null;
		} else if (functionName === "h2.disable_header_compression") {
			return null;
		} else if (functionName === "h3.alt_svc") {
			return null;
		} else if (functionName.startsWith("crypto.")) {
			const fn = functionName.substring(7);
			const cryptoModule = context.std?.crypto as Record<string, Function> | undefined;
			if (cryptoModule && typeof cryptoModule[fn] === "function") return cryptoModule[fn](...args);
		}

		console.error(`Unknown function call: ${functionName}`);
		return null;
	}

	private evaluateIdentifier(identifier: VCLIdentifier, context: VCLContext): any {
		const name = identifier.name;
		const parts = name.split(".");

		const idPart0 = parts[0] ?? "";
		const idPart1 = parts[1] ?? "";
		const idPart2 = parts[2] ?? "";

		if (name === "now") return Date.now();
		if (name === "now.sec") return Math.floor(Date.now() / 1000);

		if (parts.length >= 3 && idPart1 === "http") {
			const headerName = parts.slice(2).join(".");
			const httpObjects: Record<string, Record<string, string> | undefined> = {
				req: context.req.http,
				bereq: context.bereq.http,
				beresp: context.beresp.http,
				resp: context.resp.http,
				obj: context.obj.http,
			};
			return httpObjects[idPart0]?.[headerName] ?? "";
		}

		if (parts.length === 3 && idPart0 === "re" && idPart1 === "group") {
			const groupNumber = parseInt(idPart2, 10);
			if (!Number.isNaN(groupNumber) && context.re?.groups?.[groupNumber] !== undefined) {
				return context.re.groups[groupNumber];
			}
			return "";
		}

		if (parts.length >= 2 && idPart0 === "var") {
			const varName = parts.slice(1).join(".");
			return context.locals?.[varName] ?? "";
		}

		if (context.locals && name in context.locals) {
			return context.locals[name];
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
			const lastSlash = path.lastIndexOf("/");
			return lastSlash >= 0 ? path.substring(lastSlash + 1) : path;
		}
		if (name === "req.url.dirname") {
			const path = this.resolveVariable("req.url.path", context) as string;
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
		if (name === "req.grace") return ctx.req?.grace ?? 0;
		if (name === "req.max_stale_if_error") return ctx.req?.max_stale_if_error ?? 0;
		if (name === "req.max_stale_while_revalidate") return ctx.req?.max_stale_while_revalidate ?? 0;
		if (name === "req.xid") return ctx.req?.xid || "0";
		if (name === "req.enable_range_on_pass") return false;
		if (name === "req.enable_segmented_caching") return false;
		if (name === "req.digest") return ctx.req?.digest || "";
		if (name === "req.digest.ratio") return ctx.req?.digest_ratio ?? 0;
		if (name === "req.bytes_read") return 0;
		if (name === "req.header_bytes_read") return 0;
		if (name === "req.body_bytes_read") return 0;
		if (name === "req.topurl") return context.req.url;
		if (name.startsWith("req.backend.")) {
			const prop = name.substring(12);
			const be = context.current_backend || context.backends?.[context.req.backend || "default"];
			if (!be) return "";
			const beProps: Record<string, any> = {
				name: be.name, ip: be.host, port: be.port, healthy: be.is_healthy ?? true,
				is_cluster: false, is_origin: true, is_shield: false,
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
		if (name === "bereq.connect_timeout") return ctx.bereq?.connect_timeout ?? 1000;
		if (name === "bereq.first_byte_timeout") return ctx.bereq?.first_byte_timeout ?? 15000;
		if (name === "bereq.between_bytes_timeout") return ctx.bereq?.between_bytes_timeout ?? 10000;
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
		if (name === "beresp.cacheable") return ctx.beresp?.cacheable ?? true;
		if (name === "beresp.do_esi") return context.beresp.do_esi ?? false;
		if (name === "beresp.do_stream") return ctx.beresp?.do_stream ?? false;
		if (name === "beresp.gzip") return ctx.beresp?.gzip ?? false;
		if (name === "beresp.brotli") return ctx.beresp?.brotli ?? false;
		if (name === "beresp.saintmode") return ctx.beresp?.saintmode ?? 0;
		if (name === "beresp.hipaa") return false;
		if (name === "beresp.pci") return false;
		if (name.startsWith("beresp.backend.")) {
			const prop = name.substring(15);
			const be = context.current_backend || context.backends?.[context.req.backend || "default"];
			if (!be) return "";
			const beProps: Record<string, any> = {
				name: be.name, ip: be.host, port: be.port, src_ip: "127.0.0.1", src_port: 0, requests: 0,
			};
			return beProps[prop] ?? "";
		}

		// resp.* variables
		if (name === "resp.status") return context.resp.status;
		if (name === "resp.response") return context.resp.statusText;
		if (name === "resp.proto") return ctx.resp?.proto || "HTTP/1.1";
		if (name === "resp.is_locally_generated") return ctx.resp?.is_locally_generated ?? false;
		if (name === "resp.completed") return ctx.resp?.completed ?? false;
		if (name === "resp.stale") return ctx.resp?.stale ?? false;
		if (name === "resp.stale.is_error") return false;
		if (name === "resp.stale.is_revalidating") return false;
		if (name === "resp.bytes_written") return 0;
		if (name === "resp.header_bytes_written") return 0;
		if (name === "resp.body_bytes_written") return 0;

		// obj.* variables
		if (name === "obj.status") return context.obj.status;
		if (name === "obj.response") return context.obj.response;
		if (name === "obj.proto") return "HTTP/1.1";
		if (name === "obj.hits") return context.obj.hits;
		if (name === "obj.ttl") return ctx.obj?.ttl ?? 0;
		if (name === "obj.age") return ctx.obj?.age ?? 0;
		if (name === "obj.grace") return ctx.obj?.grace ?? 0;
		if (name === "obj.lastuse") return ctx.obj?.lastuse ?? 0;
		if (name === "obj.entered") return ctx.obj?.entered ?? Date.now();
		if (name === "obj.cacheable") return ctx.obj?.cacheable ?? true;
		if (name === "obj.is_pci") return false;
		if (name === "obj.stale_if_error") return ctx.obj?.stale_if_error ?? 0;
		if (name === "obj.stale_while_revalidate") return ctx.obj?.stale_while_revalidate ?? 0;

		// client.* variables
		if (name === "client.ip") return context.client?.ip || "127.0.0.1";
		if (name === "client.port") return ctx.client?.port ?? 0;
		if (name === "client.identity") return ctx.client?.identity || context.client?.ip || "127.0.0.1";
		if (name === "client.requests") return ctx.client?.requests ?? 1;
		if (name === "client.identified") return false;
		if (name === "client.sess_timeout") return 0;
		if (name.startsWith("client.geo.")) {
			const geoProp = name.substring(11);
			const geo = ctx.client?.geo || {};
			const defaults: Record<string, any> = {
				city: "", "city.ascii": "", "city.latin1": "", "city.utf8": "",
				country_code: "US", country_code3: "USA",
				country_name: "United States", "country_name.ascii": "United States",
				continent_code: "NA", latitude: 37.7749, longitude: -122.4194,
				postal_code: "", metro_code: 0, area_code: 0, region: "",
				"region.ascii": "", "region.latin1": "", "region.utf8": "",
				gmt_offset: -800, utc_offset: -800,
				conn_speed: "broadband", conn_type: "wired",
				ip_override: "", proxy_description: "", proxy_type: "",
			};
			return geo[geoProp] ?? defaults[geoProp] ?? "";
		}
		if (name.startsWith("client.as.")) {
			const prop = name.substring(10);
			return prop === "number" ? 0 : "";
		}
		if (name.startsWith("client.browser.")) return ctx.client?.browser?.[name.substring(15)] ?? "";
		if (name.startsWith("client.os.")) return ctx.client?.os?.[name.substring(10)] ?? "";
		if (name === "client.bot.name") return "";
		if (name.startsWith("client.class.")) return false;
		if (name.startsWith("client.platform.")) {
			if (name === "client.platform.hwtype") return "";
			return false;
		}
		if (name.startsWith("client.display.")) {
			if (name === "client.display.touchscreen") return false;
			return 0;
		}
		if (name.startsWith("client.socket.")) return 0;

		// server.* variables
		if (name === "server.hostname") return ctx.server?.hostname || require("node:os").hostname();
		if (name === "server.identity") return ctx.server?.identity || "localhost";
		if (name === "server.datacenter") return ctx.server?.datacenter || "local";
		if (name === "server.region") return ctx.server?.region || "local";
		if (name === "server.pop") return ctx.server?.pop || "local";
		if (name === "server.billing_region") return ctx.server?.billing_region || "local";
		if (name === "server.ip") return ctx.server?.ip || "127.0.0.1";
		if (name === "server.port") return ctx.server?.port ?? 8000;

		// fastly.* variables
		if (name === "fastly.error") return context.fastly?.error || "";
		if (name === "fastly.is_staging") return false;
		if (name === "fastly.ddos_detected") return false;
		if (name.startsWith("fastly.ff.")) return 0;

		// fastly_info.* variables
		if (name === "fastly_info.state") return context.fastly?.state || "";
		if (name === "fastly_info.is_h2") return false;
		if (name === "fastly_info.is_h3") return false;
		if (name === "fastly_info.is_cluster_edge") return false;
		if (name === "fastly_info.is_cluster_shield") return false;
		if (name === "fastly_info.edge.is_tls") return false;
		if (name === "fastly_info.host_header") return context.req.http["Host"] || "";
		if (name === "fastly_info.request_id") return ctx.fastly_info?.request_id || "local-req-id";
		if (name.startsWith("fastly_info.h2.")) return 0;

		// time.* variables
		if (name === "time.start" || name === "time.start.sec") return Math.floor(Date.now() / 1000);
		if (name === "time.start.msec") return Date.now();
		if (name === "time.start.usec") return Date.now() * 1000;
		if (name === "time.start.msec_frac") return Date.now() % 1000;
		if (name === "time.start.usec_frac") return (Date.now() * 1000) % 1000000;
		if (name === "time.elapsed" || name === "time.elapsed.sec") return 0;
		if (name === "time.elapsed.msec") return 0;
		if (name === "time.elapsed.usec") return 0;
		if (name === "time.end" || name === "time.end.sec") return Math.floor(Date.now() / 1000);
		if (name === "time.to_first_byte") return 0;

		// tls.client.* variables
		if (name === "tls.client.protocol") return ctx.tls?.client?.protocol || "";
		if (name === "tls.client.cipher") return ctx.tls?.client?.cipher || "";
		if (name === "tls.client.servername") return ctx.tls?.client?.servername || "";
		if (name === "tls.client.ja3_md5") return "";
		if (name === "tls.client.ja4") return "";
		if (name.startsWith("tls.client.certificate.")) {
			const prop = name.substring(23);
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
		if (name === "waf.rule_id") return "";
		if (name === "waf.severity") return 0;
		if (name === "waf.message") return "";
		if (name === "waf.logdata") return "";
		if (name === "waf.counter") return 0;
		if (name === "waf.inbound_anomaly_score") return 0;

		// geoip.* legacy variables (alias for client.geo.*)
		if (name.startsWith("geoip.")) {
			const prop = name.substring(6);
			if (prop === "use_x_forwarded_for") return false;
			return this.resolveVariable("client.geo." + prop, context);
		}

		// math.* constants
		const mathConstants: Record<string, number> = {
			"math.PI": Math.PI, "math.E": Math.E, "math.TAU": 2 * Math.PI,
			"math.PHI": (1 + Math.sqrt(5)) / 2,
			"math.1_PI": 1 / Math.PI, "math.2_PI": 2 / Math.PI,
			"math.2_SQRTPI": 2 / Math.sqrt(Math.PI),
			"math.SQRT2": Math.SQRT2, "math.SQRT1_2": Math.SQRT1_2,
			"math.LN2": Math.LN2, "math.LN10": Math.LN10,
			"math.LOG2E": Math.LOG2E, "math.LOG10E": Math.LOG10E,
			"math.NEG_INFINITY": -Infinity, "math.POS_INFINITY": Infinity,
			"math.NAN": NaN,
			"math.FLOAT_MAX": Number.MAX_VALUE, "math.FLOAT_MIN": Number.MIN_VALUE,
			"math.FLOAT_EPSILON": Number.EPSILON,
			"math.INTEGER_MAX": 2147483647, "math.INTEGER_MIN": -2147483648,
		};
		if (mathConstants[name] !== undefined) return mathConstants[name];

		// workspace.* variables
		if (name === "workspace.bytes_free") return 262144;
		if (name === "workspace.bytes_total") return 262144;
		if (name === "workspace.overflowed") return false;

		// transport.* variables
		if (name === "transport.type") return "http";
		if (name === "transport.bw_estimate") return 0;

		// segmented_caching.* variables
		if (name.startsWith("segmented_caching.")) return 0;

		// esi.* variables
		if (name === "esi.allow_inside_cdata") return false;

		// stale.exists
		if (name === "stale.exists") return false;

		// quic.* variables
		if (name.startsWith("quic.")) return 0;

		// backend.socket.* variables
		if (name.startsWith("backend.socket.")) return 0;
		if (name.startsWith("backend.conn.")) return false;

		return "";
	}

	private evaluateUnaryExpression(expression: VCLUnaryExpression, context: VCLContext): any {
		if (!expression?.operand) {
			console.error("Invalid unary expression:", expression);
			return false;
		}
		const operand = this.evaluateExpression(expression.operand, context);
		if (expression.operator === "!") return !operand;
		if (expression.operator === "-") return -operand;
		console.error(`Unknown unary operator: ${expression.operator}`);
		return operand;
	}

	private evaluateBinaryExpression(expression: VCLBinaryExpression, context: VCLContext): any {
		if (!expression?.left || !expression?.right) {
			console.error("Invalid binary expression:", expression);
			return false;
		}

		const left = this.evaluateExpression(expression.left, context);
		const right = this.evaluateExpression(expression.right, context);

		switch (expression.operator) {
			case " ":
				return String(left) + String(right);
			case "+":
				return left + right;
			case "-":
				return left - right;
			case "*":
				return left * right;
			case "/":
				return left / right;
			case "%":
				return left % right;
			case "==":
				return left === right;
			case "!=":
				return left !== right;
			case ">":
				return left > right;
			case ">=":
				return left >= right;
			case "<":
				return left < right;
			case "<=":
				return left <= right;
			case "~":
				if (typeof right === "string" && context.acls?.[right]) {
					return this.isIpInAcl(String(left), context.acls[right], context);
				}

				return this.regexMatch(left, right, context, false);
			case "!~":
				if (typeof right === "string" && context.acls?.[right]) {
					return !this.isIpInAcl(String(left), context.acls[right], context);
				}
				return this.regexMatch(left, right, context, true);
			case "&&":
				return left && right;
			case "||":
				return left || right;
			default:
				console.error(`Unknown operator: ${expression.operator}`);
				return false;
		}
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
			console.error(`Invalid regex pattern: ${right}`);
			return negate;
		}
	}

	private isIpInAcl(ip: string, acl: VCLACL, context: VCLContext): boolean {
		if (context.std?.acl?.check) return context.std.acl.check(ip, acl.name);

		for (const entry of acl.entries) {
			if (entry.subnet) {
				const checkFn = context.std?.acl?.isIpInCidr ?? this.isIpInCidr.bind(this);
				if (checkFn(ip, entry.ip, entry.subnet)) return true;
			} else if (ip === entry.ip) {
				return true;
			}
		}
		return false;
	}

	private isIpInCidr(ip: string, cidrIp: string, cidrSubnet: number): boolean {
		try {
			const ipType = this.getIPType(ip);
			const cidrType = this.getIPType(cidrIp);

			if (!ipType || !cidrType || ipType !== cidrType) {
				console.error(
					`IP type mismatch or invalid IP: ${ip} (${ipType}) vs ${cidrIp} (${cidrType})`,
				);
				return false;
			}

			const maxSubnet = ipType === "ipv4" ? 32 : 128;
			if (cidrSubnet < 0 || cidrSubnet > maxSubnet) {
				console.error(`Invalid ${ipType} subnet mask: ${cidrSubnet}`);
				return false;
			}

			const toBinary =
				ipType === "ipv4" ? this.ipv4ToBinary.bind(this) : this.ipv6ToBinary.bind(this);
			const ipBinary = toBinary(ip);
			const cidrBinary = toBinary(cidrIp);

			return !!(
				ipBinary &&
				cidrBinary &&
				ipBinary.substring(0, cidrSubnet) === cidrBinary.substring(0, cidrSubnet)
			);
		} catch (e) {
			console.error(`Error checking CIDR match: ${e}`);
			return false;
		}
	}

	private getIPType(ip: string): "ipv4" | "ipv6" | null {
		if (ip.includes(".") && !ip.includes(":")) {
			const parts = ip.split(".");
			if (
				parts.length === 4 &&
				parts.every((p) => {
					const n = parseInt(p, 10);
					return !Number.isNaN(n) && n >= 0 && n <= 255;
				})
			) {
				return "ipv4";
			}
		} else if (ip.includes(":")) {
			const doubleColonCount = (ip.match(/::/g) || []).length;
			if (doubleColonCount > 1) return null;
			const parts = ip.split(":");
			if (parts.length > 8) return null;
			if (parts.every((p) => p === "" || /^[0-9A-Fa-f]{1,4}$/.test(p))) return "ipv6";
		}
		return null;
	}

	private ipv4ToBinary(ip: string): string {
		try {
			const octets = ip.split(".");
			if (octets.length !== 4) return "";
			return octets
				.map((o) => {
					const n = parseInt(o, 10);
					return Number.isNaN(n) || n < 0 || n > 255 ? "" : n.toString(2).padStart(8, "0");
				})
				.join("");
		} catch {
			return "";
		}
	}

	private ipv6ToBinary(ip: string): string {
		try {
			const normalized = this.normalizeIPv6(ip);
			if (!normalized) return "";
			return normalized
				.split(":")
				.map((s) => {
					const n = parseInt(s, 16);
					return Number.isNaN(n) || n < 0 || n > 65535 ? "" : n.toString(2).padStart(16, "0");
				})
				.join("");
		} catch {
			return "";
		}
	}

	private normalizeIPv6(ip: string): string {
		try {
			if (ip.includes("::")) {
				const parts = ip.split("::");
				if (parts.length !== 2) return "";
				const left = parts[0] ? parts[0].split(":") : [];
				const right = parts[1] ? parts[1].split(":") : [];
				const missing = 8 - (left.length + right.length);
				if (missing < 0) return "";
				ip = [...left, ...Array(missing).fill("0"), ...right].join(":");
			}
			const segments = ip.split(":");
			if (segments.length !== 8) return "";
			return segments.map((s) => s.padStart(4, "0")).join(":");
		} catch {
			return "";
		}
	}
}
