import { toRawString } from "./vcl-value";

function splitAcceptItems(header: string): string[] {
	return header.split(",").map((item) => {
		let v = item.trim();
		const semicolonIdx = v.indexOf(";");
		if (semicolonIdx !== -1) {
			v = v.substring(0, semicolonIdx);
		}
		return v;
	});
}

// Shared logic of accept.{charset,encoding,language}_lookup: return the
// entry of `available` with the lowest index that appears verbatim in the
// accept header (quality values are ignored), or the default.
function lookupAcceptHeader(available: string, defaultValue: string, header: any): string {
	const options = String(available).split(":");
	let index = options.length;
	for (const item of splitAcceptItems(toRawString(header))) {
		for (let i = 0; i < options.length; i++) {
			if (options[i] === item && i < index) {
				index = i;
			}
		}
	}
	return index < options.length ? (options[index] as string) : String(defaultValue);
}

export function language_filter_basic(
	lookup: string,
	defaultValue: string,
	acceptLanguage: any,
	nmatches: number,
): string {
	const languages = String(lookup).split(":");
	let matches: number[] = [];

	for (const item of splitAcceptItems(toRawString(acceptLanguage))) {
		for (let i = 0; i < languages.length; i++) {
			if (languages[i] === item) {
				matches.push(i);
			}
		}
	}

	if (matches.length === 0) {
		return String(defaultValue);
	}

	const n = Math.trunc(Number(nmatches));
	if (matches.length > n) {
		matches = matches.slice(0, Math.max(n, 0));
	}
	matches.sort((a, b) => a - b);
	return matches.map((i) => languages[i]).join(",");
}

export const AcceptModule = {
	language_lookup: (available: string, defaultLang: string, header: string): string => {
		return lookupAcceptHeader(available, defaultLang, header);
	},

	language_filter_basic,

	charset_lookup: (available: string, defaultCharset: string, header: string): string => {
		return lookupAcceptHeader(available, defaultCharset, header);
	},

	encoding_lookup: (available: string, defaultEncoding: string, header: string): string => {
		return lookupAcceptHeader(available, defaultEncoding, header);
	},

	// `patterns` entries also match their "type/*" group wildcard; a bare
	// "*/*" yields the default.
	media_lookup: (
		available: string,
		defaultMedia: string,
		patterns: string,
		header: string,
	): string => {
		const mediaTypes = new Set(String(available).split(":"));

		const patternMap = new Map<string, string>();
		for (const p of String(patterns).split(":")) {
			if (mediaTypes.has(p)) {
				throw new Error(
					"accept.media_lookup: third argument media must not duplicate in first argument",
				);
			}
			patternMap.set(p, p);
			const slashIdx = p.indexOf("/");
			if (slashIdx !== -1) {
				patternMap.set(`${p.substring(0, slashIdx)}/*`, p);
			}
		}

		for (const item of splitAcceptItems(toRawString(header))) {
			if (mediaTypes.has(item)) {
				return item;
			}
			const patternMatch = patternMap.get(item);
			if (patternMatch !== undefined) {
				return patternMatch;
			}
			if (item === "*/*") {
				return String(defaultMedia);
			}
		}

		return "";
	},
};
