import { VCLLexer } from "../src/vcl-parser";
import { VCLParser } from "../src/vcl-parser-impl";
import { assert, runTestSuite, type TestSuite } from "./test-framework";

const suite: TestSuite = {
	name: "Parser Tests",
	tests: [
		{
			name: "include statement parsing",
			vclSnippet: "",
			run: async () => {},
			assertions: [
				() => {
					const vcl = `
include "feature_mod";
sub vcl_recv {
	set req.http.X-Test = "value";
}
`;
					const lexer = new VCLLexer(vcl);
					const tokens = lexer.tokenize();
					const parser = new VCLParser(tokens, vcl);
					const program = parser.parse();

					const hasInclude = program.includes.length === 1;
					const includeModule = program.includes[0]?.module === "feature_mod";
					return assert(hasInclude && includeModule, "should parse include statement");
				},
			],
		},
		{
			name: "include statement without semicolon",
			vclSnippet: "",
			run: async () => {},
			assertions: [
				() => {
					const vcl = `
include "feature_mod"
sub vcl_recv {
	return(pass);
}
`;
					const lexer = new VCLLexer(vcl);
					const tokens = lexer.tokenize();
					const parser = new VCLParser(tokens, vcl);
					const program = parser.parse();

					const hasInclude = program.includes.length === 1;
					return assert(hasInclude, "should parse include statement without semicolon");
				},
			],
		},
		{
			name: "import statement parsing",
			vclSnippet: "",
			run: async () => {},
			assertions: [
				() => {
					const vcl = `
import boltsort;
sub vcl_recv {
	return(pass);
}
`;
					const lexer = new VCLLexer(vcl);
					const tokens = lexer.tokenize();
					const parser = new VCLParser(tokens, vcl);
					const program = parser.parse();

					const hasImport = program.imports.length === 1;
					const importModule = program.imports[0]?.module === "boltsort";
					return assert(hasImport && importModule, "should parse import statement");
				},
			],
		},
		{
			name: "table declaration parsing",
			vclSnippet: "",
			run: async () => {},
			assertions: [
				() => {
					const vcl = `
table redirect_table {
	"/old": "/new",
	"/about": "/about-us",
}
sub vcl_recv {
	return(pass);
}
`;
					const lexer = new VCLLexer(vcl);
					const tokens = lexer.tokenize();
					const parser = new VCLParser(tokens, vcl);
					const program = parser.parse();

					const hasTable = program.tables.length === 1;
					const tableName = program.tables[0]?.name === "redirect_table";
					const hasEntries = program.tables[0]?.entries.length === 2;
					return assert(hasTable && tableName && hasEntries, "should parse table declaration");
				},
			],
		},
		{
			name: "backend declaration parsing",
			vclSnippet: "",
			run: async () => {},
			assertions: [
				() => {
					const vcl = `
backend origin_0 {
	.host = "example.com";
	.port = "443";
	.ssl = true;
}
sub vcl_recv {
	return(pass);
}
`;
					const lexer = new VCLLexer(vcl);
					const tokens = lexer.tokenize();
					const parser = new VCLParser(tokens, vcl);
					const program = parser.parse();

					const hasBackend = program.backends.length === 1;
					const backendName = program.backends[0]?.name === "origin_0";
					const hasProperties = program.backends[0]?.properties.length === 3;
					return assert(
						hasBackend && backendName && hasProperties,
						"should parse backend declaration",
					);
				},
			],
		},
		{
			name: "ACL parsing with IPv4",
			vclSnippet: "",
			run: async () => {},
			assertions: [
				() => {
					const vcl = `
acl internal {
	"192.168.1.0/24";
	"10.0.0.0/8";
}
sub vcl_recv {
	return(pass);
}
`;
					const lexer = new VCLLexer(vcl);
					const tokens = lexer.tokenize();
					const parser = new VCLParser(tokens, vcl);
					const program = parser.parse();

					const hasAcl = program.acls.length === 1;
					const aclName = program.acls[0]?.name === "internal";
					const hasEntries = program.acls[0]?.entries.length === 2;
					const firstEntry =
						program.acls[0]?.entries[0]?.ip === "192.168.1.0" &&
						program.acls[0]?.entries[0]?.subnet === 24;
					return assert(
						hasAcl && aclName && hasEntries && firstEntry,
						"should parse ACL with IPv4 CIDR",
					);
				},
			],
		},
		{
			name: "ACL parsing with external CIDR notation",
			vclSnippet: "",
			run: async () => {},
			assertions: [
				() => {
					const vcl = `
acl internal {
	"192.168.0.0"/16;
	"10.0.0.0"/8;
}
sub vcl_recv {
	return(pass);
}
`;
					const lexer = new VCLLexer(vcl);
					const tokens = lexer.tokenize();
					const parser = new VCLParser(tokens, vcl);
					const program = parser.parse();

					const hasAcl = program.acls.length === 1;
					const hasEntries = program.acls[0]?.entries.length === 2;
					const firstEntry =
						program.acls[0]?.entries[0]?.ip === "192.168.0.0" &&
						program.acls[0]?.entries[0]?.subnet === 16;
					const secondEntry =
						program.acls[0]?.entries[1]?.ip === "10.0.0.0" &&
						program.acls[0]?.entries[1]?.subnet === 8;
					return assert(
						hasAcl && hasEntries && firstEntry && secondEntry,
						"should parse ACL with external CIDR notation",
					);
				},
			],
		},
		{
			name: "multiple top-level declarations",
			vclSnippet: "",
			run: async () => {},
			assertions: [
				() => {
					const vcl = `
import boltsort;
include "common";

table redirects {
	"/old": "/new",
}

backend origin {
	.host = "example.com";
}

acl internal {
	"10.0.0.0/8";
}

sub vcl_recv {
	return(pass);
}

sub vcl_fetch {
	return(deliver);
}
`;
					const lexer = new VCLLexer(vcl);
					const tokens = lexer.tokenize();
					const parser = new VCLParser(tokens, vcl);
					const program = parser.parse();

					const hasImport = program.imports.length === 1;
					const hasInclude = program.includes.length === 1;
					const hasTable = program.tables.length === 1;
					const hasBackend = program.backends.length === 1;
					const hasAcl = program.acls.length === 1;
					const hasSubs = program.subroutines.length === 2;

					return assert(
						hasImport && hasInclude && hasTable && hasBackend && hasAcl && hasSubs,
						"should parse multiple top-level declarations",
					);
				},
			],
		},
	],
};

runTestSuite(suite);
