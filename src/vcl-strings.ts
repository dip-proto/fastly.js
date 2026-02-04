export function urlencode(src: string): string {
	const str = String(src);
	let encoded = "";
	let i = 0;

	while (i < str.length) {
		const char = str[i];
		const code = str.charCodeAt(i);

		if (char === "%" && i + 2 < str.length) {
			const hex = str.slice(i + 1, i + 3);
			if (/^[0-9A-Fa-f]{2}$/.test(hex)) {
				const n = parseInt(hex, 16);
				if (n === 0) break;
				if (n >= 0x01 && n <= 0x7f) {
					encoded += str.slice(i, i + 3);
					i += 3;
					continue;
				}
			}
			encoded += "%25";
			i++;
		} else if (isUnreservedByte(code)) {
			encoded += char;
			i++;
		} else if (code < 128) {
			encoded += `%${code.toString(16).toUpperCase().padStart(2, "0")}`;
			i++;
		} else {
			let codePoint: number;
			if (code >= 0xd800 && code <= 0xdbff && i + 1 < str.length) {
				const next = str.charCodeAt(i + 1);
				if (next >= 0xdc00 && next <= 0xdfff) {
					codePoint = (code - 0xd800) * 0x400 + (next - 0xdc00) + 0x10000;
					i++;
				} else {
					codePoint = code;
				}
			} else {
				codePoint = code;
			}
			const bytes = new TextEncoder().encode(String.fromCodePoint(codePoint));
			for (const b of bytes) {
				encoded += `%${b.toString(16).toUpperCase().padStart(2, "0")}`;
			}
			i++;
		}
	}

	return encoded;
}

export function urldecode(src: string): string {
	const str = String(src);
	const bytes: number[] = [];
	let i = 0;

	while (i < str.length) {
		if (str[i] === "%" && i + 2 < str.length) {
			const hex = str.slice(i + 1, i + 3);
			if (/^[0-9A-Fa-f]{2}$/.test(hex)) {
				const n = parseInt(hex, 16);
				if (n === 0) break;
				bytes.push(n);
				i += 3;
				continue;
			}
		}
		bytes.push(str.charCodeAt(i));
		i++;
	}

	return new TextDecoder().decode(new Uint8Array(bytes));
}

function isUnreservedByte(code: number): boolean {
	return (
		(code >= 0x41 && code <= 0x5a) ||
		(code >= 0x61 && code <= 0x7a) ||
		(code >= 0x30 && code <= 0x39) ||
		code === 0x2d ||
		code === 0x2e ||
		code === 0x5f ||
		code === 0x7e
	);
}

export function cstr_escape(str: string): string {
	let result = "";
	for (const char of String(str)) {
		const code = char.charCodeAt(0);
		if (code === 0x5c) result += "\\\\";
		else if (code === 0x22) result += '\\"';
		else if (code === 0x0a) result += "\\n";
		else if (code === 0x0d) result += "\\r";
		else if (code === 0x09) result += "\\t";
		else if (code < 0x20 || code > 0x7e) result += `\\x${code.toString(16).padStart(2, "0")}`;
		else result += char;
	}
	return result;
}

