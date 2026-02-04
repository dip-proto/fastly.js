import { existsSync, readFileSync } from "node:fs";
import { AcceptModule } from "./vcl-accept";
import { AddressModule } from "./vcl-address";
import { BinaryModule } from "./vcl-binary";
import { VCLCompiler, type VCLContext, type VCLSubroutines } from "./vcl-compiler";

// Re-export types
export type { VCLContext, VCLSubroutines };

import { CryptoModule, DigestModule } from "./vcl-digest";
import { processESI } from "./vcl-esi";
import { createHeaderModule } from "./vcl-header";
import { createMathModule } from "./vcl-math";
import { VCLLexer } from "./vcl-parser";
import { VCLParser } from "./vcl-parser-impl";
import { QueryStringModule } from "./vcl-querystring";
import { RateLimitModule } from "./vcl-ratelimit";
import { createStdModule } from "./vcl-std";
import { createTableModule } from "./vcl-table";
import { createParseTimeDelta, createStrftime, createTimeModule } from "./vcl-time";
import { UUIDModule } from "./vcl-uuid";
import { WAFModule } from "./vcl-waf";

export function loadVCLContent(content: string): VCLSubroutines {
	try {
		const lexer = new VCLLexer(content);
		const tokens = lexer.tokenize();
		const parser = new VCLParser(tokens, content);
		const ast = parser.parse();
		const compiler = new VCLCompiler(ast);
		return compiler.compile();
	} catch (error) {
		const err = error as Error;
		console.error(`Error loading VCL content: ${err.message}`);
		console.error(err.stack);
		throw error;
	}
}

export function loadVCL(filePath: string): VCLSubroutines {
	if (!existsSync(filePath)) {
		throw new Error(`VCL file not found: ${filePath}`);
	}
	const content = readFileSync(filePath, "utf-8");
	return loadVCLContent(content);
}

export function executeVCLByName(
	subroutines: VCLSubroutines,
	name: string,
	context: VCLContext,
): string {
	if (!subroutines[name]) {
		return "";
	}

	try {
		const result = subroutines[name]!(context) || "";

		if (name === "vcl_deliver" && context.beresp.do_esi && context.obj.response) {
			const contentType = context.resp.http["Content-Type"] || "";
			if (contentType.includes("text/html")) {
				context.obj.response = processESI(context.obj.response, context);
			}
		}

		return result;
	} catch (error) {
		const err = error as Error;
		console.error(`Error executing subroutine ${name}: ${err.message}`);
		return "";
	}
}

