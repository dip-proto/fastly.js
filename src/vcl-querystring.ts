/**
 * VCL Query String Module - query string manipulation functionality
 */

function parseQueryString(queryString: string): URLSearchParams {
	const clean = queryString.startsWith("?")
		? queryString.substring(1)
		: queryString;
	return new URLSearchParams(clean);
}

export const QueryStringModule = {
	get(queryString: string, paramName: string): string | null {
		const params = parseQueryString(String(queryString));
		return params.get(String(paramName));
	},

	set(queryString: string, paramName: string, paramValue: string): string {
		const params = parseQueryString(String(queryString));
		params.set(String(paramName), String(paramValue));
		return params.toString();
	},

	add(queryString: string, paramName: string, paramValue: string): string {
		const params = parseQueryString(String(queryString));
		params.append(String(paramName), String(paramValue));
		return params.toString();
	},

	remove(queryString: string, paramName: string): string {
		const params = parseQueryString(String(queryString));
		params.delete(String(paramName));
		return params.toString();
	},

	clean(queryString: string): string {
		const params = parseQueryString(String(queryString));
		const cleanParams = new URLSearchParams();

		for (const [name, value] of params.entries()) {
			if (value !== "") {
				cleanParams.append(name, value);
			}
		}

		return cleanParams.toString();
	},

	filter(queryString: string, paramNames: string[]): string {
		const params = parseQueryString(String(queryString));
		const filteredParams = new URLSearchParams();

		for (const name of paramNames) {
			for (const value of params.getAll(name)) {
				filteredParams.append(name, value);
			}
		}

		return filteredParams.toString();
	},

	filter_except(queryString: string, paramNames: string[]): string {
		const params = parseQueryString(String(queryString));
		const filteredParams = new URLSearchParams();

		for (const [name, value] of params.entries()) {
			if (!paramNames.includes(name)) {
				filteredParams.append(name, value);
			}
		}

		return filteredParams.toString();
	},

	filtersep(queryString: string, prefix: string, separator: string): string {
		const params = parseQueryString(String(queryString));
		const filteredParams = new URLSearchParams();
		const regex = new RegExp(`^${prefix}${separator}`);

		for (const [name, value] of params.entries()) {
			if (!regex.test(name)) {
				filteredParams.append(name, value);
			}
		}

		return filteredParams.toString();
	},

	sort(queryString: string): string {
		const params = parseQueryString(String(queryString));
		const sortedParams = new URLSearchParams();
		const names = [...new Set(params.keys())].sort();

		for (const name of names) {
			for (const value of params.getAll(name)) {
				sortedParams.append(name, value);
			}
		}

		return sortedParams.toString();
	},

	globfilter(queryString: string, pattern: string): string {
		const params = parseQueryString(String(queryString));
		const filtered = new URLSearchParams();
		const glob = globToRegex(String(pattern));

		for (const [name, value] of params.entries()) {
			if (!glob.test(name)) {
				filtered.append(name, value);
			}
		}

		return filtered.toString();
	},

	globfilter_except(queryString: string, pattern: string): string {
		const params = parseQueryString(String(queryString));
		const filtered = new URLSearchParams();
		const glob = globToRegex(String(pattern));

		for (const [name, value] of params.entries()) {
			if (glob.test(name)) {
				filtered.append(name, value);
			}
		}

		return filtered.toString();
	},

	regfilter(queryString: string, pattern: string): string {
		const params = parseQueryString(String(queryString));
		const filtered = new URLSearchParams();

		try {
			const regex = new RegExp(String(pattern));
			for (const [name, value] of params.entries()) {
				if (!regex.test(name)) {
					filtered.append(name, value);
				}
			}
		} catch {
			return params.toString();
		}

		return filtered.toString();
	},

	regfilter_except(queryString: string, pattern: string): string {
		const params = parseQueryString(String(queryString));
		const filtered = new URLSearchParams();

		try {
			const regex = new RegExp(String(pattern));
			for (const [name, value] of params.entries()) {
				if (regex.test(name)) {
					filtered.append(name, value);
				}
			}
		} catch {
			return params.toString();
		}

		return filtered.toString();
	},
};

function globToRegex(pattern: string): RegExp {
	const escaped = pattern
		.replace(/[.+^${}()|[\]\\]/g, "\\$&")
		.replace(/\*/g, ".*")
		.replace(/\?/g, ".");
	return new RegExp(`^${escaped}$`);
}
