export const UTF8Module = {
	is_valid: (s: string): boolean => {
		try {
			const buf = Buffer.from(String(s), "utf-8");
			return buf.toString("utf-8") === String(s);
		} catch {
			return false;
		}
	},

	codepoint_count: (s: string): number => {
		const str = String(s);
		try {
			const buf = Buffer.from(str, "utf-8");
			if (buf.toString("utf-8") !== str) return 0;
		} catch {
			return 0;
		}
		return [...str].length;
	},

	substr: (s: string, offset: number, length?: number): string | null => {
		const str = String(s);
		try {
			const buf = Buffer.from(str, "utf-8");
			if (buf.toString("utf-8") !== str) return null;
		} catch {
			return null;
		}

		const input = [...str];
		const off = Math.trunc(Number(offset));

		let start: number;
		if (off < 0) {
			start = input.length + off;
			if (start < 0) return "";
		} else {
			start = off;
		}

		let end: number;
		if (length === undefined || length === null) {
			end = input.length;
		} else {
			const len = Math.trunc(Number(length));
			if (len < 0) {
				end = input.length + len;
			} else {
				end = start + len;
				if (end < 0) return "";
			}
		}

		if (end > input.length) end = input.length;
		if (start > input.length) return "";
		if (end <= start) return "";

		return input.slice(start, end).join("");
	},

	strpad: (s: string, width: number, pad: string): string | null => {
		const str = String(s);
		const padStr = String(pad);

		if (padStr === "") return str;

		const w = Math.trunc(Number(width));

		if (!Number.isFinite(w) || w <= -Number.MAX_SAFE_INTEGER) return "";

		try {
			const buf1 = Buffer.from(padStr, "utf-8");
			if (buf1.toString("utf-8") !== padStr) return null;
			const buf2 = Buffer.from(str, "utf-8");
			if (buf2.toString("utf-8") !== str) return null;
		} catch {
			return null;
		}

		const origRunes = [...str];
		const padRunes = [...padStr];
		const origCount = origRunes.length;
		const paddedCount = Math.abs(w);

		if (origCount >= paddedCount) return str;

		const paddingCount = paddedCount - origCount;

		const padding: string[] = [];
		for (let i = 0; i < paddingCount; i++) {
			padding.push(padRunes[i % padRunes.length]!);
		}

		if (w < 0) {
			return str + padding.join("");
		}
		return padding.join("") + str;
	},
};
