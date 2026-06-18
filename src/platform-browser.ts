import { cbc, ctr, gcm } from "@noble/ciphers/aes.js";
import { hmac as nobleHmac } from "@noble/hashes/hmac.js";
import { md5, sha1 } from "@noble/hashes/legacy.js";
import { sha224, sha256, sha384, sha512 } from "@noble/hashes/sha2.js";
import type { CHash } from "@noble/hashes/utils.js";
import { Buffer as BufferPolyfill } from "buffer";
import {
	consoleLog,
	type CryptoProvider,
	type HashAlgorithm,
	setDefaultPlatform,
	UnsupportedFeatureError,
	type VCLPlatform,
} from "./platform";

const HASHES: Record<HashAlgorithm, CHash> = {
	md5,
	sha1,
	sha224,
	sha256,
	sha384,
	sha512,
};

// Splits a node-style "aes-256-gcm" name into its cipher mode. The key length
// already determines AES-128/192/256, so only the mode matters to noble.
function cipherMode(algorithm: string): "cbc" | "ctr" | "gcm" {
	if (algorithm.endsWith("-gcm")) return "gcm";
	if (algorithm.endsWith("-ctr")) return "ctr";
	return "cbc";
}

const webCrypto: CryptoProvider = {
	hash(algorithm: HashAlgorithm, data: Uint8Array): Uint8Array {
		return HASHES[algorithm](data);
	},

	hmac(algorithm: HashAlgorithm, key: Uint8Array, data: Uint8Array): Uint8Array {
		return nobleHmac(HASHES[algorithm], key, data);
	},

	timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
		if (a.length !== b.length) return false;
		let diff = 0;
		for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!;
		return diff === 0;
	},

	encrypt(algorithm, key, iv, data, noPadding): Uint8Array | null {
		try {
			const mode = cipherMode(algorithm);
			if (mode === "gcm") return gcm(key, iv).encrypt(data);
			if (mode === "ctr") return ctr(key, iv).encrypt(data);
			return cbc(key, iv, { disablePadding: noPadding }).encrypt(data);
		} catch {
			return null;
		}
	},

	decrypt(algorithm, key, iv, data, noPadding): Uint8Array | null {
		try {
			const mode = cipherMode(algorithm);
			if (mode === "gcm") return gcm(key, iv).decrypt(data);
			if (mode === "ctr") return ctr(key, iv).decrypt(data);
			return cbc(key, iv, { disablePadding: noPadding }).decrypt(data);
		} catch {
			return null;
		}
	},

	verifySignature(): never {
		throw new UnsupportedFeatureError(
			"RSA/ECDSA signature verification",
			"no synchronous implementation is available in the browser",
		);
	},
};

export const browserPlatform: VCLPlatform = {
	crypto: webCrypto,
	now: () => Date.now(),
	randomBytes: (length: number) => {
		const bytes = new Uint8Array(length);
		globalThis.crypto.getRandomValues(bytes);
		return bytes;
	},
	hostname: () => "localhost",
	env: () => undefined,
	log: consoleLog,
};

// The engine still uses Buffer pervasively (hex/base64 encoding). Browsers have
// no global Buffer, so provide the pure-JS polyfill. Migrating these call sites
// to Uint8Array is tracked as later cleanup.
if (typeof (globalThis as { Buffer?: unknown }).Buffer === "undefined") {
	(globalThis as { Buffer?: unknown }).Buffer = BufferPolyfill;
}

setDefaultPlatform(browserPlatform);
