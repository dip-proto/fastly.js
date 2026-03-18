import * as crypto from "node:crypto";
import { xxHash32 } from "js-xxhash";
import sodium from "libsodium-wrappers";

// Initialize libsodium (it's async, but we ensure it's ready before use)
let sodiumReady = false;
const sodiumInit = sodium.ready.then(() => {
	sodiumReady = true;
});

type HashAlgorithm = "md5" | "sha1" | "sha224" | "sha256" | "sha384" | "sha512";
type TOTPAlgorithm = "md5" | "sha1" | "sha256" | "sha512";

function generateTOTP(base64Secret: string, period: number, algorithm: TOTPAlgorithm): string {
	const keyBytes = Buffer.from(String(base64Secret), "base64");
	const counter = Math.floor(Date.now() / 1000 / period);
	const counterBuf = Buffer.alloc(8);
	counterBuf.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
	counterBuf.writeUInt32BE(counter >>> 0, 4);

	const hmacResult = crypto.createHmac(algorithm, keyBytes).update(counterBuf).digest();
	const offset = hmacResult[hmacResult.length - 1]! & 0x0f;
	const code =
		((hmacResult[offset]! & 0x7f) << 24) |
		((hmacResult[offset + 1]! & 0xff) << 16) |
		((hmacResult[offset + 2]! & 0xff) << 8) |
		(hmacResult[offset + 3]! & 0xff);

	const otp = (code % 1000000).toString().padStart(6, "0");
	const finalHash = crypto.createHash(algorithm).update(otp).digest();
	return finalHash.toString("base64");
}

type CipherAlgorithm =
	| "aes-128-cbc"
	| "aes-192-cbc"
	| "aes-256-cbc"
	| "aes-128-gcm"
	| "aes-192-gcm"
	| "aes-256-gcm"
	| "aes-128-ctr"
	| "aes-192-ctr"
	| "aes-256-ctr";

// Use libsodium for SHA-256 and SHA-512 when available, fall back to node:crypto
function hash(algorithm: HashAlgorithm, input: string): string {
	if (sodiumReady) {
		const data = new TextEncoder().encode(String(input));
		if (algorithm === "sha256") {
			return Buffer.from(sodium.crypto_hash_sha256(data)).toString("hex");
		}
		if (algorithm === "sha512") {
			return Buffer.from(sodium.crypto_hash_sha512(data)).toString("hex");
		}
	}
	return crypto.createHash(algorithm).update(String(input)).digest("hex");
}

function hashFromBase64(algorithm: HashAlgorithm, input: string): string {
	try {
		const decoded = Buffer.from(String(input), "base64");
		if (sodiumReady) {
			if (algorithm === "sha256") {
				return Buffer.from(sodium.crypto_hash_sha256(decoded)).toString("hex");
			}
			if (algorithm === "sha512") {
				return Buffer.from(sodium.crypto_hash_sha512(decoded)).toString("hex");
			}
		}
		return crypto.createHash(algorithm).update(decoded).digest("hex");
	} catch {
		return "";
	}
}

function hmac(
	algorithm: HashAlgorithm,
	key: string,
	input: string,
	encoding: "hex" | "base64",
): string {
	if (sodiumReady) {
		const keyBytes = new TextEncoder().encode(String(key));
		const data = new TextEncoder().encode(String(input));
		if (algorithm === "sha256") {
			const state = sodium.crypto_auth_hmacsha256_init(keyBytes);
			sodium.crypto_auth_hmacsha256_update(state, data);
			const result = sodium.crypto_auth_hmacsha256_final(state);
			return Buffer.from(result).toString(encoding);
		}
		if (algorithm === "sha512") {
			const state = sodium.crypto_auth_hmacsha512_init(keyBytes);
			sodium.crypto_auth_hmacsha512_update(state, data);
			const result = sodium.crypto_auth_hmacsha512_final(state);
			return Buffer.from(result).toString(encoding);
		}
	}
	return crypto.createHmac(algorithm, String(key)).update(String(input)).digest(encoding);
}

