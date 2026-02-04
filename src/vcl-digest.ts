import * as crypto from "node:crypto";
import xxhash from "xxhash-wasm";

type HashAlgorithm = "md5" | "sha1" | "sha224" | "sha256" | "sha384" | "sha512";
type CipherAlgorithm = "aes-128-cbc" | "aes-192-cbc" | "aes-256-cbc" | "aes-128-gcm" | "aes-192-gcm" | "aes-256-gcm" | "aes-128-ctr" | "aes-192-ctr" | "aes-256-ctr";

const xxhashInstance = await xxhash();

function hash(algorithm: HashAlgorithm, input: string): string {
	return crypto.createHash(algorithm).update(String(input)).digest("hex");
}

function hashFromBase64(algorithm: HashAlgorithm, input: string): string {
	try {
		const decoded = Buffer.from(String(input), "base64");
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
	return crypto
		.createHmac(algorithm, String(key))
		.update(String(input))
		.digest(encoding);
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
		const h = xxhashInstance.h32Raw(Buffer.from(String(input)), 0);
		return h.toString(16).padStart(8, "0");
	},

	hash_xxh64: (input: string): string => {
		const h = xxhashInstance.h64Raw(Buffer.from(String(input)), 0n);
		return h.toString(16).padStart(16, "0");
	},

	hash_sha1_from_base64: (input: string): string =>
		hashFromBase64("sha1", input),
	hash_sha256_from_base64: (input: string): string =>
		hashFromBase64("sha256", input),
	hash_sha512_from_base64: (input: string): string =>
		hashFromBase64("sha512", input),

	hash_xxh32_from_base64: (input: string): string => {
		try {
			const decoded = Buffer.from(String(input), "base64");
			const h = xxhashInstance.h32Raw(decoded, 0);
			return h.toString(16).padStart(8, "0");
		} catch {
			return "";
		}
	},

	hash_xxh64_from_base64: (input: string): string => {
		try {
			const decoded = Buffer.from(String(input), "base64");
			const h = xxhashInstance.h64Raw(decoded, 0n);
			return h.toString(16).padStart(16, "0");
		} catch {
			return "";
		}
	},

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
			.replace(/\//g, "_");
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
		let signature = Buffer.from("AWS4" + String(key));
		const parts = [
			String(dateStamp),
			String(region),
			String(service),
			"aws4_request",
			String(stringToSign),
		];
		for (const part of parts) {
			signature = crypto.createHmac("sha256", signature).update(part).digest();
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
		mode: string,
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
		mode: string,
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
		mode: string,
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
		mode: string,
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
