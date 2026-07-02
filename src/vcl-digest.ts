import { xxHash32 } from "js-xxhash";
import {
	getCrypto,
	getPlatform,
	type HashAlgorithm,
	UnsupportedFeatureError,
	type VCLPlatform,
} from "./platform";

type TOTPAlgorithm = "md5" | "sha1" | "sha256" | "sha512";

function toHex(b: Uint8Array): string {
	return Buffer.from(b).toString("hex");
}

function generateTOTP(
	base64Secret: string,
	period: number,
	algorithm: TOTPAlgorithm,
	platform: VCLPlatform,
): string {
	const keyBytes = Buffer.from(String(base64Secret), "base64");
	const counter = Math.floor(platform.now() / 1000 / period);
	const counterBuf = Buffer.alloc(8);
	counterBuf.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
	counterBuf.writeUInt32BE(counter >>> 0, 4);

	const hmacResult = getCrypto().hmac(algorithm, keyBytes, counterBuf);
	const offset = hmacResult[hmacResult.length - 1]! & 0x0f;
	const code =
		((hmacResult[offset]! & 0x7f) << 24) |
		((hmacResult[offset + 1]! & 0xff) << 16) |
		((hmacResult[offset + 2]! & 0xff) << 8) |
		(hmacResult[offset + 3]! & 0xff);

	const otp = (code % 1000000).toString().padStart(6, "0");
	const finalHash = getCrypto().hash(algorithm, Buffer.from(otp));
	return Buffer.from(finalHash).toString("base64");
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

function hash(algorithm: HashAlgorithm, input: string): string {
	return toHex(getCrypto().hash(algorithm, Buffer.from(String(input))));
}

function hashFromBase64(algorithm: HashAlgorithm, input: string): string {
	try {
		const decoded = Buffer.from(String(input), "base64");
		return toHex(getCrypto().hash(algorithm, decoded));
	} catch {
		return "";
	}
}

function hmac(
	algorithm: HashAlgorithm,
	key: string,
	input: string,
	encoding: "hex" | "base64",
): string | null {
	if (key === "") return null;
	const result = getCrypto().hmac(algorithm, Buffer.from(String(key)), Buffer.from(String(input)));
	return Buffer.from(result).toString(encoding);
}

const XXH64_MASK = 0xffffffffffffffffn;
const XXH64_P1 = 11400714785074694791n;
const XXH64_P2 = 14029467366897019727n;
const XXH64_P3 = 1609587929392839161n;
const XXH64_P4 = 9650029242287828579n;
const XXH64_P5 = 2870177450012600261n;

function xxh64Rotl(x: bigint, r: bigint): bigint {
	return ((x << r) | (x >> (64n - r))) & XXH64_MASK;
}

function xxh64Round(acc: bigint, input: bigint): bigint {
	acc = (acc + input * XXH64_P2) & XXH64_MASK;
	acc = xxh64Rotl(acc, 31n);
	return (acc * XXH64_P1) & XXH64_MASK;
}

function xxh64MergeRound(acc: bigint, val: bigint): bigint {
	acc ^= xxh64Round(0n, val);
	return (acc * XXH64_P1 + XXH64_P4) & XXH64_MASK;
}

function xxh64Read64(data: Uint8Array, i: number): bigint {
	let result = 0n;
	for (let j = 7; j >= 0; j--) {
		result = (result << 8n) | BigInt(data[i + j]!);
	}
	return result;
}

function xxh64Read32(data: Uint8Array, i: number): bigint {
	return BigInt(
		(data[i]! | (data[i + 1]! << 8) | (data[i + 2]! << 16) | (data[i + 3]! << 24)) >>> 0,
	);
}

function xxh64(data: Uint8Array, seed = 0n): bigint {
	const len = data.length;
	let h: bigint;
	let i = 0;

	if (len >= 32) {
		let v1 = (seed + XXH64_P1 + XXH64_P2) & XXH64_MASK;
		let v2 = (seed + XXH64_P2) & XXH64_MASK;
		let v3 = seed & XXH64_MASK;
		let v4 = (seed - XXH64_P1) & XXH64_MASK;

		for (; i + 32 <= len; i += 32) {
			v1 = xxh64Round(v1, xxh64Read64(data, i));
			v2 = xxh64Round(v2, xxh64Read64(data, i + 8));
			v3 = xxh64Round(v3, xxh64Read64(data, i + 16));
			v4 = xxh64Round(v4, xxh64Read64(data, i + 24));
		}

		h =
			(xxh64Rotl(v1, 1n) + xxh64Rotl(v2, 7n) + xxh64Rotl(v3, 12n) + xxh64Rotl(v4, 18n)) &
			XXH64_MASK;
		h = xxh64MergeRound(h, v1);
		h = xxh64MergeRound(h, v2);
		h = xxh64MergeRound(h, v3);
		h = xxh64MergeRound(h, v4);
	} else {
		h = (seed + XXH64_P5) & XXH64_MASK;
	}

	h = (h + BigInt(len)) & XXH64_MASK;

	for (; i + 8 <= len; i += 8) {
		h ^= xxh64Round(0n, xxh64Read64(data, i));
		h = (xxh64Rotl(h, 27n) * XXH64_P1 + XXH64_P4) & XXH64_MASK;
	}

	if (i + 4 <= len) {
		h ^= (xxh64Read32(data, i) * XXH64_P1) & XXH64_MASK;
		h = (xxh64Rotl(h, 23n) * XXH64_P2 + XXH64_P3) & XXH64_MASK;
		i += 4;
	}

	for (; i < len; i++) {
		h ^= (BigInt(data[i]!) * XXH64_P5) & XXH64_MASK;
		h = (xxh64Rotl(h, 11n) * XXH64_P1) & XXH64_MASK;
	}

	h ^= h >> 33n;
	h = (h * XXH64_P2) & XXH64_MASK;
	h ^= h >> 29n;
	h = (h * XXH64_P3) & XXH64_MASK;
	h ^= h >> 32n;

	return h;
}

function xxh64Hex(data: Uint8Array): string {
	return xxh64(data).toString(16).padStart(16, "0");
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

export function createDigestModule(boundPlatform?: VCLPlatform) {
	const totpPlatform = () => boundPlatform ?? getPlatform();
	return {
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

		hash_xxh64: (input: string): string => {
			return xxh64Hex(Buffer.from(String(input)));
		},

		hash_sha1_from_base64: (input: string): string => hashFromBase64("sha1", input),
		hash_sha256_from_base64: (input: string): string => hashFromBase64("sha256", input),
		hash_sha512_from_base64: (input: string): string => hashFromBase64("sha512", input),

		hash_xxh32_from_base64: (input: string): string => {
			try {
				const decoded = Buffer.from(String(input), "base64");
				const h = xxHash32(decoded);
				return h.toString(16).padStart(8, "0");
			} catch {
				return "";
			}
		},

		hash_xxh64_from_base64: (input: string): string => {
			try {
				const decoded = Buffer.from(String(input), "base64");
				return xxh64Hex(decoded);
			} catch {
				return "";
			}
		},

		hmac_md5: (key: string, input: string): string | null => {
			const result = hmac("md5", key, input, "hex");
			return result === null ? null : `0x${result}`;
		},
		hmac_sha1: (key: string, input: string): string | null => {
			const result = hmac("sha1", key, input, "hex");
			return result === null ? null : `0x${result}`;
		},
		hmac_sha256: (key: string, input: string): string | null => {
			const result = hmac("sha256", key, input, "hex");
			return result === null ? null : `0x${result}`;
		},
		hmac_sha512: (key: string, input: string): string | null => {
			const result = hmac("sha512", key, input, "hex");
			return result === null ? null : `0x${result}`;
		},

		hmac_md5_base64: (key: string, input: string): string | null =>
			hmac("md5", key, input, "base64"),
		hmac_sha1_base64: (key: string, input: string): string | null =>
			hmac("sha1", key, input, "base64"),
		hmac_sha256_base64: (key: string, input: string): string | null =>
			hmac("sha256", key, input, "base64"),
		hmac_sha512_base64: (key: string, input: string): string | null =>
			hmac("sha512", key, input, "base64"),

		time_hmac_md5: (key: string, interval: number, _offset: number): string => {
			return generateTOTP(key, interval, "md5", totpPlatform());
		},
		time_hmac_sha1: (key: string, interval: number, _offset: number): string => {
			return generateTOTP(key, interval, "sha1", totpPlatform());
		},
		time_hmac_sha256: (key: string, interval: number, _offset: number): string => {
			return generateTOTP(key, interval, "sha256", totpPlatform());
		},
		time_hmac_sha512: (key: string, interval: number, _offset: number): string => {
			return generateTOTP(key, interval, "sha512", totpPlatform());
		},

		hmac_sha256_with_base64_key: (base64Key: string, input: string): string | null => {
			const keyStr = String(base64Key);
			if (keyStr === "") return null;
			try {
				const key = Buffer.from(keyStr, "base64");
				const result = getCrypto().hmac("sha256", key, Buffer.from(String(input)));
				return `0x${Buffer.from(result).toString("hex")}`;
			} catch {
				return "";
			}
		},

		secure_is_equal: (a: string, b: string): boolean => {
			try {
				const bufA = Buffer.from(String(a));
				const bufB = Buffer.from(String(b));
				if (bufA.length !== bufB.length) return false;
				return getCrypto().timingSafeEqual(bufA, bufB);
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
			let signature: Uint8Array = Buffer.from(`AWS4${String(key)}`);
			const parts = [
				String(dateStamp),
				String(region),
				String(service),
				"aws4_request",
				String(stringToSign),
			];
			for (const part of parts) {
				signature = getCrypto().hmac("sha256", signature, Buffer.from(part));
			}
			return Buffer.from(signature).toString("hex").toLowerCase();
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
					default:
						sig = Buffer.from(String(signature).replace(/-/g, "+").replace(/_/g, "/"), "base64");
						break;
				}

				return getCrypto().verifySignature(
					`RSA-${algo.toUpperCase()}`,
					String(publicKey),
					Buffer.from(String(payload)),
					sig,
				);
			} catch (e) {
				if (e instanceof UnsupportedFeatureError) throw e;
				return false;
			}
		},

		ecdsa_verify: (
			hashMethod: string,
			publicKey: string,
			payload: string,
			signature: string,
			digestFormat: string = "der",
			base64Method: string = "url_nopad",
		): boolean => {
			try {
				const algo = String(hashMethod) === "default" ? "sha256" : String(hashMethod);
				const format = String(digestFormat).toLowerCase();
				let sigBuf: Buffer;

				switch (String(base64Method)) {
					case "standard":
						sigBuf = Buffer.from(String(signature), "base64");
						break;
					default:
						sigBuf = Buffer.from(String(signature).replace(/-/g, "+").replace(/_/g, "/"), "base64");
						break;
				}

				if (format === "jwt") {
					// JWT format: raw R || S (each 32 bytes for P-256)
					// Convert to DER format for Node.js crypto
					if (sigBuf.length !== 64) return false;
					const r = sigBuf.subarray(0, 32);
					const s = sigBuf.subarray(32, 64);

					function derEncodeInteger(buf: Buffer): Buffer {
						let i = 0;
						while (i < buf.length - 1 && buf[i] === 0) i++;
						const trimmed = buf.subarray(i);
						const needsPad = (trimmed[0]! & 0x80) !== 0;
						const len = trimmed.length + (needsPad ? 1 : 0);
						const result = Buffer.alloc(2 + len);
						result[0] = 0x02; // INTEGER tag
						result[1] = len;
						if (needsPad) {
							result[2] = 0x00;
							trimmed.copy(result, 3);
						} else {
							trimmed.copy(result, 2);
						}
						return result;
					}

					const derR = derEncodeInteger(r);
					const derS = derEncodeInteger(s);
					const seqLen = derR.length + derS.length;
					const derSig = Buffer.alloc(2 + seqLen);
					derSig[0] = 0x30; // SEQUENCE tag
					derSig[1] = seqLen;
					derR.copy(derSig, 2);
					derS.copy(derSig, 2 + derR.length);
					sigBuf = derSig;
				}

				return getCrypto().verifySignature(
					algo,
					String(publicKey),
					Buffer.from(String(payload)),
					sigBuf,
				);
			} catch (e) {
				if (e instanceof UnsupportedFeatureError) throw e;
				return false;
			}
		},
	};
}

export const DigestModule = createDigestModule();

function getCipherAlgorithm(cipher: string, mode: string): CipherAlgorithm | null {
	const c = String(cipher).toLowerCase();
	const m = String(mode).toLowerCase();
	const modeStr = m === "gcm" ? "gcm" : m === "ctr" ? "ctr" : "cbc";
	if (c === "aes128") return `aes-128-${modeStr}` as CipherAlgorithm;
	if (c === "aes192") return `aes-192-${modeStr}` as CipherAlgorithm;
	if (c === "aes256") return `aes-256-${modeStr}` as CipherAlgorithm;
	return null;
}

function cryptoEncrypt(
	cipher: string,
	mode: string,
	padding: string,
	keyHex: string,
	ivHex: string,
	plainData: Uint8Array,
): Uint8Array | null {
	const keyBuf = Buffer.from(String(keyHex), "hex");
	const ivBuf = Buffer.from(String(ivHex), "hex");
	const algo = getCipherAlgorithm(cipher, String(mode).toLowerCase());
	if (!algo) return null;
	const noPad = String(padding).toLowerCase() === "nopad";
	return getCrypto().encrypt(algo, keyBuf, ivBuf, plainData, noPad);
}

function cryptoDecrypt(
	cipher: string,
	mode: string,
	padding: string,
	keyHex: string,
	ivHex: string,
	cipherData: Uint8Array,
): Uint8Array | null {
	const keyBuf = Buffer.from(String(keyHex), "hex");
	const ivBuf = Buffer.from(String(ivHex), "hex");
	const algo = getCipherAlgorithm(cipher, String(mode).toLowerCase());
	if (!algo) return null;
	const noPad = String(padding).toLowerCase() === "nopad";
	return getCrypto().decrypt(algo, keyBuf, ivBuf, cipherData, noPad);
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
		const data = Buffer.from(String(plaintext), "base64");
		const result = cryptoEncrypt(cipher, mode, padding, key, iv, data);
		return result ? Buffer.from(result).toString("base64") : "";
	},

	decrypt_base64: (
		cipher: string,
		mode: string,
		padding: string,
		key: string,
		iv: string,
		ciphertext: string,
	): string => {
		const data = Buffer.from(String(ciphertext), "base64");
		const result = cryptoDecrypt(cipher, mode, padding, key, iv, data);
		return result ? Buffer.from(result).toString("base64") : "";
	},

	encrypt_hex: (
		cipher: string,
		mode: string,
		padding: string,
		key: string,
		iv: string,
		plaintext: string,
	): string => {
		const data = Buffer.from(String(plaintext), "hex");
		const result = cryptoEncrypt(cipher, mode, padding, key, iv, data);
		return result ? Buffer.from(result).toString("hex") : "";
	},

	decrypt_hex: (
		cipher: string,
		mode: string,
		padding: string,
		key: string,
		iv: string,
		ciphertext: string,
	): string => {
		const data = Buffer.from(String(ciphertext), "hex");
		const result = cryptoDecrypt(cipher, mode, padding, key, iv, data);
		return result ? Buffer.from(result).toString("hex") : "";
	},
};
