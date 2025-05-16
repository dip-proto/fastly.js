import { describe, expect, it } from "bun:test";
import { createVCLContext } from "../src/vcl";

describe("VCL Table Functions Direct Tests", () => {
	it("should use table functions directly", () => {
		// Create a context with tables
		const context = createVCLContext();

		// Add tables and entries
		context.std.table.add("features");
		context.std.table.add_entry("features", "new_checkout", "true");
		context.std.table.add_entry("features", "is_enabled", true);

		context.std.table.add("settings");
		context.std.table.add_entry("settings", "max_items", 10);
		context.std.table.add_entry("settings", "discount_rate", 0.15);

		context.std.table.add("patterns");
		context.std.table.add_entry(
			"patterns",
			"url",
			"^https?://[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}(/.*)?$",
		);

		// Test table.lookup
		expect(context.std.table.lookup("features", "new_checkout")).toBe("true");
		expect(context.std.table.lookup("features", "nonexistent", "default")).toBe(
			"default",
		);

		// Test table.lookup_bool
		expect(context.std.table.lookup_bool("features", "is_enabled")).toBe(true);
		expect(context.std.table.lookup_bool("features", "nonexistent", true)).toBe(
			true,
		);

		// Test table.lookup_integer
		expect(context.std.table.lookup_integer("settings", "max_items")).toBe(10);
		expect(
			context.std.table.lookup_integer("settings", "nonexistent", 42),
		).toBe(42);

		// Test table.lookup_float
		expect(context.std.table.lookup_float("settings", "discount_rate")).toBe(
			0.15,
		);
		expect(context.std.table.lookup_float("settings", "nonexistent", 1.5)).toBe(
			1.5,
		);

		// Test table.contains
		expect(context.std.table.contains("features", "new_checkout")).toBe(true);
		expect(context.std.table.contains("features", "nonexistent")).toBe(false);

		// Test table.lookup_regex
		const regex = context.std.table.lookup_regex("patterns", "url");
		expect(regex).toBeInstanceOf(RegExp);
		expect(regex.test("https://example.com")).toBe(true);
		expect(regex.test("invalid-url")).toBe(false);
	});

	it("should handle missing tables and keys gracefully", () => {
		// Create a context with no tables
		const context = createVCLContext();

		// Test table.lookup
		expect(context.std.table.lookup("nonexistent", "key")).toBe("");
		expect(context.std.table.lookup("nonexistent", "key", "default")).toBe(
			"default",
		);

		// Test table.lookup_bool
		expect(context.std.table.lookup_bool("nonexistent", "key")).toBe(false);
		expect(context.std.table.lookup_bool("nonexistent", "key", true)).toBe(
			true,
		);

		// Test table.lookup_integer
		expect(context.std.table.lookup_integer("nonexistent", "key")).toBe(0);
		expect(context.std.table.lookup_integer("nonexistent", "key", 42)).toBe(42);

		// Test table.lookup_float
		expect(context.std.table.lookup_float("nonexistent", "key")).toBe(0.0);
		expect(context.std.table.lookup_float("nonexistent", "key", 1.5)).toBe(1.5);

		// Test table.contains
		expect(context.std.table.contains("nonexistent", "key")).toBe(false);

		// Test table.lookup_regex
		const regex = context.std.table.lookup_regex("nonexistent", "key");
		expect(regex).toBeInstanceOf(RegExp);
		expect(regex.source).toBe("(?:)");
	});
});
