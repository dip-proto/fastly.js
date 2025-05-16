/**
 * VCL Header Functions Module
 *
 * Implements all header.* functions from Fastly VCL.
 * Reference: https://developer.fastly.com/reference/vcl/functions/headers/
 */

export interface Headers {
	[name: string]: string | string[] | undefined;
}

export interface HeaderModule {
	get: (headers: Headers, name: string) => string;
	set: (headers: Headers, name: string, value: string) => void;
	unset: (headers: Headers, name: string) => void;
	filter: (headers: Headers, filterNames: string[]) => Headers;
	filter_except: (headers: Headers, keepNames: string[]) => Headers;
}

function normalizeHeaderName(name: string): string {
	return String(name).toLowerCase();
}

function findHeaderKey(headers: Headers, name: string): string | undefined {
	const normalized = normalizeHeaderName(name);
	return Object.keys(headers).find(
		(key) => normalizeHeaderName(key) === normalized,
	);
}

export function createHeaderModule(): HeaderModule {
	return {
		get: (headers: Headers, name: string): string => {
			const key = findHeaderKey(headers, name);
			if (!key) return "";
			const value = headers[key];
			if (value === undefined) return "";
			return Array.isArray(value) ? value.join(", ") : String(value);
		},

		set: (headers: Headers, name: string, value: string): void => {
			const existingKey = findHeaderKey(headers, name);
			if (existingKey) delete headers[existingKey];
			headers[name] = String(value);
		},

		unset: (headers: Headers, name: string): void => {
			const key = findHeaderKey(headers, name);
			if (key) delete headers[key];
		},

		filter: (headers: Headers, filterNames: string[]): Headers => {
			const normalizedNames = new Set(filterNames.map(normalizeHeaderName));
			const result: Headers = {};
			for (const key of Object.keys(headers)) {
				if (normalizedNames.has(normalizeHeaderName(key))) {
					result[key] = headers[key];
				}
			}
			return result;
		},

		filter_except: (headers: Headers, keepNames: string[]): Headers => {
			const normalizedNames = new Set(keepNames.map(normalizeHeaderName));
			const result: Headers = {};
			for (const key of Object.keys(headers)) {
				if (!normalizedNames.has(normalizeHeaderName(key))) {
					result[key] = headers[key];
				}
			}
			return result;
		},
	};
}

export function httpStatusMatches(
	status: number,
	...patterns: string[]
): boolean {
	const statusStr = String(status);

	for (const pattern of patterns) {
		const p = String(pattern).trim();

		// Exact match
		if (p === statusStr) return true;

		// Range match (e.g., "4xx", "5xx")
		if (p.length === 3 && p.endsWith("xx") && statusStr[0] === p[0])
			return true;

		// More specific range (e.g., "40x")
		if (
			p.length === 3 &&
			p.endsWith("x") &&
			statusStr.startsWith(p.substring(0, 2))
		)
			return true;

		// Range with hyphen (e.g., "400-499")
		if (p.includes("-")) {
			const [start, end] = p.split("-").map((s) => parseInt(s.trim(), 10));
			if (
				!Number.isNaN(start) &&
				!Number.isNaN(end) &&
				status >= start &&
				status <= end
			)
				return true;
		}
	}

	return false;
}
