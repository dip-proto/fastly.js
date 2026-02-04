/**
 * VCL Table Functions Module
 *
 * Implements all table.* functions from Fastly VCL.
 * Reference: https://developer.fastly.com/reference/vcl/functions/table/
 */

export interface TableEntry {
	key: string;
	value: any;
}

export interface Table {
	name: string;
	type?: string;
	entries: TableEntry[];
}

export interface Tables {
	[name: string]: Table;
}

export interface TableModule {
	lookup: (tables: Tables, tableName: string, key: string, defaultValue?: string) => string;
	lookup_bool: (tables: Tables, tableName: string, key: string, defaultValue?: boolean) => boolean;
	lookup_integer: (tables: Tables, tableName: string, key: string, defaultValue?: number) => number;
	lookup_float: (tables: Tables, tableName: string, key: string, defaultValue?: number) => number;
	lookup_ip: (tables: Tables, tableName: string, key: string, defaultValue?: string) => string;
	lookup_rtime: (tables: Tables, tableName: string, key: string, defaultValue?: number) => number;
	lookup_acl: (tables: Tables, tableName: string, key: string) => string | null;
	lookup_backend: (tables: Tables, tableName: string, key: string) => string | null;
	lookup_regex: (tables: Tables, tableName: string, key: string) => RegExp | null;
	contains: (tables: Tables, tableName: string, key: string) => boolean;
}

const IPV4_REGEX = /^(\d{1,3}\.){3}\d{1,3}$/;
const IPV6_REGEX = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;

function findInTable(tables: Tables, tableName: string, key: string): any | undefined {
	const table = tables[tableName];
	if (!table) return undefined;

	for (const entry of table.entries) {
		if (entry.key === key) return entry.value;
	}
	return undefined;
}

function parseTimeUnit(str: string, defaultValue: number): number {
	const match = str.match(/^(\d+(?:\.\d+)?)(ms|s|m|h|d)?$/);
	if (!match) {
		const parsed = parseFloat(str);
		return Number.isNaN(parsed) ? defaultValue : parsed;
	}

	const num = parseFloat(match[1] ?? "0");
	const unit = match[2] || "s";
	switch (unit) {
		case "ms":
			return num / 1000;
		case "s":
			return num;
		case "m":
			return num * 60;
		case "h":
			return num * 3600;
		case "d":
			return num * 86400;
		default:
			return num;
	}
}

export function createTableModule(): TableModule {
	return {
		lookup: (tables: Tables, tableName: string, key: string, defaultValue: string = ""): string => {
			const value = findInTable(tables, tableName, key);
			return value === undefined ? defaultValue : String(value);
		},

		lookup_bool: (
			tables: Tables,
			tableName: string,
			key: string,
			defaultValue: boolean = false,
		): boolean => {
			const value = findInTable(tables, tableName, key);
			if (value === undefined) return defaultValue;
			if (typeof value === "boolean") return value;

			const strValue = String(value).toLowerCase();
			if (strValue === "true" || strValue === "1" || strValue === "yes") return true;
			if (strValue === "false" || strValue === "0" || strValue === "no") return false;
			return defaultValue;
		},

		lookup_integer: (
			tables: Tables,
			tableName: string,
			key: string,
			defaultValue: number = 0,
		): number => {
			const value = findInTable(tables, tableName, key);
			if (value === undefined) return defaultValue;
			const parsed = parseInt(String(value), 10);
			return Number.isNaN(parsed) ? defaultValue : parsed;
		},

		lookup_float: (
			tables: Tables,
			tableName: string,
			key: string,
			defaultValue: number = 0,
		): number => {
			const value = findInTable(tables, tableName, key);
			if (value === undefined) return defaultValue;
			const parsed = parseFloat(String(value));
			return Number.isNaN(parsed) ? defaultValue : parsed;
		},

		lookup_ip: (
			tables: Tables,
			tableName: string,
			key: string,
			defaultValue: string = "0.0.0.0",
		): string => {
			const value = findInTable(tables, tableName, key);
			if (value === undefined) return defaultValue;

			const str = String(value);
			if (IPV4_REGEX.test(str) || IPV6_REGEX.test(str) || str.includes("::")) {
				return str;
			}
			return defaultValue;
		},

		lookup_rtime: (
			tables: Tables,
			tableName: string,
			key: string,
			defaultValue: number = 0,
		): number => {
			const value = findInTable(tables, tableName, key);
			if (value === undefined) return defaultValue;
			return parseTimeUnit(String(value), defaultValue);
		},

		lookup_acl: (tables: Tables, tableName: string, key: string): string | null => {
			const value = findInTable(tables, tableName, key);
			return value === undefined ? null : String(value);
		},

		lookup_backend: (tables: Tables, tableName: string, key: string): string | null => {
			const value = findInTable(tables, tableName, key);
			return value === undefined ? null : String(value);
		},

		lookup_regex: (tables: Tables, tableName: string, key: string): RegExp | null => {
			const value = findInTable(tables, tableName, key);
			if (value === undefined) return null;
			try {
				return new RegExp(String(value));
			} catch {
				return null;
			}
		},

		contains: (tables: Tables, tableName: string, key: string): boolean => {
			return findInTable(tables, tableName, key) !== undefined;
		},
	};
}
