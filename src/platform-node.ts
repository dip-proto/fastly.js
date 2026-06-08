import * as crypto from "node:crypto";
import * as os from "node:os";
import type { CryptoProvider, HashAlgorithm, LogRecord, VCLPlatform } from "./platform";
import { setDefaultPlatform } from "./platform";

const nodeCrypto: CryptoProvider = {
	hash(algorithm: HashAlgorithm, data: Uint8Array): Uint8Array {
		return crypto.createHash(algorithm).update(data).digest();
	},

	hmac(algorithm: HashAlgorithm, key: Uint8Array, data: Uint8Array): Uint8Array {
		return crypto.createHmac(algorithm, key).update(data).digest();
	},

	timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
		if (a.length !== b.length) return false;
		return crypto.timingSafeEqual(a, b);
	},

	encrypt(algorithm, key, iv, data, noPadding): Uint8Array | null {
		try {
			if (algorithm.endsWith("-gcm")) {
				const cipher = crypto.createCipheriv(algorithm, key, iv) as crypto.CipherGCM;
				const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
				return Buffer.concat([encrypted, cipher.getAuthTag()]);
			}
			const cipher = crypto.createCipheriv(algorithm, key, iv);
			if (noPadding) cipher.setAutoPadding(false);
			return Buffer.concat([cipher.update(data), cipher.final()]);
		} catch {
			return null;
		}
	},

	decrypt(algorithm, key, iv, data, noPadding): Uint8Array | null {
		try {
			if (algorithm.endsWith("-gcm")) {
				const tagLength = 16;
				if (data.length < tagLength) return null;
				const encrypted = data.subarray(0, data.length - tagLength);
				const tag = data.subarray(data.length - tagLength);
				const decipher = crypto.createDecipheriv(algorithm, key, iv) as crypto.DecipherGCM;
				decipher.setAuthTag(tag);
				return Buffer.concat([decipher.update(encrypted), decipher.final()]);
			}
			const decipher = crypto.createDecipheriv(algorithm, key, iv);
			if (noPadding) decipher.setAutoPadding(false);
			return Buffer.concat([decipher.update(data), decipher.final()]);
		} catch {
			return null;
		}
	},

	verifySignature(algorithm, publicKeyPem, data, signature): boolean {
		try {
			const verifier = crypto.createVerify(algorithm);
			verifier.update(data);
			return verifier.verify(publicKeyPem, signature);
		} catch {
			return false;
		}
	},
};

export const nodePlatform: VCLPlatform = {
	crypto: nodeCrypto,
	now: () => Date.now(),
	randomBytes: (length: number) => crypto.randomBytes(length),
	hostname: () => os.hostname(),
	env: (name: string) => process.env[name],
	log: (record: LogRecord) => {
		if (record.level === "error" || record.level === "warn") {
			console.error(record.message);
		} else {
			console.log(record.message);
		}
	},
};

setDefaultPlatform(nodePlatform);
