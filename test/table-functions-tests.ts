import { describe, expect, it } from "bun:test";
import { createVCLContext } from "../src/vcl";

describe("Table Functions Tests", () => {
	it("should create a table and add entries", () => {
		const context = createVCLContext();

		// Add a table
		expect(context.std!.table!.add("features")).toBe(true);

		// Add entries to the table
		expect(context.std!.table!.add_entry("features", "new_checkout", "true")).toBe(true);
		expect(context.std!.table!.add_entry("features", "new_ui", "false")).toBe(true);
		expect(context.std!.table!.add_entry("features", "max_items", 10)).toBe(true);
		expect(context.std!.table!.add_entry("features", "discount_rate", 0.15)).toBe(true);
		expect(context.std!.table!.add_entry("features", "is_enabled", true)).toBe(true);
		expect(context.std!.table!.add_entry("features", "url_pattern", "^/api/v[0-9]+")).toBe(true);

		// Verify the table was created with the correct entries
		expect(context.tables.features!).toBeDefined();
		expect(context.tables.features!.entries.new_checkout).toBe("true");
		expect(context.tables.features!.entries.new_ui).toBe("false");
		expect(context.tables.features!.entries.max_items).toBe(10);
		expect(context.tables.features!.entries.discount_rate).toBe(0.15);
		expect(context.tables.features!.entries.is_enabled).toBe(true);
		expect(context.tables.features!.entries.url_pattern).toBe("^/api/v[0-9]+");
	});

	it("should remove a table", () => {
		const context = createVCLContext();

		// Add a table
		context.std!.table!.add("features");

		// Add an entry to the table
		context.std!.table!.add_entry("features", "new_checkout", "true");

		// Remove the table
		expect(context.std!.table!.remove("features")).toBe(true);

		// Verify the table was removed
		expect(context.tables.features!).toBeUndefined();

		// Try to remove a non-existent table
		expect(context.std!.table!.remove("nonexistent")).toBe(false);
	});

	it("should remove an entry from a table", () => {
		const context = createVCLContext();

		// Add a table
		context.std!.table!.add("features");

		// Add entries to the table
		context.std!.table!.add_entry("features", "new_checkout", "true");
		context.std!.table!.add_entry("features", "new_ui", "false");

		// Remove an entry
		expect(context.std!.table!.remove_entry("features", "new_checkout")).toBe(true);

		// Verify the entry was removed
		expect(context.tables.features!.entries.new_checkout).toBeUndefined();
		expect(context.tables.features!.entries.new_ui).toBe("false");

		// Try to remove a non-existent entry
		expect(context.std!.table!.remove_entry("features", "nonexistent")).toBe(false);
	});

	it("should look up a key in a table and return its value as a string", () => {
		const context = createVCLContext();

		// Add a table
		context.std!.table!.add("features");

		// Add entries to the table
		context.std!.table!.add_entry("features", "new_checkout", "true");
		context.std!.table!.add_entry("features", "max_items", 10);
		context.std!.table!.add_entry("features", "is_enabled", true);

		// Look up string values
		expect(context.std!.table!.lookup("features", "new_checkout")).toBe("true");
		expect(context.std!.table!.lookup("features", "max_items")).toBe("10");
		expect(context.std!.table!.lookup("features", "is_enabled")).toBe("true");
		expect(context.std!.table!.lookup("features", "nonexistent")).toBe("");
		expect(context.std!.table!.lookup("features", "nonexistent", "default")).toBe("default");
		expect(context.std!.table!.lookup("nonexistent", "key")).toBe("");
		expect(context.std!.table!.lookup("nonexistent", "key", "default")).toBe("default");
	});

	it("should look up a key in a table and return its value as a boolean", () => {
		const context = createVCLContext();

		// Add a table
		context.std!.table!.add("features");

		// Add entries to the table
		context.std!.table!.add_entry("features", "string_true", "true");
		context.std!.table!.add_entry("features", "string_false", "false");
		context.std!.table!.add_entry("features", "number_zero", 0);
		context.std!.table!.add_entry("features", "number_nonzero", 1);
		context.std!.table!.add_entry("features", "bool_true", true);
		context.std!.table!.add_entry("features", "bool_false", false);

		// Look up boolean values
		expect(context.std!.table!.lookup_bool("features", "string_true")).toBe(true);
		expect(context.std!.table!.lookup_bool("features", "string_false")).toBe(false);
		expect(context.std!.table!.lookup_bool("features", "number_zero")).toBe(false);
		expect(context.std!.table!.lookup_bool("features", "number_nonzero")).toBe(true);
		expect(context.std!.table!.lookup_bool("features", "bool_true")).toBe(true);
		expect(context.std!.table!.lookup_bool("features", "bool_false")).toBe(false);
		expect(context.std!.table!.lookup_bool("features", "nonexistent")).toBe(false);
		expect(context.std!.table!.lookup_bool("features", "nonexistent", true)).toBe(true);
		expect(context.std!.table!.lookup_bool("nonexistent", "key")).toBe(false);
		expect(context.std!.table!.lookup_bool("nonexistent", "key", true)).toBe(true);
	});

	it("should look up a key in a table and return its value as an integer", () => {
		const context = createVCLContext();

		// Add a table
		context.std!.table!.add("settings");

		// Add entries to the table
		context.std!.table!.add_entry("settings", "string_integer", "42");
		context.std!.table!.add_entry("settings", "string_float", "3.14");
		context.std!.table!.add_entry("settings", "number_integer", 42);
		context.std!.table!.add_entry("settings", "number_float", 3.14);
		context.std!.table!.add_entry("settings", "bool_true", true);
		context.std!.table!.add_entry("settings", "bool_false", false);

		// Look up integer values
		expect(context.std!.table!.lookup_integer("settings", "string_integer")).toBe(42);
		expect(context.std!.table!.lookup_integer("settings", "string_float")).toBe(3); // Truncated
		expect(context.std!.table!.lookup_integer("settings", "number_integer")).toBe(42);
		expect(context.std!.table!.lookup_integer("settings", "number_float")).toBe(3); // Floored
		expect(context.std!.table!.lookup_integer("settings", "bool_true")).toBe(1);
		expect(context.std!.table!.lookup_integer("settings", "bool_false")).toBe(0);
		expect(context.std!.table!.lookup_integer("settings", "nonexistent")).toBe(0);
		expect(context.std!.table!.lookup_integer("settings", "nonexistent", 100)).toBe(100);
		expect(context.std!.table!.lookup_integer("nonexistent", "key")).toBe(0);
		expect(context.std!.table!.lookup_integer("nonexistent", "key", 100)).toBe(100);
	});

	it("should look up a key in a table and return its value as a float", () => {
		const context = createVCLContext();

		// Add a table
		context.std!.table!.add("settings");

		// Add entries to the table
		context.std!.table!.add_entry("settings", "string_integer", "42");
		context.std!.table!.add_entry("settings", "string_float", "3.14");
		context.std!.table!.add_entry("settings", "number_integer", 42);
		context.std!.table!.add_entry("settings", "number_float", 3.14);
		context.std!.table!.add_entry("settings", "bool_true", true);
		context.std!.table!.add_entry("settings", "bool_false", false);

		// Look up float values
		expect(context.std!.table!.lookup_float("settings", "string_integer")).toBe(42.0);
		expect(context.std!.table!.lookup_float("settings", "string_float")).toBe(3.14);
		expect(context.std!.table!.lookup_float("settings", "number_integer")).toBe(42.0);
		expect(context.std!.table!.lookup_float("settings", "number_float")).toBe(3.14);
		expect(context.std!.table!.lookup_float("settings", "bool_true")).toBe(1.0);
		expect(context.std!.table!.lookup_float("settings", "bool_false")).toBe(0.0);
		expect(context.std!.table!.lookup_float("settings", "nonexistent")).toBe(0.0);
		expect(context.std!.table!.lookup_float("settings", "nonexistent", 1.5)).toBe(1.5);
		expect(context.std!.table!.lookup_float("nonexistent", "key")).toBe(0.0);
		expect(context.std!.table!.lookup_float("nonexistent", "key", 1.5)).toBe(1.5);
	});

	it("should look up a key in a table and return its value as a regex", () => {
		const context = createVCLContext();

		// Add a table
		context.std!.table!.add("patterns");

		// Add entries to the table
		context.std!.table!.add_entry(
			"patterns",
			"email",
			"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$",
		);
		context.std!.table!.add_entry(
			"patterns",
			"url",
			"^https?://[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}(/.*)?$",
		);
		context.std!.table!.add_entry("patterns", "invalid", "\\d+"); // Valid regex

		// Look up regex values
		const emailRegex = context.std!.table!.lookup_regex("patterns", "email");
		const urlRegex = context.std!.table!.lookup_regex("patterns", "url");
		const invalidRegex = context.std!.table!.lookup_regex("patterns", "invalid");
		const nonexistentRegex = context.std!.table!.lookup_regex("patterns", "nonexistent");
		const defaultRegex = context.std!.table!.lookup_regex("patterns", "nonexistent", "abc");

		// Test the regex patterns
		expect(emailRegex.test("user@example.com")).toBe(true);
		expect(emailRegex.test("invalid-email")).toBe(false);
		expect(urlRegex.test("https://example.com")).toBe(true);
		expect(urlRegex.test("invalid-url")).toBe(false);
		expect(invalidRegex).toBeInstanceOf(RegExp);
		expect(nonexistentRegex).toBeInstanceOf(RegExp);
		expect(defaultRegex.test("abc")).toBe(true);
	});

	it("should check if a key exists in a table", () => {
		const context = createVCLContext();

		// Add a table
		context.std!.table!.add("features");

		// Add entries to the table
		context.std!.table!.add_entry("features", "new_checkout", "true");
		context.std!.table!.add_entry("features", "new_ui", "false");

		// Check if keys exist
		expect(context.std!.table!.contains("features", "new_checkout")).toBe(true);
		expect(context.std!.table!.contains("features", "new_ui")).toBe(true);
		expect(context.std!.table!.contains("features", "nonexistent")).toBe(false);
		expect(context.std!.table!.contains("nonexistent", "key")).toBe(false);
	});
});