export function createVCLContext(): VCLContext {
	const context: VCLContext = {
		req: {
			url: "",
			method: "",
			http: {},
			backend: "default",
			restarts: 0,
		},
		bereq: {
			url: "",
			method: "",
			http: {},
		},
		beresp: {
			status: 0,
			statusText: "",
			http: {},
			ttl: 0,
			grace: 0,
			stale_while_revalidate: 0,
			do_esi: false,
		},
		resp: {
			status: 0,
			statusText: "",
			http: {},
		},
		obj: {
			status: 0,
			response: "",
			http: {},
			hits: 1,
		},
		cache: new Map(),
		hashData: [],
		locals: {},
		backends: {
			default: {
				name: "default",
				host: "perdu.com",
				port: 443,
				ssl: true,
				connect_timeout: 1000,
				first_byte_timeout: 15000,
				between_bytes_timeout: 10000,
				max_connections: 200,
				is_healthy: true,
			},
		},
		directors: {},
		acls: {},
		tables: {},
		client: {
			ip: "127.0.0.1",
		},
		current_backend: undefined,
		waf: {
			allowed: false,
			blocked: false,
			blockStatus: 0,
			blockMessage: "",
		},
		ratelimit: {
			counters: {},
			penaltyboxes: {},
		},
		fastly: {
			error: "",
			state: "recv",
		},
	};

	const TIME_UNITS: Record<string, number> = {
		s: 1000,
		m: 60 * 1000,
		h: 60 * 60 * 1000,
		d: 24 * 60 * 60 * 1000,
	};

	function parseTimeOffset(offset: string | number): number {
		if (typeof offset === "number") return offset;

		let isNegative = false;
		if (offset.startsWith("-")) {
			isNegative = true;
			offset = offset.substring(1);
		}

		const match = offset.match(/^(\d+)([smhd])$/);
		let offsetMs: number;
		if (match) {
			const value = parseInt(match[1] ?? "0", 10);
			const unit = match[2] ?? "s";
			offsetMs = value * (TIME_UNITS[unit] || 0);
		} else {
			offsetMs = parseInt(offset, 10);
			if (Number.isNaN(offsetMs)) {
				console.error(`Invalid time offset: ${offset}`);
				return 0;
			}
		}

		return isNegative ? -offsetMs : offsetMs;
	}

	context.std = {
		log: (message: string) => {
			console.log(`[VCL] ${message}`);
		},

		strftime: (_format: string, time: number) => new Date(time).toISOString(),

		time: {
			now: () => Date.now(),
			add: (time: number, offset: string | number): number => {
				const offsetMs = parseTimeOffset(offset);
				return offsetMs === 0 && typeof offset === "string" ? time : time + offsetMs;
			},
			sub: (time1: number, time2: number): number => time1 - time2,
			is_after: (time1: number, time2: number): boolean => time1 > time2,
			hex_to_time: (hex: string): number => {
				if (!hex.match(/^[0-9A-Fa-f]+$/)) {
					console.error(`Invalid hex timestamp: ${hex}`);
					return Date.now();
				}
				const timestamp = parseInt(hex, 16);
				if (Number.isNaN(timestamp)) {
					console.error(`Invalid hex timestamp: ${hex}`);
					return Date.now();
				}
				return timestamp * 1000;
			},
		},

		tolower: (str: string) => String(str).toLowerCase(),
		toupper: (str: string) => String(str).toUpperCase(),
		strlen: (str: string) => String(str).length,
		strstr: (haystack: string, needle: string) => {
			const index = String(haystack).indexOf(String(needle));
			return index >= 0 ? String(haystack).substring(index) : null;
		},
		substr: (str: string, offset: number, length?: number) => {
			const s = String(str);
			return length !== undefined ? s.substring(offset, offset + length) : s.substring(offset);
		},
		prefixof: (str: string, prefix: string) => String(str).startsWith(String(prefix)),
		suffixof: (str: string, suffix: string) => String(str).endsWith(String(suffix)),
		replace: (str: string, search: string, replacement: string) =>
			String(str).replace(String(search), String(replacement)),
		replaceall: (str: string, search: string, replacement: string) =>
			String(str).split(String(search)).join(String(replacement)),

		regsub: (str: string, regex: string, replacement: string) => {
			try {
				return String(str).replace(new RegExp(regex), replacement);
			} catch (e) {
				console.error(`Invalid regex: ${regex}`, e);
				return str;
			}
		},
		regsuball: (str: string, regex: string, replacement: string) => {
			try {
				return String(str).replace(new RegExp(regex, "g"), replacement);
			} catch (e) {
				console.error(`Invalid regex: ${regex}`, e);
				return str;
			}
		},

		integer: (value: any) => parseInt(String(value), 10) || 0,
		real: (value: any) => parseFloat(String(value)) || 0.0,

		math: {
			round: Math.round,
			floor: Math.floor,
			ceil: Math.ceil,
			pow: Math.pow,
			log: Math.log,
			min: Math.min,
			max: Math.max,
			abs: Math.abs,
		},

		base64: (str: string) => Buffer.from(String(str)).toString("base64"),
		base64_decode: (str: string) => {
			try {
				return Buffer.from(String(str), "base64").toString("utf-8");
			} catch (e) {
				console.error(`Invalid base64 string: ${str}`, e);
				return "";
			}
		},
		base64url: (str: string) => {
			return Buffer.from(String(str))
				.toString("base64")
				.replace(/\+/g, "-")
				.replace(/\//g, "_")
				.replace(/=+$/, "");
		},
		base64url_decode: (str: string) => {
			try {
				const padded = String(str)
					.padEnd(Math.ceil(String(str).length / 4) * 4, "=")
					.replace(/-/g, "+")
					.replace(/_/g, "/");
				return Buffer.from(padded, "base64").toString("utf-8");
			} catch (e) {
				console.error(`Invalid base64url string: ${str}`, e);
				return "";
			}
		},

		digest: {
			hash_md5: DigestModule.hash_md5,
			hash_sha1: DigestModule.hash_sha1,
			hash_sha224: DigestModule.hash_sha224,
			hash_sha256: DigestModule.hash_sha256,
			hash_sha384: DigestModule.hash_sha384,
			hash_sha512: DigestModule.hash_sha512,
			hash_crc32: DigestModule.hash_crc32,
			hash_crc32b: DigestModule.hash_crc32b,
			hash_xxh32: DigestModule.hash_xxh32,
			hash_xxh64: DigestModule.hash_xxh64,
			hash_sha1_from_base64: DigestModule.hash_sha1_from_base64,
			hash_sha256_from_base64: DigestModule.hash_sha256_from_base64,
			hash_sha512_from_base64: DigestModule.hash_sha512_from_base64,
			hash_xxh32_from_base64: DigestModule.hash_xxh32_from_base64,
			hash_xxh64_from_base64: DigestModule.hash_xxh64_from_base64,
			hmac_md5: DigestModule.hmac_md5,
			hmac_sha1: DigestModule.hmac_sha1,
			hmac_sha256: DigestModule.hmac_sha256,
			hmac_sha512: DigestModule.hmac_sha512,
			hmac_md5_base64: DigestModule.hmac_md5_base64,
			hmac_sha1_base64: DigestModule.hmac_sha1_base64,
			hmac_sha256_base64: DigestModule.hmac_sha256_base64,
			hmac_sha512_base64: DigestModule.hmac_sha512_base64,
			secure_is_equal: DigestModule.secure_is_equal,
			base64: DigestModule.base64,
			base64_decode: DigestModule.base64_decode,
			base64url: DigestModule.base64url,
			base64url_decode: DigestModule.base64url_decode,
			base64url_nopad: DigestModule.base64url_nopad,
			base64url_nopad_decode: DigestModule.base64url_nopad_decode,
			awsv4_hmac: DigestModule.awsv4_hmac,
			rsa_verify: DigestModule.rsa_verify,
			ecdsa_verify: DigestModule.ecdsa_verify,
		},

		crypto: {
			encrypt_base64: CryptoModule.encrypt_base64,
			decrypt_base64: CryptoModule.decrypt_base64,
			encrypt_hex: CryptoModule.encrypt_hex,
			decrypt_hex: CryptoModule.decrypt_hex,
		},

		header: {
			get: (headers: Record<string, string>, name: string) => {
				const normalizedName = String(name).toLowerCase();
				for (const [key, value] of Object.entries(headers)) {
					if (key.toLowerCase() === normalizedName) return value;
				}
				return null;
			},
			set: (headers: Record<string, string>, name: string, value: string) => {
				headers[String(name)] = String(value);
			},
			remove: (headers: Record<string, string>, name: string) => {
				const normalizedName = String(name).toLowerCase();
				for (const key of Object.keys(headers)) {
					if (key.toLowerCase() === normalizedName) delete headers[key];
				}
			},
			filter: (headers: Record<string, string>, pattern: string) => {
				try {
					const regex = new RegExp(String(pattern));
					for (const key of Object.keys(headers)) {
						if (regex.test(key)) delete headers[key];
					}
				} catch (e) {
					console.error(`Invalid regex pattern for header.filter: ${pattern}`, e);
				}
			},
			filter_except: (headers: Record<string, string>, pattern: string) => {
				try {
					const regex = new RegExp(String(pattern));
					const keysToKeep = new Set(Object.keys(headers).filter((key) => regex.test(key)));
					for (const key of Object.keys(headers)) {
						if (!keysToKeep.has(key)) delete headers[key];
					}
				} catch (e) {
					console.error(`Invalid regex pattern for header.filter_except: ${pattern}`, e);
				}
			},
		},

		http: {
			status_matches: (status: number, pattern: string) => {
				const statusPatterns: Record<string, [number, number]> = {
					"2xx": [200, 300],
					success: [200, 300],
					"3xx": [300, 400],
					redirect: [300, 400],
					"4xx": [400, 500],
					client_error: [400, 500],
					"5xx": [500, 600],
					server_error: [500, 600],
					error: [400, 600],
				};
				const range = statusPatterns[pattern];
				if (range) return status >= range[0] && status < range[1];
				if (pattern.endsWith("xx")) return String(status).startsWith(pattern[0] ?? "");
				return String(status) === pattern;
			},
		},

		synthetic: (content: string) => {
			context.obj.response = String(content);
			if (!context.obj.http["content-type"]) {
				context.obj.http["content-type"] = "text/html; charset=utf-8";
			}
		},

		error: (status: number, message?: string) => {
			const defaultMessages: Record<number, string> = {
				400: "Bad Request",
				401: "Unauthorized",
				403: "Forbidden",
				404: "Not Found",
				429: "Too Many Requests",
				500: "Internal Server Error",
				502: "Bad Gateway",
				503: "Service Unavailable",
				504: "Gateway Timeout",
			};
			context.obj.status = status;
			context.obj.response = message ? String(message) : defaultMessages[status] || "Error";
			context.fastly!.error = context.obj.response;
			context.fastly!.state = "error";
			return "error";
		},

		querystring: {
			get: (url: string, name: string) => {
				try {
					return new URL(String(url)).searchParams.get(String(name));
				} catch {
					try {
						return new URLSearchParams(String(url).split("?")[1] || "").get(String(name));
					} catch {
						return null;
					}
				}
			},
			set: (url: string, name: string, value: string) => {
				try {
					const urlObj = new URL(String(url));
					urlObj.searchParams.set(String(name), String(value));
					return urlObj.toString();
				} catch {
					const [base, qs] = String(url).split("?");
					const params = new URLSearchParams(qs || "");
					params.set(String(name), String(value));
					return `${base}?${params.toString()}`;
				}
			},
			remove: (url: string, name: string): string => {
				try {
					const urlObj = new URL(String(url));
					urlObj.searchParams.delete(String(name));
					return urlObj.toString();
				} catch {
					const [base, qs] = String(url).split("?");
					const params = new URLSearchParams(qs || "");
					params.delete(String(name));
					const newQs = params.toString();
					return newQs ? `${base}?${newQs}` : (base ?? "");
				}
			},
			filter: (url: string, names: string[]): string => {
				const filterParams = (params: URLSearchParams) => {
					const filtered = new URLSearchParams();
					for (const name of names) {
						for (const value of params.getAll(name)) {
							filtered.append(name, value);
						}
					}
					return filtered;
				};
				try {
					const urlObj = new URL(String(url));
					urlObj.search = filterParams(urlObj.searchParams).toString();
					return urlObj.toString();
				} catch {
					const [base, qs] = String(url).split("?");
					const newQs = filterParams(new URLSearchParams(qs || "")).toString();
					return newQs ? `${base}?${newQs}` : (base ?? "");
				}
			},
			filter_except: (url: string, names: string[]): string => {
				const filterParams = (params: URLSearchParams) => {
					const filtered = new URLSearchParams();
					for (const [name, value] of params.entries()) {
						if (!names.includes(name)) filtered.append(name, value);
					}
					return filtered;
				};
				try {
					const urlObj = new URL(String(url));
					urlObj.search = filterParams(urlObj.searchParams).toString();
					return urlObj.toString();
				} catch {
					const [base, qs] = String(url).split("?");
					const newQs = filterParams(new URLSearchParams(qs || "")).toString();
					return newQs ? `${base}?${newQs}` : (base ?? "");
				}
			},
		},
	};

	context.std!.backend = {
		add: (name: string, host: string, port: number, ssl: boolean = false, options: any = {}) => {
			context.backends[name] = {
				name,
				host,
				port,
				ssl,
				connect_timeout: options.connect_timeout || 1000,
				first_byte_timeout: options.first_byte_timeout || 15000,
				between_bytes_timeout: options.between_bytes_timeout || 10000,
				max_connections: options.max_connections || 200,
				ssl_cert_hostname: options.ssl_cert_hostname || host,
				ssl_sni_hostname: options.ssl_sni_hostname || host,
				ssl_check_cert: options.ssl_check_cert !== undefined ? options.ssl_check_cert : true,
				probe: options.probe,
				is_healthy: true,
			};
			return true;
		},
		remove: (name: string) => {
			if (!context.backends[name]) return false;
			delete context.backends[name];
			return true;
		},
		get: (name: string) => context.backends[name] || null,
		set_current: (name: string) => {
			if (!context.backends[name]) return false;
			context.req.backend = name;
			context.current_backend = context.backends[name];
			return true;
		},
		is_healthy: (name: string) => context.backends[name]?.is_healthy || false,
		add_probe: (backendName: string, options: any) => {
			const backend = context.backends[backendName];
			if (!backend) return false;
			backend.probe = {
				request:
					options.request ||
					`HEAD / HTTP/1.1\r\nHost: ${backend.host}\r\nConnection: close\r\n\r\n`,
				expected_response: options.expected_response || 200,
				interval: options.interval || 5000,
				timeout: options.timeout || 2000,
				window: options.window || 5,
				threshold: options.threshold || 3,
				initial: options.initial || 2,
			};
			return true;
		},
	};

	context.std.random = {
		randombool: (probability: number): boolean => {
			if (probability < 0 || probability > 1) {
				console.error(`Invalid probability: ${probability}. Must be between 0 and 1.`);
				return false;
			}
			return Math.random() < probability;
		},
		randombool_seeded: (probability: number, seed: string): boolean => {
			if (probability < 0 || probability > 1) {
				console.error(`Invalid probability: ${probability}. Must be between 0 and 1.`);
				return false;
			}
			const hash = context.std!.digest.hash_sha256(String(seed));
			return parseInt(hash.substring(0, 8), 16) / 0xffffffff < probability;
		},
		randomint: (from: number, to: number): number => {
			if (from > to) {
				console.error(
					`Invalid range: ${from} to ${to}. 'from' must be less than or equal to 'to'.`,
				);
				return from;
			}
			return Math.floor(Math.random() * (to - from + 1)) + from;
		},
		randomint_seeded: (from: number, to: number, seed: string): number => {
			if (from > to) {
				console.error(
					`Invalid range: ${from} to ${to}. 'from' must be less than or equal to 'to'.`,
				);
				return from;
			}
			const hash = context.std!.digest.hash_sha256(String(seed));
			return Math.floor((parseInt(hash.substring(0, 8), 16) / 0xffffffff) * (to - from + 1)) + from;
		},
		randomstr: (length: number, charset?: string): string => {
			if (length <= 0) {
				console.error(`Invalid length: ${length}. Must be greater than 0.`);
				return "";
			}
			const chars = charset || "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
			let result = "";
			for (let i = 0; i < length; i++) {
				result += chars.charAt(Math.floor(Math.random() * chars.length));
			}
			return result;
		},
	};

	context.std.acl = {
		add: (name: string) => {
			context.acls[name] = { name, entries: [] };
			return true;
		},
		remove: (name: string) => {
			if (!context.acls[name]) return false;
			delete context.acls[name];
			return true;
		},
		add_entry: (aclName: string, ip: string, subnet?: number) => {
			const acl = context.acls[aclName];
			if (!acl) return false;
			acl.entries.push({ ip, subnet });
			return true;
		},
		remove_entry: (aclName: string, ip: string, subnet?: number) => {
			const acl = context.acls[aclName];
			if (!acl) return false;
			const index = acl.entries.findIndex((e) => e.ip === ip && e.subnet === subnet);
			if (index === -1) return false;
			acl.entries.splice(index, 1);
			return true;
		},
		check: (ip: string, aclName: string) => {
			const acl = context.acls[aclName];
			if (!acl) return false;
			return acl.entries.some((entry) =>
				entry.subnet ? isIpInCidr(ip, entry.ip, entry.subnet) : ip === entry.ip,
			);
		},
	};

	context.std.table = {
		add: (name: string) => {
			context.tables[name] = { name, entries: {} };
			return true;
		},
		remove: (name: string) => {
			if (!context.tables[name]) return false;
			delete context.tables[name];
			return true;
		},
		add_entry: (tableName: string, key: string, value: string | number | boolean | RegExp) => {
			const table = context.tables[tableName];
			if (!table) return false;
			table.entries[key] = value;
			return true;
		},
		remove_entry: (tableName: string, key: string) => {
			const table = context.tables[tableName];
			if (!table || !(key in table.entries)) return false;
			delete table.entries[key];
			return true;
		},
		lookup: (tableName: string, key: string, defaultValue: string = "") => {
			const table = context.tables[tableName];
			if (!table || !(key in table.entries)) return defaultValue;
			return String(table.entries[key]);
		},
		lookup_bool: (tableName: string, key: string, defaultValue: boolean = false) => {
			const table = context.tables[tableName];
			if (!table || !(key in table.entries)) return defaultValue;
			const value = table.entries[key];
			if (typeof value === "boolean") return value;
			if (typeof value === "string") return value.toLowerCase() === "true";
			if (typeof value === "number") return value !== 0;
			return defaultValue;
		},
		lookup_integer: (tableName: string, key: string, defaultValue: number = 0) => {
			const table = context.tables[tableName];
			if (!table || !(key in table.entries)) return defaultValue;
			const value = table.entries[key];
			if (typeof value === "number") return Math.floor(value);
			if (typeof value === "string") {
				const parsed = parseInt(value, 10);
				return Number.isNaN(parsed) ? defaultValue : parsed;
			}
			if (typeof value === "boolean") return value ? 1 : 0;
			return defaultValue;
		},
		lookup_float: (tableName: string, key: string, defaultValue: number = 0.0) => {
			const table = context.tables[tableName];
			if (!table || !(key in table.entries)) return defaultValue;
			const value = table.entries[key];
			if (typeof value === "number") return value;
			if (typeof value === "string") {
				const parsed = parseFloat(value);
				return Number.isNaN(parsed) ? defaultValue : parsed;
			}
			if (typeof value === "boolean") return value ? 1.0 : 0.0;
			return defaultValue;
		},
		lookup_regex: (tableName: string, key: string, defaultValue: string = "") => {
			const table = context.tables[tableName];
			const defaultRegex = () => (defaultValue ? new RegExp(defaultValue) : /(?:)/);
			if (!table || !(key in table.entries)) return defaultRegex();
			const value = table.entries[key];
			if (value instanceof RegExp) return value;
			if (typeof value === "string") {
				try {
					return new RegExp(value);
				} catch (e) {
					console.error(`Invalid regex pattern: ${value}`, e);
					return defaultRegex();
				}
			}
			return defaultRegex();
		},
		contains: (tableName: string, key: string) => {
			const table = context.tables[tableName];
			return table ? key in table.entries : false;
		},
	};

	context.waf = {
		allow: WAFModule.allow,
		block: WAFModule.block,
		log: WAFModule.log,
		rate_limit: WAFModule.rate_limit,
		rate_limit_tokens: WAFModule.rate_limit_tokens,
		detect_attack: WAFModule.detect_attack,
	};

	context.std.ratelimit = {
		open_window: RateLimitModule.open_window,
		ratecounter_increment: RateLimitModule.ratecounter_increment,
		check_rate: RateLimitModule.check_rate,
		check_rates: RateLimitModule.check_rates,
		penaltybox_add: RateLimitModule.penaltybox_add,
		penaltybox_has: RateLimitModule.penaltybox_has,
	};

	context.addr = {
		is_ipv4: AddressModule.is_ipv4,
		is_ipv6: AddressModule.is_ipv6,
		is_unix: AddressModule.is_unix,
		extract_bits: AddressModule.extract_bits,
	};

	context.accept = {
		language_lookup: AcceptModule.language_lookup,
		charset_lookup: AcceptModule.charset_lookup,
		encoding_lookup: AcceptModule.encoding_lookup,
		media_lookup: AcceptModule.media_lookup,
	};

	context.bin = {
		base64_to_hex: BinaryModule.base64_to_hex,
		hex_to_base64: BinaryModule.hex_to_base64,
		data_convert: BinaryModule.data_convert,
	};

	context.querystring = {
		get: QueryStringModule.get,
		set: QueryStringModule.set,
		add: QueryStringModule.add,
		remove: QueryStringModule.remove,
		clean: QueryStringModule.clean,
		filter: QueryStringModule.filter,
		filter_except: QueryStringModule.filter_except,
		filtersep: QueryStringModule.filtersep,
		sort: QueryStringModule.sort,
		globfilter: QueryStringModule.globfilter,
		globfilter_except: QueryStringModule.globfilter_except,
		regfilter: QueryStringModule.regfilter,
		regfilter_except: QueryStringModule.regfilter_except,
	};

	context.uuid = {
		version3: UUIDModule.version3,
		version4: UUIDModule.version4,
		version5: UUIDModule.version5,
		version7: UUIDModule.version7,
		dns: UUIDModule.dns,
		url: UUIDModule.url,
		oid: UUIDModule.oid,
		x500: UUIDModule.x500,
		is_valid: UUIDModule.is_valid,
		is_version3: UUIDModule.is_version3,
		is_version4: UUIDModule.is_version4,
		is_version5: UUIDModule.is_version5,
		is_version7: UUIDModule.is_version7,
		decode: UUIDModule.decode,
		encode: UUIDModule.encode,
	};

	const simpleHash = (str: string): number => {
		return Math.abs(
			str.split("").reduce((a, b) => {
				a = (a << 5) - a + b.charCodeAt(0);
				return a & a;
			}, 0),
		);
	};

	context.std.director = {
		add: (name: string, type: string, options: any = {}) => {
			const validTypes = ["random", "hash", "client", "fallback", "chash"];
			if (!validTypes.includes(type)) {
				console.error(`Invalid director type: ${type}`);
				return false;
			}
			context.directors[name] = {
				name,
				type: type as any,
				backends: [],
				quorum: options.quorum || 0,
				retries: options.retries || 0,
			};
			return true;
		},
		remove: (name: string) => {
			if (!context.directors[name]) return false;
			delete context.directors[name];
			return true;
		},
		add_backend: (directorName: string, backendName: string, weight: number = 1) => {
			const director = context.directors[directorName];
			const backend = context.backends[backendName];
			if (!director || !backend) return false;
			director.backends.push({ backend, weight });
			return true;
		},
		remove_backend: (directorName: string, backendName: string) => {
			const director = context.directors[directorName];
			if (!director) return false;
			const index = director.backends.findIndex((b) => b.backend.name === backendName);
			if (index === -1) return false;
			director.backends.splice(index, 1);
			return true;
		},
		select_backend: (directorName: string) => {
			const director = context.directors[directorName];
			if (!director || director.backends.length === 0) return null;

			const healthyBackends = director.backends.filter((b) => b.backend.is_healthy);
			const quorumPercentage = director.quorum / 100;
			const requiredHealthyBackends = Math.ceil(director.backends.length * quorumPercentage);
			if (healthyBackends.length < requiredHealthyBackends) return null;

			if (director.type === "random") {
				const totalWeight = healthyBackends.reduce((sum, b) => sum + b.weight, 0);
				let random = Math.random() * totalWeight;
				for (const b of healthyBackends) {
					random -= b.weight;
					if (random <= 0) return b.backend;
				}
				return healthyBackends[0]!.backend;
			}

			if (director.type === "fallback") {
				return healthyBackends[0]!.backend;
			}

			// hash, client, and chash all use hash-based selection
			let hashStr = "";
			if (director.type === "client") {
				hashStr = context.req.http["X-Client-Identity"] || context.req.http.Cookie || "";
			} else if (context.hashData && context.hashData.length > 0) {
				hashStr = context.hashData.join(":");
			}

			if (hashStr) {
				return healthyBackends[simpleHash(hashStr) % healthyBackends.length]!.backend;
			}
			return healthyBackends[0]!.backend;
		},
	};

	// Add the new comprehensive modules
	const stdModule = createStdModule();
	const mathModule = createMathModule();
	const tableModule = createTableModule();
	const timeModule = createTimeModule();
	const headerModule = createHeaderModule();

	// Merge std module functions with existing context.std
	Object.assign(context.std, {
		strlen: stdModule.strlen,
		tolower: stdModule.tolower,
		toupper: stdModule.toupper,
		strstr: stdModule.strstr,
		strrev: stdModule.strrev,
		strrep: stdModule.strrep,
		strpad: stdModule.strpad,
		strcasecmp: stdModule.strcasecmp,
		prefixof: stdModule.prefixof,
		suffixof: stdModule.suffixof,
		replace: stdModule.replace,
		replaceall: stdModule.replaceall,
		replace_prefix: stdModule.replace_prefix,
		replace_suffix: stdModule.replace_suffix,
		basename: stdModule.basename,
		dirname: stdModule.dirname,
		atoi: stdModule.atoi,
		atof: stdModule.atof,
		strtol: stdModule.strtol,
		strtof: stdModule.strtof,
		itoa: stdModule.itoa,
		itoa_charset: stdModule.itoa_charset,
		ip: stdModule.ip,
		ip2str: stdModule.ip2str,
		str2ip: stdModule.str2ip,
		anystr2ip: stdModule.anystr2ip,
		collect: stdModule.collect,
		count: stdModule.count,
	});

	context.math = mathModule;
	context.table = tableModule;
	context.time = timeModule;
	context.header = headerModule;
	context.strftime = createStrftime();
	context.parse_time_delta = createParseTimeDelta();
	context.rateLimitModule = RateLimitModule;

	return context;
}

function ipv4ToBinary(ip: string): string {
	const octets = ip.split(".");
	if (octets.length !== 4) return "";
	try {
		return octets
			.map((octet) => {
				const num = parseInt(octet, 10);
				if (Number.isNaN(num) || num < 0 || num > 255) throw new Error();
				return num.toString(2).padStart(8, "0");
			})
			.join("");
	} catch {
		return "";
	}
}

function normalizeIPv6(ip: string): string {
	try {
		// Handle IPv4-mapped IPv6 (::ffff:x.x.x.x)
		if (ip.includes(".")) {
			if (ip.toLowerCase().includes("::ffff:") && ip.split(".").length === 4) {
				return ip;
			}
			const lastColon = ip.lastIndexOf(":");
			const ipv4Part = ip.substring(lastColon + 1);
			if (ipv4Part.includes(".")) {
				const octets = ipv4Part.split(".");
				if (octets.length === 4) {
					const hex1 =
						parseInt(octets[0]!, 10).toString(16).padStart(2, "0") +
						parseInt(octets[1]!, 10).toString(16).padStart(2, "0");
					const hex2 =
						parseInt(octets[2]!, 10).toString(16).padStart(2, "0") +
						parseInt(octets[3]!, 10).toString(16).padStart(2, "0");
					ip = `${ip.substring(0, lastColon + 1) + hex1}:${hex2}`;
				}
			}
		}

		// Expand :: shorthand
		if (ip.includes("::")) {
			const parts = ip.split("::");
			if (parts.length !== 2) return "";
			const leftParts = parts[0] ? parts[0].split(":") : [];
			const rightParts = parts[1] ? parts[1].split(":") : [];
			const missingBlocks = 8 - (leftParts.length + rightParts.length);
			if (missingBlocks < 0) return "";
			ip = [...leftParts, ...Array(missingBlocks).fill("0"), ...rightParts].join(":");
		}

		const segments = ip.split(":");
		if (segments.length !== 8) return "";
		return segments.map((part) => part.padStart(4, "0")).join(":");
	} catch {
		return "";
	}
}

function ipv6ToBinary(ip: string): string {
	try {
		// Handle IPv4-mapped IPv6
		if (ip.includes(".") && ip.toLowerCase().includes("::ffff:")) {
			const ipv4Binary = ipv4ToBinary(ip.substring(ip.lastIndexOf(":") + 1));
			return ipv4Binary ? "0".repeat(96) + ipv4Binary : "";
		}

		const normalizedIP = normalizeIPv6(ip);
		if (!normalizedIP) return "";

		return normalizedIP
			.split(":")
			.map((segment) => {
				const num = parseInt(segment, 16);
				if (Number.isNaN(num) || num < 0 || num > 65535) throw new Error();
				return num.toString(2).padStart(16, "0");
			})
			.join("");
	} catch {
		return "";
	}
}

function getIPType(ip: string): "ipv4" | "ipv6" | null {
	const isValidOctet = (s: string) => {
		const n = parseInt(s, 10);
		return !Number.isNaN(n) && n >= 0 && n <= 255;
	};

	// Pure IPv4
	if (ip.includes(".") && !ip.includes(":")) {
		const parts = ip.split(".");
		return parts.length === 4 && parts.every(isValidOctet) ? "ipv4" : null;
	}

	// IPv6 (possibly with embedded IPv4)
	if (ip.includes(":")) {
		if ((ip.match(/::/g) || []).length > 1) return null;

		// IPv4-mapped IPv6
		if (ip.includes(".") && ip.toLowerCase().includes("::ffff:")) {
			const ipv4Part = ip.substring(ip.lastIndexOf(":") + 1);
			const ipv4Parts = ipv4Part.split(".");
			return ipv4Parts.length === 4 && ipv4Parts.every(isValidOctet) ? "ipv6" : null;
		}

		const parts = ip.split(":");
		if (parts.length > 8) return null;
		for (const part of parts) {
			if (part === "") continue;
			if (!/^[0-9A-Fa-f]{1,4}$/.test(part)) return null;
		}
		return "ipv6";
	}

	return null;
}

function isIpInCidr(ip: string, cidrIp: string, cidrSubnet: number): boolean {
	try {
		// Invalid IPv6 patterns
		if (ip.includes(":") && ((ip.match(/::/g) || []).length > 1 || ip.includes("gggg"))) {
			return false;
		}

		const ipType = getIPType(ip);
		const cidrType = getIPType(cidrIp);
		if (!ipType || !cidrType || ipType !== cidrType) return false;

		if (ipType === "ipv4") {
			if (cidrSubnet < 0 || cidrSubnet > 32) return false;
			const ipBinary = ipv4ToBinary(ip);
			const cidrBinary = ipv4ToBinary(cidrIp);
			if (!ipBinary || !cidrBinary) return false;
			return ipBinary.substring(0, cidrSubnet) === cidrBinary.substring(0, cidrSubnet);
		}

		if (ipType === "ipv6") {
			if (cidrSubnet < 0 || cidrSubnet > 128) return false;

			// IPv4-mapped IPv6 special case
			const isIpv4Mapped = (addr: string) =>
				addr.includes(".") && addr.toLowerCase().includes("::ffff:");
			if (isIpv4Mapped(ip) && isIpv4Mapped(cidrIp)) {
				const ipv4Subnet = cidrSubnet - 96;
				if (ipv4Subnet < 0) return true;
				return isIpInCidr(
					ip.substring(ip.lastIndexOf(":") + 1),
					cidrIp.substring(cidrIp.lastIndexOf(":") + 1),
					ipv4Subnet,
				);
			}

			const ipBinary = ipv6ToBinary(ip);
			const cidrBinary = ipv6ToBinary(cidrIp);
			if (!ipBinary || !cidrBinary) return false;
			return ipBinary.substring(0, cidrSubnet) === cidrBinary.substring(0, cidrSubnet);
		}

		return false;
	} catch {
		return false;
	}
}

export function executeVCL(
	subroutines: VCLSubroutines,
	subroutineName: keyof VCLSubroutines,
	context: VCLContext,
): string {
	const subroutine = subroutines[subroutineName];
	if (!subroutine) return "";
	try {
		const result = subroutine(context);
		return result ?? "";
	} catch (error) {
		console.error(`Error executing subroutine ${subroutineName}:`, error);
		return "error";
	}
}
