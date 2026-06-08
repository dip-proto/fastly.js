// Phase 2 crypto compatibility gate.
//
// The Node and browser CryptoProviders must produce byte-identical output, so
// switching crypto backends never changes a VCL result. This runs the same
// vectors through both providers (and through node:crypto as the reference) and
// asserts they agree, then pins the RSA/ECDSA behaviour: the browser provider
// raises a loud UnsupportedFeatureError rather than silently returning false.

import { describe, expect, it } from "bun:test";
import * as nc from "node:crypto";
import {
	type HashAlgorithm,
	setDefaultPlatform,
	UnsupportedFeatureError,
	type VCLPlatform,
} from "../src/platform";
import { browserPlatform } from "../src/platform-browser";
import { nodePlatform } from "../src/platform-node";
import { createDigestModule } from "../src/vcl-digest";

// The digest module reaches crypto through the global provider, so to exercise a
// specific backend through the high-level functions we install it for the call
// and restore the Node platform afterwards.
function under<T>(platform: VCLPlatform, fn: () => T): T {
	setDefaultPlatform(platform);
	try {
		return fn();
	} finally {
		setDefaultPlatform(nodePlatform);
	}
}

const node = nodePlatform.crypto;
const web = browserPlatform.crypto;

const ALGOS: HashAlgorithm[] = ["md5", "sha1", "sha224", "sha256", "sha384", "sha512"];
const INPUTS = [
	"",
	"abc",
	"The quick brown fox jumps over the lazy dog",
	"日本語のテキスト",
	"x".repeat(1000),
];

const hex = (b: Uint8Array) => Buffer.from(b).toString("hex");

describe("crypto provider compatibility (Node vs browser)", () => {
	it("hashes are byte-identical across providers and node:crypto", () => {
		for (const algo of ALGOS) {
			for (const input of INPUTS) {
				const data = Buffer.from(input);
				const ref = nc.createHash(algo).update(data).digest("hex");
				expect(hex(node.hash(algo, data))).toBe(ref);
				expect(hex(web.hash(algo, data))).toBe(ref);
			}
		}
	});

	it("HMACs are byte-identical across providers and node:crypto", () => {
		for (const algo of ALGOS) {
			for (const input of INPUTS) {
				const key = Buffer.from("a-shared-secret-key");
				const data = Buffer.from(input);
				const ref = nc.createHmac(algo, key).update(data).digest("hex");
				expect(hex(node.hmac(algo, key, data))).toBe(ref);
				expect(hex(web.hmac(algo, key, data))).toBe(ref);
			}
		}
	});

	it("AES round-trips and cross-provider decrypts agree", () => {
		const cases = [
			{ algo: "aes-256-cbc", keyLen: 32, ivLen: 16 },
			{ algo: "aes-128-cbc", keyLen: 16, ivLen: 16 },
			{ algo: "aes-256-ctr", keyLen: 32, ivLen: 16 },
			{ algo: "aes-256-gcm", keyLen: 32, ivLen: 12 },
		];
		const plaintext = Buffer.from("attack at dawn, then regroup");
		for (const { algo, keyLen, ivLen } of cases) {
			const key = nc.randomBytes(keyLen);
			const iv = nc.randomBytes(ivLen);
			const nodeCt = node.encrypt(algo, key, iv, plaintext, false)!;
			const webCt = web.encrypt(algo, key, iv, plaintext, false)!;
			// Same ciphertext from both providers
			expect(hex(webCt)).toBe(hex(nodeCt));
			// Each decrypts the other's ciphertext
			expect(hex(web.decrypt(algo, key, iv, nodeCt, false)!)).toBe(hex(plaintext));
			expect(hex(node.decrypt(algo, key, iv, webCt, false)!)).toBe(hex(plaintext));
		}
	});

	it("AES-CBC with padding disabled agrees across providers", () => {
		const key = nc.randomBytes(32);
		const iv = nc.randomBytes(16);
		const block = Buffer.alloc(32, 0x41); // block-aligned
		const nodeCt = node.encrypt("aes-256-cbc", key, iv, block, true)!;
		const webCt = web.encrypt("aes-256-cbc", key, iv, block, true)!;
		expect(hex(webCt)).toBe(hex(nodeCt));
		expect(hex(web.decrypt("aes-256-cbc", key, iv, nodeCt, true)!)).toBe(hex(block));
	});

	it("constant-time equality has matching semantics", () => {
		const a = Buffer.from("identical-value");
		const b = Buffer.from("identical-value");
		const c = Buffer.from("different-value");
		const d = Buffer.from("shorter");
		for (const provider of [node, web]) {
			expect(provider.timingSafeEqual(a, b)).toBe(true);
			expect(provider.timingSafeEqual(a, c)).toBe(false);
			expect(provider.timingSafeEqual(a, d)).toBe(false);
		}
	});
});

