import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createVCLContext, executeVCL } from "../src/vcl";
import { VCLCompiler } from "../src/vcl-compiler";
import { VCLLexer } from "../src/vcl-parser";
import { VCLParser } from "../src/vcl-parser-impl";

describe("VCL Table Functions Tests", () => {
	it("should execute VCL code with table functions", () => {
		// Load the VCL file
		const vclPath = join(__dirname, "fixtures/vcl-files/table-functions.vcl");
		const vclCode = readFileSync(vclPath, "utf-8");

		// Parse the VCL code
		const lexer = new VCLLexer(vclCode);
		const tokens = lexer.tokenize();
		const parser = new VCLParser(tokens, vclCode);
		const ast = parser.parse();

		// Compile the AST
		const compiler = new VCLCompiler(ast);
		const subroutines = compiler.compile();

		// Create a context with tables
		const context = createVCLContext();

		// Add tables and entries
		context.std!.table!.add("features");
		context.std!.table!.add_entry("features", "new_checkout", "true");
		context.std!.table!.add_entry("features", "is_enabled", true);

		context.std!.table!.add("settings");
		context.std!.table!.add_entry("settings", "max_items", 10);
		context.std!.table!.add_entry("settings", "discount_rate", 0.15);

		context.std!.table!.add("patterns");
		context.std!.table!.add_entry(
			"patterns",
			"url",
			"^https?://[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}(/.*)?$",
		);

		// Set up the request
		context.req.url = "https://example.com/test";
		context.req.method = "GET";
		context.req.http = {
			Host: "example.com",
			"User-Agent": "Mozilla/5.0",
		};

		// Execute the vcl_recv subroutine
		const result = executeVCL(subroutines, "vcl_recv", context);

		// Verify the result
		expect(result).toBe("lookup");

		// Verify the headers
		expect(context.req.http["Test-Lookup"]).toBe("true");
		expect(context.req.http["Test-Lookup-Bool"]).toBe("true");
		expect(context.req.http["Test-Lookup-Integer"]).toBe("10");
		expect(context.req.http["Test-Lookup-Float"]).toBe("0.15");
		expect(context.req.http["Test-Contains"]).toBe("true");
		expect(context.req.http["Test-Lookup-Regex"]).toBe("true");
	});

	it("should handle missing tables and keys gracefully", () => {
		// Load the VCL file
		const vclPath = join(__dirname, "fixtures/vcl-files/table-functions.vcl");
		const vclCode = readFileSync(vclPath, "utf-8");

		// Parse the VCL code
		const lexer = new VCLLexer(vclCode);
		const tokens = lexer.tokenize();
		const parser = new VCLParser(tokens, vclCode);
		const ast = parser.parse();

		// Compile the AST
		const compiler = new VCLCompiler(ast);
		const subroutines = compiler.compile();

		// Create a context with no tables
		const context = createVCLContext();

		// Set up the request
		context.req.url = "https://example.com/test";
		context.req.method = "GET";
		context.req.http = {
			Host: "example.com",
			"User-Agent": "Mozilla/5.0",
		};

		// Execute the vcl_recv subroutine
		const result = executeVCL(subroutines, "vcl_recv", context);

		// Verify the result
		expect(result).toBe("lookup");

		// Verify the headers with default values
		expect(context.req.http["Test-Lookup"]).toBe("default");
		expect(context.req.http["Test-Lookup-Bool"]).toBe("false");
		expect(context.req.http["Test-Lookup-Integer"]).toBe("0");
		expect(context.req.http["Test-Lookup-Float"]).toBe("0");
		expect(context.req.http["Test-Contains"]).toBe("false");
		expect(context.req.http["Test-Lookup-Regex"]).toBe("true");
	});
});
