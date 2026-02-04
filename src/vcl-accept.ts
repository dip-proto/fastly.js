interface AcceptValue {
	value: string;
	quality: number;
}

function parseAcceptHeader(header: string): AcceptValue[] {
	if (!header) {
		return [];
	}

	return header
		.split(",")
		.map((part) => {
			const parts = part.trim().split(";q=");
			const value = parts[0] ?? "";
			const quality = parts[1];
			return {
				value: value.trim(),
				quality: quality ? parseFloat(quality) : 1.0,
			};
		})
		.sort((a, b) => b.quality - a.quality);
}

function findBestMatch(acceptValues: AcceptValue[], availableOptions: string[]): string | null {
	for (const acceptValue of acceptValues) {
		if (availableOptions.includes(acceptValue.value)) {
			return acceptValue.value;
		}
	}

	for (const acceptValue of acceptValues) {
		const baseLang = acceptValue.value.split("-")[0] ?? "";
		if (baseLang !== acceptValue.value && availableOptions.includes(baseLang)) {
			return baseLang;
		}
	}

	for (const acceptValue of acceptValues) {
		if (acceptValue.value === "*/*" && availableOptions.length > 0) {
			return availableOptions[0] ?? null;
		}

		const valueParts = acceptValue.value.split("/");
		const type = valueParts[0];
		const subtype = valueParts[1];
		if (subtype === "*") {
			for (const option of availableOptions) {
				const optionParts = option.split("/");
				const optionType = optionParts[0];
				if (optionType === type) {
					return option;
				}
			}
		}
	}

	return null;
}

function lookupAcceptHeader(available: string, defaultValue: string, header: string): string {
	if (!header) {
		return defaultValue;
	}
	const options = available.split(":");
	const acceptValues = parseAcceptHeader(header);
	return findBestMatch(acceptValues, options) || defaultValue;
}

export const AcceptModule = {
	language_lookup: (available: string, defaultLang: string, header: string): string => {
		return lookupAcceptHeader(available, defaultLang, header);
	},

	language_filter_basic: (
		lookup: string,
		defaultValue: string,
		language: string,
		nmatches: number,
	): string => {
		const languages = String(lookup).split(":");
		const matches: number[] = [];

		for (const lang of String(language).split(",")) {
			let l = lang.trim();
			const semicolonIdx = l.indexOf(";");
			if (semicolonIdx !== -1) {
				l = l.substring(0, semicolonIdx);
			}
			const idx = languages.indexOf(l);
			if (idx !== -1) {
				matches.push(idx);
			}
		}

		if (matches.length === 0) {
			return String(defaultValue);
		}

		const limitedMatches = matches.slice(0, nmatches);
		limitedMatches.sort((a, b) => a - b);
		return limitedMatches.map((i) => languages[i]).join(",");
	},

	charset_lookup: (available: string, defaultCharset: string, header: string): string => {
		return lookupAcceptHeader(available, defaultCharset, header);
	},

	encoding_lookup: (available: string, defaultEncoding: string, header: string): string => {
		return lookupAcceptHeader(available, defaultEncoding, header);
	},

	media_lookup: (
		available: string,
		defaultMedia: string,
		_patterns: string,
		header: string,
	): string => {
		return lookupAcceptHeader(available, defaultMedia, header);
	},
};