function crc32(input: string): string {
	const data = Buffer.from(String(input));
	let crc = 0xffffffff;
	for (const c of data) {
		crc = crc ^ (c << 24);
		for (let j = 0; j < 8; j++) {
			if (crc & 0x80000000) {
				crc = (crc << 1) ^ 0x04c11db7;
			} else {
				crc = crc << 1;
			}
		}
	}
	crc = (0xffffffff ^ crc) >>> 0;
	const buf = Buffer.alloc(4);
	buf.writeUInt32LE(crc, 0);
	return buf.toString("hex");
}

function crc32b(input: string): string {
	const data = Buffer.from(String(input));
	let crc = 0xffffffff;
	for (const c of data) {
		crc = crc ^ c;
		for (let j = 0; j < 8; j++) {
			if (crc & 0x1) {
				crc = (crc >>> 1) ^ 0xedb88320;
			} else {
				crc = crc >>> 1;
			}
		}
	}
	crc = (0xffffffff ^ crc) >>> 0;
	const buf = Buffer.alloc(4);
	buf.writeUInt32LE(crc, 0);
	return buf.toString("hex");
}

export { sodiumInit };

export const DigestModule = {
	hash_md5: (input: string): string => hash("md5", input),
	hash_sha1: (input: string): string => hash("sha1", input),
	hash_sha224: (input: string): string => hash("sha224", input),
	hash_sha256: (input: string): string => hash("sha256", input),
	hash_sha384: (input: string): string => hash("sha384", input),
	hash_sha512: (input: string): string => hash("sha512", input),

	hash_crc32: (input: string): string => crc32(input),
	hash_crc32b: (input: string): string => crc32b(input),

	hash_xxh32: (input: string): string => {
		const h = xxHash32(String(input));
		return h.toString(16).padStart(8, "0");
	},

	// xxHash64 stub - js-xxhash only provides xxHash32
	hash_xxh64: (input: string): string => {
		const h = hash("sha256", input);
		return h.substring(0, 16);
	},

	hash_sha1_from_base64: (input: string): string => hashFromBase64("sha1", input),
	hash_sha256_from_base64: (input: string): string => hashFromBase64("sha256", input),
	hash_sha512_from_base64: (input: string): string => hashFromBase64("sha512", input),

	hash_xxh32_from_base64: (input: string): string => {
		try {
			const decoded = Buffer.from(String(input), "base64").toString();
			const h = xxHash32(decoded);
			return h.toString(16).padStart(8, "0");
		} catch {
			return "";
		}
	},

	hash_xxh64_from_base64: (input: string): string => {
		try {
			const decoded = Buffer.from(String(input), "base64");
			const h = hash("sha256", decoded.toString());
			return h.substring(0, 16);
		} catch {
			return "";
		}
	},

	hmac_md5: (key: string, input: string): string => hmac("md5", key, input, "hex"),
	hmac_sha1: (key: string, input: string): string => hmac("sha1", key, input, "hex"),
	hmac_sha256: (key: string, input: string): string => hmac("sha256", key, input, "hex"),
	hmac_sha512: (key: string, input: string): string => hmac("sha512", key, input, "hex"),

	hmac_md5_base64: (key: string, input: string): string => hmac("md5", key, input, "base64"),
	hmac_sha1_base64: (key: string, input: string): string => hmac("sha1", key, input, "base64"),
	hmac_sha256_base64: (key: string, input: string): string =>
		hmac("sha256", key, input, "base64"),
	hmac_sha512_base64: (key: string, input: string): string =>
		hmac("sha512", key, input, "base64"),

	time_hmac_md5: (key: string, interval: number, _offset: number): string => {
		return generateTOTP(key, interval, "md5");
	},
	time_hmac_sha1: (key: string, interval: number, _offset: number): string => {
		return generateTOTP(key, interval, "sha1");
	},
	time_hmac_sha256: (key: string, interval: number, _offset: number): string => {
		return generateTOTP(key, interval, "sha256");
	},
	time_hmac_sha512: (key: string, interval: number, _offset: number): string => {
		return generateTOTP(key, interval, "sha512");
	},

	hmac_sha256_with_base64_key: (base64Key: string, input: string): string | null => {
		const keyStr = String(base64Key);
		if (keyStr === "") return null;
		try {
			const key = Buffer.from(keyStr, "base64");
			if (sodiumReady) {
				const data = new TextEncoder().encode(String(input));
				const state = sodium.crypto_auth_hmacsha256_init(key);
				sodium.crypto_auth_hmacsha256_update(state, data);
				const result = sodium.crypto_auth_hmacsha256_final(state);
				return `0x${Buffer.from(result).toString("hex")}`;
			}
			return `0x${crypto.createHmac("sha256", key).update(String(input)).digest("hex")}`;
		} catch {
			return "";
		}
	},

	secure_is_equal: (a: string, b: string): boolean => {
		try {
			const bufA = Buffer.from(String(a));
			const bufB = Buffer.from(String(b));
			if (bufA.length !== bufB.length) return false;
			if (sodiumReady) {
				return sodium.memcmp(bufA, bufB);
			}
			return crypto.timingSafeEqual(bufA, bufB);
		} catch {
			return false;
		}
	},

	base64: (input: string): string => Buffer.from(String(input)).toString("base64"),

	base64_decode: (input: string): string => {
		try {
			return Buffer.from(String(input), "base64").toString("utf-8");
		} catch {
			return "";
		}
	},

	base64url: (input: string): string => {
		return Buffer.from(String(input)).toString("base64").replace(/\+/g, "-").replace(/\//g, "_");
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

	base64url_nopad_decode: (input: string): string => {
		try {
			const base64 = String(input).replace(/-/g, "+").replace(/_/g, "/");
			const padding = base64.length % 4;
			const paddedBase64 = padding ? base64 + "=".repeat(4 - padding) : base64;
			return Buffer.from(paddedBase64, "base64").toString("utf-8");
		} catch {
			return "";
		}
	},

	awsv4_hmac: (
		key: string,
		dateStamp: string,
		region: string,
		service: string,
		stringToSign: string,
	): string => {
		// AWS v4 uses HMAC-SHA256 throughout - use libsodium when available
		let signature: Buffer = Buffer.from(`AWS4${String(key)}`);
		const parts = [
			String(dateStamp),
			String(region),
			String(service),
			"aws4_request",
			String(stringToSign),
		];
		for (const part of parts) {
			if (sodiumReady) {
				const data = new TextEncoder().encode(part);
				const state = sodium.crypto_auth_hmacsha256_init(signature);
				sodium.crypto_auth_hmacsha256_update(state, data);
				signature = Buffer.from(sodium.crypto_auth_hmacsha256_final(state));
			} else {
				signature = crypto.createHmac("sha256", signature).update(part).digest() as Buffer;
			}
		}
		return signature.toString("hex").toLowerCase();
	},

	rsa_verify: (
		hashMethod: string,
		publicKey: string,
		payload: string,
		signature: string,
		base64Method: string = "url_nopad",
	): boolean => {
		try {
			const algo = String(hashMethod) === "default" ? "sha256" : String(hashMethod);
			let sig: Buffer;

			switch (String(base64Method)) {
				case "standard":
					sig = Buffer.from(String(signature), "base64");
					break;
				case "url":
				case "url_nopad":
				default:
					sig = Buffer.from(
						String(signature).replace(/-/g, "+").replace(/_/g, "/"),
						"base64",
					);
					break;
			}

			const verifier = crypto.createVerify(`RSA-${algo.toUpperCase()}`);
			verifier.update(String(payload));
			return verifier.verify(String(publicKey), sig);
		} catch {
			return false;
		}
	},

	ecdsa_verify: (
		hashMethod: string,
		publicKey: string,
		payload: string,
		signature: string,
		base64Method: string = "url_nopad",
	): boolean => {
		try {
			const algo = String(hashMethod) === "default" ? "sha256" : String(hashMethod);
			let sig: Buffer;

			switch (String(base64Method)) {
				case "standard":
					sig = Buffer.from(String(signature), "base64");
					break;
				case "url":
				case "url_nopad":
				default:
					sig = Buffer.from(
						String(signature).replace(/-/g, "+").replace(/_/g, "/"),
						"base64",
					);
					break;
			}

			const verifier = crypto.createVerify(algo);
			verifier.update(String(payload));
			return verifier.verify(String(publicKey), sig);
		} catch {
			return false;
		}
	},
};

function getCipherAlgorithm(cipher: string, keyLength: number): CipherAlgorithm | null {
	const c = String(cipher).toLowerCase();
	const mode = c.includes("gcm") ? "gcm" : c.includes("ctr") ? "ctr" : "cbc";
	if (keyLength === 16) return `aes-128-${mode}` as CipherAlgorithm;
	if (keyLength === 24) return `aes-192-${mode}` as CipherAlgorithm;
	if (keyLength === 32) return `aes-256-${mode}` as CipherAlgorithm;
	return null;
}

export const CryptoModule = {
	encrypt_base64: (
		cipher: string,
		_mode: string,
		padding: string,
		key: string,
		iv: string,
		plaintext: string,
	): string => {
		try {
			const keyBuf = Buffer.from(String(key));
			const ivBuf = Buffer.from(String(iv));
			const algo = getCipherAlgorithm(cipher, keyBuf.length);
			if (!algo) return "";

			const data = Buffer.from(String(plaintext), "base64");
			const cipherInst = crypto.createCipheriv(algo, keyBuf, ivBuf);

			if (String(padding).toLowerCase() === "nopad") {
				cipherInst.setAutoPadding(false);
			}

			const encrypted = Buffer.concat([cipherInst.update(data), cipherInst.final()]);
			return encrypted.toString("base64");
		} catch {
			return "";
		}
	},

	decrypt_base64: (
		cipher: string,
		_mode: string,
		padding: string,
		key: string,
		iv: string,
		ciphertext: string,
	): string => {
		try {
			const keyBuf = Buffer.from(String(key));
			const ivBuf = Buffer.from(String(iv));
			const algo = getCipherAlgorithm(cipher, keyBuf.length);
			if (!algo) return "";

			const data = Buffer.from(String(ciphertext), "base64");
			const decipher = crypto.createDecipheriv(algo, keyBuf, ivBuf);

			if (String(padding).toLowerCase() === "nopad") {
				decipher.setAutoPadding(false);
			}

			const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
			return decrypted.toString("base64");
		} catch {
			return "";
		}
	},

	encrypt_hex: (
		cipher: string,
		_mode: string,
		padding: string,
		key: string,
		iv: string,
		plaintext: string,
	): string => {
		try {
			const keyBuf = Buffer.from(String(key));
			const ivBuf = Buffer.from(String(iv));
			const algo = getCipherAlgorithm(cipher, keyBuf.length);
			if (!algo) return "";

			const data = Buffer.from(String(plaintext), "hex");
			const cipherInst = crypto.createCipheriv(algo, keyBuf, ivBuf);

			if (String(padding).toLowerCase() === "nopad") {
				cipherInst.setAutoPadding(false);
			}

			const encrypted = Buffer.concat([cipherInst.update(data), cipherInst.final()]);
			return encrypted.toString("hex");
		} catch {
			return "";
		}
	},

	decrypt_hex: (
		cipher: string,
		_mode: string,
		padding: string,
		key: string,
		iv: string,
		ciphertext: string,
	): string => {
		try {
			const keyBuf = Buffer.from(String(key));
			const ivBuf = Buffer.from(String(iv));
			const algo = getCipherAlgorithm(cipher, keyBuf.length);
			if (!algo) return "";

			const data = Buffer.from(String(ciphertext), "hex");
			const decipher = crypto.createDecipheriv(algo, keyBuf, ivBuf);

			if (String(padding).toLowerCase() === "nopad") {
				decipher.setAutoPadding(false);
			}

			const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
			return decrypted.toString("hex");
		} catch {
			return "";
		}
	},
};
