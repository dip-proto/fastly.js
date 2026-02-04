/**
 * VCL Miscellaneous Functions Module
 *
 * Implements various utility functions from Fastly VCL.
 */

const ESCAPE_MAP: Record<string, string> = {
	"\\": "\\\\",
	'"': '\\"',
	"\n": "\\n",
	"\r": "\\r",
	"\t": "\\t",
	"\b": "\\b",
	"\f": "\\f",
};

function escapeString(s: string, nonPrintableFormatter: (code: number) => string): string {
	const str = String(s);
	let result = "";

	for (let i = 0; i < str.length; i++) {
		const c = str[i] ?? "";
		const code = str.charCodeAt(i);

		if (ESCAPE_MAP[c]) {
			result += ESCAPE_MAP[c];
		} else if (code < 32 || code > 126) {
			result += nonPrintableFormatter(code);
		} else {
			result += c;
		}
	}

	return result;
}

// boltsort.sort: Sorts query string parameters alphabetically
export function boltsortSort(url: string): string {
	const str = String(url);
	const questionIdx = str.indexOf("?");

	if (questionIdx === -1) return str;

	const base = str.substring(0, questionIdx);
	const query = str.substring(questionIdx + 1);

	if (!query) return base;

	const params = query.split("&").filter((p) => p.length > 0);
	params.sort((a, b) => {
		const aKey = a.split("=")[0] || "";
		const bKey = b.split("=")[0] || "";
		return aKey.localeCompare(bKey);
	});

	return `${base}?${params.join("&")}`;
}

// cstr_escape: Escapes a string for use in C-style strings
export function cstrEscape(s: string): string {
	return escapeString(s, (code) => `\\${code.toString(8).padStart(3, "0")}`);
}

// json.escape: Escapes a string for use in JSON
export function jsonEscape(s: string): string {
	const str = String(s);
	let result = "";

	for (let i = 0; i < str.length; i++) {
		const c = str[i] ?? "";
		const code = str.charCodeAt(i);

		if (ESCAPE_MAP[c]) {
			result += ESCAPE_MAP[c];
		} else if (code < 32) {
			result += `\\u${code.toString(16).padStart(4, "0")}`;
		} else {
			result += c;
		}
	}

	return result;
}

// xml_escape: Escapes a string for use in XML/HTML
export function xmlEscape(s: string): string {
	return String(s)
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

export function urlencode(s: string): string {
	return encodeURIComponent(String(s));
}

export function urldecode(s: string): string {
	try {
		return decodeURIComponent(String(s).replace(/\+/g, " "));
	} catch {
		return String(s);
	}
}

// subfield: Extracts a subfield from a structured header value
// Example: subfield("a=1; b=2; c=3", "b", ";") returns "2"
export function subfield(s: string, name: string, separator: string = ";"): string {
	const fieldName = String(name);
	const parts = String(s)
		.split(String(separator))
		.map((p) => p.trim());

	for (const part of parts) {
		const eqIdx = part.indexOf("=");
		if (eqIdx === -1) {
			if (part.trim() === fieldName) return "";
		} else {
			const key = part.substring(0, eqIdx).trim();
			if (key === fieldName) {
				let value = part.substring(eqIdx + 1).trim();
				if (
					(value.startsWith('"') && value.endsWith('"')) ||
					(value.startsWith("'") && value.endsWith("'"))
				) {
					value = value.substring(1, value.length - 1);
				}
				return value;
			}
		}
	}

	return "";
}

export const random = {
	bool: (): boolean => Math.random() < 0.5,

	// Note: JavaScript doesn't have built-in seeded random
	bool_seeded: (_seed: number): boolean => Math.random() < 0.5,

	int: (from: number, to: number): number => {
		const min = Math.floor(from);
		const max = Math.floor(to);
		return Math.floor(Math.random() * (max - min)) + min;
	},

	int_seeded: (_seed: number, from: number, to: number): number => {
		const min = Math.floor(from);
		const max = Math.floor(to);
		return Math.floor(Math.random() * (max - min)) + min;
	},

	str: (length: number): string => {
		const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
		const len = Math.max(0, Math.floor(length));
		let result = "";
		for (let i = 0; i < len; i++) {
			result += chars[Math.floor(Math.random() * chars.length)];
		}
		return result;
	},
};

export const setcookie = {
	get_value_by_name: (setCookieHeader: string, name: string): string => {
		const cookieName = String(name);
		const cookies = String(setCookieHeader)
			.split(",")
			.map((c) => c.trim());

		for (const cookie of cookies) {
			const cookieParts = cookie.split(";")[0] ?? "";
			const eqIdx = cookieParts.indexOf("=");
			if (eqIdx !== -1) {
				const key = cookieParts.substring(0, eqIdx).trim();
				if (key === cookieName) {
					return cookieParts.substring(eqIdx + 1).trim();
				}
			}
		}

		return "";
	},

	delete_by_name: (setCookieHeader: string, name: string): string => {
		const cookieName = String(name);
		const cookies = String(setCookieHeader)
			.split(",")
			.map((c) => c.trim());

		return cookies
			.filter((cookie) => {
				const cookieParts = cookie.split(";")[0] ?? "";
				const eqIdx = cookieParts.indexOf("=");
				if (eqIdx !== -1) {
					return cookieParts.substring(0, eqIdx).trim() !== cookieName;
				}
				return true;
			})
			.join(", ");
	},
};

export const fastly = {
	hash: async (input: string): Promise<string> => {
		const crypto = await import("node:crypto");
		return crypto.createHash("sha256").update(String(input)).digest("hex");
	},

	// No-op in local development
	try_select_shield: (): boolean => false,
};

// No-op in local development
export function respTarpit(_duration: number): void {}

// No-op in local development
export function earlyHints(_header: string): void {}
