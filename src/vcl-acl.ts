// ACL matching, implemented to match Fastly's semantics: an address matches an
// ACL when its most-specific (longest-prefix) containing entry is not negated.
// Negated entries are exclusions, "localhost" is exactly 127.0.0.1 and ::1, a
// bare IPv4 entry is a /32 and a bare IPv6 entry a /128, and a value that is
// not a parseable IP never matches.
//
// Addresses are parsed to bytes with the shared parsers in vcl-address.ts, so
// the ACL code and the addr.* builtins agree on what a valid IP is; an
// IPv4-mapped IPv6 entry is then just a 16-byte address a byte-wise prefix
// compare handles without a special case.

import { parseIPv4, parseIPv6 } from "./vcl-address";

export interface AclEntry {
	ip: string;
	subnet?: number;
	negated?: boolean;
}

type Family = "ipv4" | "ipv6";

interface Addr {
	family: Family;
	bytes: Uint8Array;
}

function toAddr(ip: string): Addr | null {
	const v4 = parseIPv4(ip);
	if (v4) return { family: "ipv4", bytes: v4 };
	const v6 = parseIPv6(ip);
	if (v6) return { family: "ipv6", bytes: v6 };
	return null;
}

export function getIPType(ip: string): Family | null {
	return toAddr(ip)?.family ?? null;
}

/** Whether the first `mask` bits of two equal-length addresses are identical. */
function prefixMatches(a: Uint8Array, b: Uint8Array, mask: number): boolean {
	const fullBytes = mask >> 3;
	for (let i = 0; i < fullBytes; i++) {
		if (a[i] !== b[i]) return false;
	}
	const remBits = mask & 7;
	if (remBits === 0) return true;
	const shift = 8 - remBits;
	return a[fullBytes]! >> shift === b[fullBytes]! >> shift;
}

interface ResolvedEntry {
	family: Family;
	bytes: Uint8Array;
	mask: number;
	negated: boolean;
}

// "localhost" is the one hostname Fastly accepts in an ACL; it stands for the
// two loopback addresses exactly.
const LOCALHOST_EXPANSION: ReadonlyArray<{ ip: string; mask: number }> = [
	{ ip: "127.0.0.1", mask: 32 },
	{ ip: "::1", mask: 128 },
];

function resolveEntry(entry: AclEntry): ResolvedEntry[] {
	const negated = entry.negated ?? false;
	const specs =
		entry.ip === "localhost" ? LOCALHOST_EXPANSION : [{ ip: entry.ip, mask: entry.subnet }];
	const resolved: ResolvedEntry[] = [];
	for (const spec of specs) {
		const addr = toAddr(spec.ip);
		if (!addr) continue;
		const mask = spec.mask ?? (addr.family === "ipv6" ? 128 : 32);
		resolved.push({ family: addr.family, bytes: addr.bytes, mask, negated });
	}
	return resolved;
}

/**
 * True when `ip` matches the ACL.
 * The most-specific containing entry wins; its negation flag decides the
 * result. A value that does not parse as an IP matches nothing.
 */
export function aclMatch(ip: string, entries: AclEntry[]): boolean {
	const query = toAddr(ip);
	if (!query) return false;
	let best: ResolvedEntry | null = null;
	for (const entry of entries) {
		for (const resolved of resolveEntry(entry)) {
			if (resolved.family !== query.family) continue;
			if (!prefixMatches(query.bytes, resolved.bytes, resolved.mask)) continue;
			if (best === null || resolved.mask > best.mask) best = resolved;
		}
	}
	return best !== null && !best.negated;
}

/** Canonical key for the network an entry covers (family, mask, masked bits). */
function networkKey(entry: ResolvedEntry): string {
	const fullBytes = entry.mask >> 3;
	const remBits = entry.mask & 7;
	let bits = "";
	for (let i = 0; i < fullBytes; i++) bits += entry.bytes[i]!.toString(16).padStart(2, "0");
	if (remBits) {
		const shift = 8 - remBits;
		bits += ((entry.bytes[fullBytes]! >> shift) << shift).toString(16).padStart(2, "0");
	}
	return `${entry.family}:${entry.mask}:${bits}`;
}

/**
 * Reject an ACL whose entries name the same network both as-is and negated,
 * the way Fastly's compiler does. Exact duplicates (same negation) are allowed.
 */
export function validateAclEntries(aclName: string, entries: AclEntry[]): void {
	const seen = new Map<string, boolean>();
	for (const entry of entries) {
		for (const resolved of resolveEntry(entry)) {
			const key = networkKey(resolved);
			const prior = seen.get(key);
			if (prior !== undefined) {
				if (prior !== resolved.negated) {
					throw new Error(`In acl "${aclName}" the same address as-is and negated: "${entry.ip}"`);
				}
			} else {
				seen.set(key, resolved.negated);
			}
		}
	}
}