export function json_escape(str: string): string {
	return String(str)
		.replace(/\\/g, "\\\\")
		.replace(/"/g, '\\"')
		.replace(/\n/g, "\\n")
		.replace(/\r/g, "\\r")
		.replace(/\t/g, "\\t")
		.replace(/[\x00-\x1f]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`);
}

export function xml_escape(str: string): string {
	return String(str)
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

export function strtol(s: string, base: number): number {
	const str = String(s).trim();
	const b = Math.floor(base);

	if (b === 0) {
		if (str.startsWith("0x") || str.startsWith("0X")) {
			const result = parseInt(str.slice(2), 16);
			return Number.isNaN(result) ? 0 : result;
		}
		if (str.startsWith("0") && str.length > 1) {
			const result = parseInt(str, 8);
			return Number.isNaN(result) ? 0 : result;
		}
		const result = parseInt(str, 10);
		return Number.isNaN(result) ? 0 : result;
	}

	if (b < 2 || b > 36) return 0;

	let input = str;
	if (b === 16 && (str.startsWith("0x") || str.startsWith("0X"))) {
		input = str.slice(2);
	} else if (b === 36 && str.startsWith("0") && str.length > 1) {
		input = str.slice(1);
	} else if (b !== 8 && b !== 10 && (str.startsWith("0x") || str.startsWith("0X"))) {
		input = str.slice(2);
	}

	const result = parseInt(input, b);
	return Number.isNaN(result) ? 0 : result;
}

export function regsub(str: string, pattern: string, replacement: string): string {
	try {
		const converted = replacement.replace(/\\(\d+)/g, "$$$1");
		return String(str).replace(new RegExp(pattern), converted);
	} catch {
		return str;
	}
}

export function regsuball(str: string, pattern: string, replacement: string): string {
	try {
		const converted = replacement.replace(/\\(\d+)/g, "$$$1");
		return String(str).replace(new RegExp(pattern, "g"), converted);
	} catch {
		return str;
	}
}

export function substr(str: string, offset: number, length?: number): string {
	const s = String(str);
	const len = s.length;

	let start: number;
	if (offset < 0) {
		start = len + offset;
		if (start < 0) return "";
	} else {
		start = offset;
	}

	if (start >= len) return "";

	let end: number;
	if (length === undefined) {
		end = len;
	} else if (length < 0) {
		end = len + length;
	} else {
		end = start + length;
		if (end < 0) return "";
	}

	if (end > len) end = len;
	if (end <= start) return "";

	return s.slice(start, end);
}

export function subfield(header: string, name: string, separator: string = ";"): string {
	const parts = String(header).split(separator);
	const search = String(name).toLowerCase();

	for (const part of parts) {
		const trimmed = part.trim();
		const eqIdx = trimmed.indexOf("=");

		if (eqIdx === -1) {
			if (trimmed.toLowerCase() === search) return "";
		} else {
			const key = trimmed.slice(0, eqIdx).trim().toLowerCase();
			if (key === search) {
				let value = trimmed.slice(eqIdx + 1).trim();
				if (value.startsWith('"') && value.endsWith('"')) {
					value = value.slice(1, -1);
				}
				return value;
			}
		}
	}
	return "";
}

export function boltsort_sort(url: string): string {
	try {
		const urlObj = new URL(String(url));
		const params = Array.from(urlObj.searchParams.entries());
		params.sort((a, b) => a[0].localeCompare(b[0]));
		urlObj.search = "";
		for (const [k, v] of params) {
			urlObj.searchParams.append(k, v);
		}
		return urlObj.toString();
	} catch {
		const [base, qs] = String(url).split("?");
		if (!qs) return url;
		const params = qs.split("&").filter(Boolean);
		params.sort((a, b) => {
			const keyA = a.split("=")[0] ?? "";
			const keyB = b.split("=")[0] ?? "";
			return keyA.localeCompare(keyB);
		});
		return `${base}?${params.join("&")}`;
	}
}

export function setcookie_get_value_by_name(setCookieHeader: string, name: string): string {
	const cookies = String(setCookieHeader).split(",");
	const search = String(name);

	for (const cookie of cookies) {
		const parts = cookie.trim().split(";");
		if (parts.length > 0) {
			const firstPart = parts[0] ?? "";
			const partPieces = firstPart.split("=");
			const cookieName = partPieces[0] ?? "";
			const valueParts = partPieces.slice(1);
			if (cookieName.trim() === search) {
				return valueParts.join("=");
			}
		}
	}
	return "";
}

export function setcookie_delete_by_name(setCookieHeader: string, name: string): string {
	const cookies = String(setCookieHeader).split(",");
	const search = String(name);
	const result: string[] = [];

	for (const cookie of cookies) {
		const parts = cookie.trim().split(";");
		if (parts.length > 0) {
			const firstPart = parts[0] ?? "";
			const partPieces = firstPart.split("=");
			const cookieName = partPieces[0] ?? "";
			if (cookieName.trim() !== search) {
				result.push(cookie.trim());
			}
		}
	}
	return result.join(", ");
}

export const Utf8Module = {
	is_valid: (str: string): boolean => {
		try {
			const encoded = new TextEncoder().encode(String(str));
			new TextDecoder("utf-8", { fatal: true }).decode(encoded);
			return true;
		} catch {
			return false;
		}
	},

	codepoint_count: (str: string): number => {
		return [...String(str)].length;
	},

	substr: (str: string, offset: number, length?: number): string => {
		const codepoints = [...String(str)];
		const len = codepoints.length;

		let start = offset < 0 ? len + offset : offset;
		if (start < 0) start = 0;
		if (start >= len) return "";

		const end = length === undefined ? len : start + length;
		return codepoints.slice(start, Math.min(end, len)).join("");
	},

	strpad: (str: string, width: number, pad: string): string => {
		const s = String(str);
		const codepoints = [...s];
		const padCodepoints = [...String(pad)];
		const w = Math.abs(width);

		if (codepoints.length >= w || padCodepoints.length === 0) return s;

		const needed = w - codepoints.length;
		let padding = "";
		while ([...padding].length < needed) {
			padding += pad;
		}
		padding = [...padding].slice(0, needed).join("");

		return width < 0 ? s + padding : padding + s;
	},
};