describe("digest module compatibility (Node vs browser platform)", () => {
	const PIN = 1_700_000_000_000;
	const pinnedNode: VCLPlatform = { ...nodePlatform, now: () => PIN };
	const pinnedWeb: VCLPlatform = { ...browserPlatform, now: () => PIN };
	// The factory reads crypto/clock at call time, so the installed platform decides the backend.
	const digest = createDigestModule();
	const secret = Buffer.from("totp-secret").toString("base64");

	const cases: Array<[string, () => unknown]> = [
		["hash_sha256", () => digest.hash_sha256("compatibility-check")],
		["hash_md5", () => digest.hash_md5("compatibility-check")],
		["hmac_sha256", () => digest.hmac_sha256("key", "compatibility-check")],
		["base64", () => digest.base64("compatibility-check")],
		["base64url", () => digest.base64url("compatibility-check")],
		["awsv4_hmac", () => digest.awsv4_hmac("secret", "20240101", "us-east-1", "s3", "to-sign")],
		["time_hmac_sha256", () => digest.time_hmac_sha256(secret, 30, 0)],
	];

	it("high-level digest outputs match across providers", () => {
		for (const [name, fn] of cases) {
			expect({ [name]: under(pinnedWeb, fn) }).toEqual({ [name]: under(pinnedNode, fn) });
		}
		expect(under(pinnedWeb, () => digest.secure_is_equal("aaa", "aaa"))).toBe(true);
		expect(under(pinnedWeb, () => digest.secure_is_equal("aaa", "bbb"))).toBe(false);
	});
});

describe("RSA/ECDSA verification is loudly unsupported in the browser", () => {
	const digest = createDigestModule();

	it("browser provider throws UnsupportedFeatureError, never returns false", () => {
		expect(() =>
			browserPlatform.crypto.verifySignature("RSA-SHA256", "", new Uint8Array(), new Uint8Array()),
		).toThrow(UnsupportedFeatureError);
		// rsa_verify/ecdsa_verify must propagate the error, not swallow it to `false`
		expect(() =>
			under(browserPlatform, () => digest.rsa_verify("sha256", "pk", "p", "sig")),
		).toThrow(UnsupportedFeatureError);
		expect(() =>
			under(browserPlatform, () => digest.ecdsa_verify("sha256", "pk", "p", "sig")),
		).toThrow(UnsupportedFeatureError);
	});

	it("Node provider still verifies real signatures", () => {
		const { publicKey, privateKey } = nc.generateKeyPairSync("rsa", { modulusLength: 2048 });
		const payload = "data-to-sign";
		const sig = nc
			.sign("RSA-SHA256", Buffer.from(payload), privateKey)
			.toString("base64")
			.replace(/\+/g, "-")
			.replace(/\//g, "_")
			.replace(/=+$/, "");
		const pem = publicKey.export({ type: "spki", format: "pem" }).toString();
		expect(under(nodePlatform, () => digest.rsa_verify("sha256", pem, payload, sig))).toBe(true);
		expect(under(nodePlatform, () => digest.rsa_verify("sha256", pem, "tampered", sig))).toBe(
			false,
		);
	});
});
