/**
 * VCL UUID Module - UUID generation, validation, and conversion
 */

import {
	parse,
	stringify,
	v3 as uuidv3,
	v4 as uuidv4,
	v5 as uuidv5,
	validate,
	version,
} from "uuid";
import { getPlatform, type VCLPlatform } from "./platform";

const NAMESPACE_DNS = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";
const NAMESPACE_URL = "6ba7b811-9dad-11d1-80b4-00c04fd430c8";
const NAMESPACE_OID = "6ba7b812-9dad-11d1-80b4-00c04fd430c8";
const NAMESPACE_X500 = "6ba7b814-9dad-11d1-80b4-00c04fd430c8";

function uuidv7(platform: VCLPlatform): string {
	const timestamp = BigInt(platform.now());
	const bytes = platform.randomBytes(16);

	bytes[0] = Number((timestamp >> 40n) & 0xffn);
	bytes[1] = Number((timestamp >> 32n) & 0xffn);
	bytes[2] = Number((timestamp >> 24n) & 0xffn);
	bytes[3] = Number((timestamp >> 16n) & 0xffn);
	bytes[4] = Number((timestamp >> 8n) & 0xffn);
	bytes[5] = Number(timestamp & 0xffn);

	bytes[6] = (bytes[6]! & 0x0f) | 0x70;
	bytes[8] = (bytes[8]! & 0x3f) | 0x80;

	return stringify(bytes);
}

function isVersion(uuid: string, expectedVersion: number): boolean {
	return validate(String(uuid)) && version(String(uuid)) === expectedVersion;
}

export function createUUIDModule(platform?: VCLPlatform) {
	return {
		version3(namespace: string, name: string): string | null {
			try {
				return uuidv3(String(name), String(namespace));
			} catch {
				return null;
			}
		},

		version4(): string {
			return uuidv4();
		},

		version5(namespace: string, name: string): string | null {
			try {
				return uuidv5(String(name), String(namespace));
			} catch {
				return null;
			}
		},

		dns(): string {
			return NAMESPACE_DNS;
		},

		url(): string {
			return NAMESPACE_URL;
		},

		is_valid(uuid: string): boolean {
			return validate(String(uuid));
		},

		is_version3(uuid: string): boolean {
			return isVersion(uuid, 3);
		},

		is_version4(uuid: string): boolean {
			return isVersion(uuid, 4);
		},

		is_version5(uuid: string): boolean {
			return isVersion(uuid, 5);
		},

		decode(uuid: string): Uint8Array | null {
			if (!validate(String(uuid))) {
				return null;
			}
			return parse(String(uuid));
		},

		encode(binary: any): string {
			if (typeof binary === "string") {
				const values = binary.split(",").map(Number);
				binary = new Uint8Array(values);
			}

			if (!(binary instanceof Uint8Array) || binary.length !== 16) {
				return "";
			}

			return stringify(binary);
		},

		version7(): string {
			return uuidv7(platform ?? getPlatform());
		},

		is_version7(uuid: string): boolean {
			return isVersion(uuid, 7);
		},

		oid(): string {
			return NAMESPACE_OID;
		},

		x500(): string {
			return NAMESPACE_X500;
		},
	};
}

export const UUIDModule = createUUIDModule();
