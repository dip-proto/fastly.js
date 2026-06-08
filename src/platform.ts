// Host capabilities the VCL engine needs from its runtime, behind one interface
// so the engine never reaches for node:crypto, process, os, or console directly.
// The Node implementation lives in platform-node.ts; a browser implementation
// arrives in Phase 2. Crypto is deterministic, so it is exposed as a swappable
// module-level provider; the clock, randomness, hostname, environment, and
// logging are per-platform so a playground can pin them for reproducible runs.

export type HashAlgorithm = "md5" | "sha1" | "sha224" | "sha256" | "sha384" | "sha512";

export interface CryptoProvider {
	hash(algorithm: HashAlgorithm, data: Uint8Array): Uint8Array;
	hmac(algorithm: HashAlgorithm, key: Uint8Array, data: Uint8Array): Uint8Array;
	timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean;
	// AES encrypt/decrypt. `algorithm` is a node-style name such as "aes-256-gcm".
	// For GCM the 16-byte auth tag is appended to the ciphertext on encrypt and
	// expected at the tail of the input on decrypt. Returns null on failure.
	encrypt(
		algorithm: string,
		key: Uint8Array,
		iv: Uint8Array,
		data: Uint8Array,
		noPadding: boolean,
	): Uint8Array | null;
	decrypt(
		algorithm: string,
		key: Uint8Array,
		iv: Uint8Array,
		data: Uint8Array,
		noPadding: boolean,
	): Uint8Array | null;
	// RSA/ECDSA signature verification against a PEM public key. `algorithm` is a
	// node verifier name such as "RSA-SHA256" or "sha256".
	verifySignature(
		algorithm: string,
		publicKeyPem: string,
		data: Uint8Array,
		signature: Uint8Array,
	): boolean;
}

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogRecord {
	level: LogLevel;
	message: string;
	fields?: Record<string, unknown>;
}

// Emitted by the interpreter for each subroutine/statement so a UI can render a
// step-by-step trace. Default platforms ignore it.
export interface TraceEvent {
	phase: string;
	subroutine: string;
	statement?: { line: number; column: number };
	returnAction?: string;
	error?: string;
}

export interface VCLPlatform {
	crypto: CryptoProvider;
	now(): number;
	randomBytes(length: number): Uint8Array;
	hostname(): string;
	env(name: string): string | undefined;
	log(record: LogRecord): void;
	onTrace?(event: TraceEvent): void;
}

let defaultPlatform: VCLPlatform | null = null;

export function setDefaultPlatform(platform: VCLPlatform): void {
	defaultPlatform = platform;
}

export function getPlatform(): VCLPlatform {
	if (!defaultPlatform) {
		throw new Error("No VCL platform configured; call setDefaultPlatform() first");
	}
	return defaultPlatform;
}

// Crypto is reached directly by the singleton digest/misc modules, which do not
// receive a context. It tracks the default platform's provider.
export function getCrypto(): CryptoProvider {
	return getPlatform().crypto;
}

function withDetail(message: string, detail: unknown): string {
	return detail === undefined ? message : `${message} ${detail}`;
}

// A [0, 1) float derived from platform randomness, so randomness is pinnable
// for reproducible playground runs instead of reaching for Math.random().
export function randomFloat(platform: VCLPlatform): number {
	const b = platform.randomBytes(4);
	const u = ((b[0]! << 24) | (b[1]! << 16) | (b[2]! << 8) | b[3]!) >>> 0;
	return u / 0x100000000;
}

// Hex of a hash digest — the one place the engine turns bytes into a hex string.
export function hashHex(algorithm: HashAlgorithm, data: Uint8Array): string {
	return Buffer.from(getPlatform().crypto.hash(algorithm, data)).toString("hex");
}

// A rate-limit window identifier: a timestamp plus a short random suffix.
export function generateWindowId(platform: VCLPlatform): string {
	return `window_${platform.now()}_${randomFloat(platform).toString(36).substring(2, 9)}`;
}

export function logInfo(message: string, detail?: unknown): void {
	getPlatform().log({ level: "info", message: withDetail(message, detail) });
}

export function logWarn(message: string, detail?: unknown): void {
	getPlatform().log({ level: "warn", message: withDetail(message, detail) });
}

export function logError(message: string, detail?: unknown): void {
	getPlatform().log({ level: "error", message: withDetail(message, detail) });
}
