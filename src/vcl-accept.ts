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
			const [value, quality] = part.trim().split(";q=");
			return {
				value: value.trim(),
				quality: quality ? parseFloat(quality) : 1.0,
			};
		})
		.sort((a, b) => b.quality - a.quality);
}

function findBestMatch(
	acceptValues: AcceptValue[],
	availableOptions: string[],
): string | null {
	for (const acceptValue of acceptValues) {
		if (availableOptions.includes(acceptValue.value)) {
			return acceptValue.value;
		}
	}

	for (const acceptValue of acceptValues) {
		const baseLang = acceptValue.value.split("-")[0];
		if (baseLang !== acceptValue.value && availableOptions.includes(baseLang)) {
			return baseLang;
		}
	}

	for (const acceptValue of acceptValues) {
		if (acceptValue.value === "*/*" && availableOptions.length > 0) {
			return availableOptions[0];
		}

		const [type, subtype] = acceptValue.value.split("/");
		if (subtype === "*") {
			for (const option of availableOptions) {
				const [optionType] = option.split("/");
				if (optionType === type) {
					return option;
				}
			}
		}
	}

	return null;
}

function lookupAcceptHeader(
	available: string,
	defaultValue: string,
	header: string,
): string {
	if (!header) {
		return defaultValue;
	}
	const options = available.split(":");
	const acceptValues = parseAcceptHeader(header);
	return findBestMatch(acceptValues, options) || defaultValue;
}

export const AcceptModule = {
	language_lookup: (
		available: string,
		defaultLang: string,
		header: string,
	): string => {
		return lookupAcceptHeader(available, defaultLang, header);
	},

	charset_lookup: (
		available: string,
		defaultCharset: string,
		header: string,
	): string => {
		return lookupAcceptHeader(available, defaultCharset, header);
	},

	encoding_lookup: (
		available: string,
		defaultEncoding: string,
		header: string,
	): string => {
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
