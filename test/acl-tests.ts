import { describe, expect, it } from "bun:test";
import { createVCLContext, executeVCL } from "../src/vcl";
import { VCLCompiler } from "../src/vcl-compiler";
import { VCLLexer } from "../src/vcl-lexer";
import { VCLParser } from "../src/vcl-parser-impl";

describe("ACL Tests", () => {
	it("should create an ACL and add entries", () => {
		const context = createVCLContext();

		// Add an ACL
		expect(context.std.acl.add("internal")).toBe(true);

		// Add entries to the ACL
		expect(context.std.acl.add_entry("internal", "127.0.0.1")).toBe(true);
		expect(context.std.acl.add_entry("internal", "192.168.0.0", 16)).toBe(true);
		expect(context.std.acl.add_entry("internal", "10.0.0.0", 8)).toBe(true);

		// Verify the ACL has the correct entries
		expect(context.acls.internal.entries.length).toBe(3);
		expect(context.acls.internal.entries[0].ip).toBe("127.0.0.1");
		expect(context.acls.internal.entries[0].subnet).toBeUndefined();
		expect(context.acls.internal.entries[1].ip).toBe("192.168.0.0");
		expect(context.acls.internal.entries[1].subnet).toBe(16);
		expect(context.acls.internal.entries[2].ip).toBe("10.0.0.0");
		expect(context.acls.internal.entries[2].subnet).toBe(8);
	});

	it("should check if an IP is in an ACL", () => {
		const context = createVCLContext();

		// Add an ACL
		context.std.acl.add("internal");

		// Add entries to the ACL
		context.std.acl.add_entry("internal", "127.0.0.1");
		context.std.acl.add_entry("internal", "192.168.0.0", 16);
		context.std.acl.add_entry("internal", "10.0.0.0", 8);

		// Check exact match
		expect(context.std.acl.check("127.0.0.1", "internal")).toBe(true);
		expect(context.std.acl.check("127.0.0.2", "internal")).toBe(false);

		// Check CIDR match
		expect(context.std.acl.check("192.168.1.1", "internal")).toBe(true);
		expect(context.std.acl.check("192.169.1.1", "internal")).toBe(false);
		expect(context.std.acl.check("10.1.1.1", "internal")).toBe(true);
		expect(context.std.acl.check("11.1.1.1", "internal")).toBe(false);
	});

	it("should remove entries from an ACL", () => {
		const context = createVCLContext();

		// Add an ACL
		context.std.acl.add("internal");

		// Add entries to the ACL
		context.std.acl.add_entry("internal", "127.0.0.1");
		context.std.acl.add_entry("internal", "192.168.0.0", 16);

		// Remove an entry
		expect(context.std.acl.remove_entry("internal", "127.0.0.1")).toBe(true);

		// Verify the entry was removed
		expect(context.acls.internal.entries.length).toBe(1);
		expect(context.acls.internal.entries[0].ip).toBe("192.168.0.0");
		expect(context.acls.internal.entries[0].subnet).toBe(16);

		// Try to remove a non-existent entry
		expect(context.std.acl.remove_entry("internal", "10.0.0.0", 8)).toBe(false);
	});

	it("should remove an ACL", () => {
		const context = createVCLContext();

		// Add an ACL
		context.std.acl.add("internal");

		// Add entries to the ACL
		context.std.acl.add_entry("internal", "127.0.0.1");

		// Remove the ACL
		expect(context.std.acl.remove("internal")).toBe(true);

		// Verify the ACL was removed
		expect(context.acls.internal).toBeUndefined();

		// Try to remove a non-existent ACL
		expect(context.std.acl.remove("external")).toBe(false);
	});

	it("should parse and compile VCL with ACL declarations", () => {
		const vclCode = `
      acl internal {
        "127.0.0.1";
        "192.168.0.0"/16;
        "10.0.0.0"/8;
      }

      sub vcl_recv {
        if (client.ip ~ internal) {
          return (pass);
        }
        return (lookup);
      }
    `;

		// Parse the VCL code
		const lexer = new VCLLexer(vclCode);
		const tokens = lexer.tokenize();
		const parser = new VCLParser(tokens);
		const ast = parser.parse();

		// Verify the AST has the ACL
		expect(ast.acls.length).toBe(1);
		expect(ast.acls[0].name).toBe("internal");
		expect(ast.acls[0].entries.length).toBe(3);

		// Compile the AST
		const compiler = new VCLCompiler(ast);
		const subroutines = compiler.compile();

		// Create a context with the client IP
		const context = createVCLContext();
		context.client.ip = "127.0.0.1";

		// Execute the vcl_recv subroutine
		const result = executeVCL(subroutines, "vcl_recv", context);

		// Verify the result
		expect(result).toBe("pass");
	});
});
