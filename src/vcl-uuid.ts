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

const NAMESPACE_DNS = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";
const NAMESPACE_URL = "6ba7b811-9dad-11d1-80b4-00c04fd430c8";

function isVersion(uuid: string, expectedVersion: number): boolean {
	return validate(String(uuid)) && version(String(uuid)) === expectedVersion;
}

export const UUIDModule = {
	version3(namespace: string, name: string): string {
		return uuidv3(String(name), String(namespace));
	},

	version4(): string {
		return uuidv4();
	},

	version5(namespace: string, name: string): string {
		return uuidv5(String(name), String(namespace));
	},

	dns(name: string): string {
		return uuidv5(String(name), NAMESPACE_DNS);
	},

	url(name: string): string {
		return uuidv5(String(name), NAMESPACE_URL);
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
};
