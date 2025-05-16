const IPV4_PATTERN = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
const IPV6_PATTERN =
	/^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^([0-9a-fA-F]{1,4}:){1,7}:|^([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}$|^([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}$|^([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}$|^([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}$|^([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}$|^[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})$|^:((:[0-9a-fA-F]{1,4}){1,7}|:)$/;

function isValidIPv4(ip: string): boolean {
	if (!IPV4_PATTERN.test(ip)) {
		return false;
	}
	const octets = ip.split(".");
	return octets.every((octet) => {
		const num = parseInt(octet, 10);
		return num >= 0 && num <= 255;
	});
}

function isValidIPv6(ip: string): boolean {
	return IPV6_PATTERN.test(ip);
}

function ipv4ToInt(ip: string): number {
	if (!isValidIPv4(ip)) {
		return 0;
	}
	const octets = ip.split(".");
	return (
		(parseInt(octets[0], 10) << 24) |
		(parseInt(octets[1], 10) << 16) |
		(parseInt(octets[2], 10) << 8) |
		parseInt(octets[3], 10)
	);
}

function extractBits(ipInt: number, offset: number, length: number): number {
	const mask = ((1 << length) - 1) << (32 - offset - length);
	return (ipInt & mask) >>> (32 - offset - length);
}

function extractBitsFromIPv4(
	ip: string,
	offset: number,
	length: number,
): number {
	if (
		!isValidIPv4(ip) ||
		offset < 0 ||
		offset > 31 ||
		length < 1 ||
		length > 32 ||
		offset + length > 32
	) {
		return 0;
	}
	return extractBits(ipv4ToInt(ip), offset, length);
}

function extractBitsFromIPv6(
	ip: string,
	offset: number,
	length: number,
): number {
	if (
		!isValidIPv6(ip) ||
		offset < 0 ||
		length < 1 ||
		offset > 31 ||
		length > 32 ||
		offset + length > 32
	) {
		return 0;
	}
	const parts = ip.split(":");
	const ipInt = (parseInt(parts[0], 16) << 16) | (parseInt(parts[1], 16) || 0);
	return extractBits(ipInt, offset, length);
}

export const AddressModule = {
	is_ipv4: (address: string): boolean => isValidIPv4(address),

	is_ipv6: (address: string): boolean => isValidIPv6(address),

	is_unix: (address: string): boolean => {
		return (
			typeof address === "string" &&
			address.startsWith("/") &&
			!address.includes("\0")
		);
	},

	extract_bits: (address: string, offset: number, length: number): number => {
		if (isValidIPv4(address)) {
			return extractBitsFromIPv4(address, offset, length);
		}
		if (isValidIPv6(address)) {
			return extractBitsFromIPv6(address, offset, length);
		}
		return 0;
	},
};
