const IPV4_PATTERN = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

export function parseIPv4(ip: string): Uint8Array | null {
	const m = IPV4_PATTERN.exec(ip);
	if (!m) {
		return null;
	}
	const bytes = new Uint8Array(4);
	for (let i = 0; i < 4; i++) {
		const octet = m[i + 1]!;
		// Leading zeros are rejected (matches Go's netip.ParseAddr)
		if (octet.length > 1 && octet.startsWith("0")) {
			return null;
		}
		const num = parseInt(octet, 10);
		if (num > 255) {
			return null;
		}
		bytes[i] = num;
	}
	return bytes;
}

export function parseIPv6(ip: string): Uint8Array | null {
	if (!ip.includes(":")) {
		return null;
	}

	// Split off an eventual "::" compression
	const doubleColonIdx = ip.indexOf("::");
	if (doubleColonIdx !== ip.lastIndexOf("::")) {
		return null; // more than one "::"
	}

	let headStr: string;
	let tailStr: string | null;
	if (doubleColonIdx !== -1) {
		headStr = ip.slice(0, doubleColonIdx);
		tailStr = ip.slice(doubleColonIdx + 2);
	} else {
		headStr = ip;
		tailStr = null;
	}

	const parseGroups = (s: string): number[] | null => {
		if (s === "") {
			return [];
		}
		const groups: number[] = [];
		const parts = s.split(":");
		for (let i = 0; i < parts.length; i++) {
			const part = parts[i]!;
			// Embedded IPv4 is only allowed as the last group
			if (part.includes(".")) {
				if (i !== parts.length - 1) {
					return null;
				}
				const v4 = parseIPv4(part);
				if (!v4) {
					return null;
				}
				groups.push((v4[0]! << 8) | v4[1]!, (v4[2]! << 8) | v4[3]!);
				continue;
			}
			if (!/^[0-9a-fA-F]{1,4}$/.test(part)) {
				return null;
			}
			groups.push(parseInt(part, 16));
		}
		return groups;
	};

	const head = parseGroups(headStr);
	if (head === null) {
		return null;
	}
	let groups: number[];
	if (tailStr !== null) {
		const tail = parseGroups(tailStr);
		if (tail === null) {
			return null;
		}
		const missing = 8 - head.length - tail.length;
		if (missing < 1) {
			return null; // "::" must stand for at least one group
		}
		groups = [...head, ...new Array(missing).fill(0), ...tail];
	} else {
		groups = head;
	}

	if (groups.length !== 8) {
		return null;
	}

	const bytes = new Uint8Array(16);
	for (let i = 0; i < 8; i++) {
		bytes[i * 2] = groups[i]! >> 8;
		bytes[i * 2 + 1] = groups[i]! & 0xff;
	}
	return bytes;
}

function isValidIPv4(ip: string): boolean {
	return parseIPv4(String(ip)) !== null;
}

function isValidIPv6(ip: string): boolean {
	return parseIPv6(String(ip)) !== null;
}

export const AddressModule = {
	is_ipv4: (address: string): boolean => isValidIPv4(address),

	is_ipv6: (address: string): boolean => isValidIPv6(address),

	is_unix: (address: string): boolean => {
		return typeof address === "string" && address.startsWith("/") && !address.includes("\0");
	},

	// Ported from Fastly's documented behavior: the address bytes are treated
	// as a 128-bit big-endian integer (IPv4 occupies the low 32 bits), then
	// result = (bits >> start_bit) & ((1 << bit_count) - 1).
	extract_bits: (address: string, startBit: number, bitCount: number): number => {
		startBit = Math.trunc(Number(startBit));
		bitCount = Math.trunc(Number(bitCount));
		if (
			!Number.isFinite(startBit) ||
			!Number.isFinite(bitCount) ||
			startBit < 0 ||
			bitCount < 0 ||
			bitCount > 32 ||
			startBit + bitCount > 128
		) {
			return 0;
		}

		const addr = String(address);
		const bytes = parseIPv4(addr) ?? parseIPv6(addr);
		if (!bytes) {
			return 0;
		}

		let bits = 0n;
		for (const b of bytes) {
			bits = (bits << 8n) | BigInt(b);
		}

		const mask = (1n << BigInt(bitCount)) - 1n;
		const result = (bits >> BigInt(startBit)) & mask;
		return Number(BigInt.asIntN(64, result));
	},
};
