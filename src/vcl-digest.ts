import * as crypto from "node:crypto";

type HashAlgorithm = "md5" | "sha1" | "sha256" | "sha512";

function hash(algorithm: HashAlgorithm, input: string): string {
	return crypto.createHash(algorithm).update(String(input)).digest("hex");
}

function hmac(
	algorithm: HashAlgorithm,
	key: string,
	input: string,
	encoding: "hex" | "base64",
): string {
	return crypto
		.createHmac(algorithm, String(key))
		.update(String(input))
		.digest(encoding);
}

export const DigestModule = {
	hash_md5: (input: string): string => hash("md5", input),
	hash_sha1: (input: string): string => hash("sha1", input),
	hash_sha256: (input: string): string => hash("sha256", input),
	hash_sha512: (input: string): string => hash("sha512", input),

	// xxHash is not natively supported, using MD5 truncation as fallback
	hash_xxh32: (input: string): string => hash("md5", input).substring(0, 8),
	hash_xxh64: (input: string): string => hash("md5", input).substring(0, 16),

	hmac_md5: (key: string, input: string): string =>
		hmac("md5", key, input, "hex"),
	hmac_sha1: (key: string, input: string): string =>
		hmac("sha1", key, input, "hex"),
	hmac_sha256: (key: string, input: string): string =>
		hmac("sha256", key, input, "hex"),
	hmac_sha512: (key: string, input: string): string =>
		hmac("sha512", key, input, "hex"),

	hmac_md5_base64: (key: string, input: string): string =>
		hmac("md5", key, input, "base64"),
	hmac_sha1_base64: (key: string, input: string): string =>
		hmac("sha1", key, input, "base64"),
	hmac_sha256_base64: (key: string, input: string): string =>
		hmac("sha256", key, input, "base64"),
	hmac_sha512_base64: (key: string, input: string): string =>
		hmac("sha512", key, input, "base64"),

	secure_is_equal: (a: string, b: string): boolean => {
		try {
			return crypto.timingSafeEqual(
				Buffer.from(String(a)),
				Buffer.from(String(b)),
			);
		} catch {
			return false;
		}
	},

	base64: (input: string): string =>
		Buffer.from(String(input)).toString("base64"),

	base64_decode: (input: string): string => {
		try {
			return Buffer.from(String(input), "base64").toString("utf-8");
		} catch {
			return "";
		}
	},

	base64url: (input: string): string => {
		return Buffer.from(String(input))
			.toString("base64")
			.replace(/\+/g, "-")
			.replace(/\//g, "_")
			.replace(/=+$/, "");
	},

	base64url_decode: (input: string): string => {
		try {
			const base64 = String(input).replace(/-/g, "+").replace(/_/g, "/");
			const padding = base64.length % 4;
			const paddedBase64 = padding ? base64 + "=".repeat(4 - padding) : base64;
			return Buffer.from(paddedBase64, "base64").toString("utf-8");
		} catch {
			return "";
		}
	},

	base64url_nopad: (input: string): string => {
		return Buffer.from(String(input))
			.toString("base64")
			.replace(/\+/g, "-")
			.replace(/\//g, "_")
			.replace(/=+$/, "");
	},

	base64url_nopad_decode: (input: string): string =>
		DigestModule.base64url_decode(input),
};
