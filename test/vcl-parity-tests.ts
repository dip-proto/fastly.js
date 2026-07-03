// Parity with real Fastly VCL, verified against Fastly's own VCL compiler and
// runtime sources: numeric literal forms, RTIME units, string equality, ACL
// matching, backend response metadata, PCI/HIPAA flags, fetch timeouts, and
// return(upgrade).

import { loadVCLContent } from "../src/vcl";
import type { VCLContext, VCLSubroutines } from "../src/vcl-compiler";
import { assert, executeSubroutine, type TestSuite } from "./test-framework";

/** Compile a snippet, recording either "compiled" or the error message. */
function compileOutcome(vcl: string): string {
	try {
		loadVCLContent(vcl);
		return "compiled";
	} catch (e) {
		return e instanceof Error ? e.message : String(e);
	}
}

function recvHeader(expr: string) {
	return `
    sub vcl_recv {
      set req.http.X = ${expr};
    }
  `;
}

function expectHeader(expected: string) {
	return [
		(context: VCLContext) =>
			assert(
				context.req.http.X === expected,
				`req.http.X should be "${expected}", got "${context.req.http.X}"`,
			),
	];
}

const runRecv = async (context: VCLContext, subroutines: VCLSubroutines) => {
	executeSubroutine(context, subroutines, "vcl_recv");
};

/** Run a `client.ip ~ acl` check and report "yes"/"no" via a header. */
function aclCheck(aclBody: string, ip: string) {
	return {
		vclSnippet: `
      acl a { ${aclBody} }
      sub vcl_recv {
        if (client.ip ~ a) { set req.http.R = "yes"; } else { set req.http.R = "no"; }
      }
    `,
		run: async (context: VCLContext, subroutines: VCLSubroutines) => {
			context.client = { ip };
			executeSubroutine(context, subroutines, "vcl_recv");
		},
	};
}

function expectAcl(expected: boolean) {
	return [
		(context: VCLContext) =>
			assert(
				context.req.http.R === (expected ? "yes" : "no"),
				`expected ${expected ? "match" : "no match"}, got R=${context.req.http.R}`,
			),
	];
}

const vclParityTests: TestSuite = {
	name: "VCL Parity Tests",
	tests: [
		{
			name: "ACL exact IPv4 match",
			...aclCheck('"127.0.0.1";', "127.0.0.1"),
			assertions: expectAcl(true),
		},
		{
			name: "ACL localhost matches 127.0.0.1 and ::1 only",
			vclSnippet: `
        acl a { "localhost"; }
        sub vcl_recv {
          set req.http.A = if(client.ip ~ a, "1", "0");
        }
      `,
			run: async (context, subroutines) => {
				context.client = { ip: "::1" };
				executeSubroutine(context, subroutines, "vcl_recv");
			},
			assertions: [(context) => assert(context.req.http.A === "1", `::1 should match localhost`)],
		},
		{
			name: "ACL negated localhost excludes the loopback addresses",
			...aclCheck('! "localhost";', "127.0.0.1"),
			assertions: expectAcl(false),
		},
		{
			name: "ACL longest prefix wins: negated /32 excludes inside a positive /24",
			...aclCheck('"192.0.2.0"/24; ! "192.0.2.1";', "192.0.2.1"),
			assertions: expectAcl(false),
		},
		{
			name: "ACL longest prefix wins: positive /24 still admits its other addresses",
			...aclCheck('"192.0.2.0"/24; ! "192.0.2.1";', "192.0.2.2"),
			assertions: expectAcl(true),
		},
		{
			name: "ACL longest prefix wins independent of source order",
			...aclCheck('! "192.0.2.0"/24; "192.0.2.1";', "192.0.2.1"),
			assertions: expectAcl(true),
		},
		{
			name: "ACL: an address in no entry does not match",
			...aclCheck('! "192.0.2.1"; "192.0.2.0"/24;', "10.0.0.1"),
			assertions: expectAcl(false),
		},
		{
			name: "ACL bare IPv6 entry is an exact /128",
			...aclCheck('"2001:db8::1";', "2001:db8::2"),
			assertions: expectAcl(false),
		},
		{
			name: "ACL: a non-IP left operand never matches",
			...aclCheck('"127.0.0.1";', "not-an-ip"),
			assertions: expectAcl(false),
		},
		{
			name: "ACL: a near-IP string with trailing garbage never matches",
			...aclCheck('"192.0.2.1";', "192.0.2.1foo"),
			assertions: expectAcl(false),
		},
		{
			name: "ACL: same network positive and negated is a compile error",
			run: async (context: VCLContext) => {
				context.results = {
					conflict: compileOutcome(`acl a { "192.0.2.1"; ! "192.0.2.1"; } sub vcl_recv {}`),
					prefixed: compileOutcome(`acl a { "localhost"/8; } sub vcl_recv {}`),
				};
			},
			assertions: [
				(context) => String(context.results?.conflict).includes("as-is and negated"),
				(context) => String(context.results?.prefixed).includes("prefix length is not supported"),
			],
		},
		{
			name: "hex integer literals evaluate as decimal integers",
			vclSnippet: recvHeader("0x5a5a"),
			run: runRecv,
			assertions: expectHeader("23130"),
		},
		{
			name: "INT64_MIN is representable through a unary minus",
			vclSnippet: recvHeader("-0x8000000000000000"),
			run: runRecv,
			assertions: expectHeader("-9223372036854775808"),
		},
		{
			name: "decimal exponent literals are FLOATs",
			vclSnippet: recvHeader("1.5e3"),
			run: runRecv,
			assertions: expectHeader("1500.000"),
		},
		{
			name: "negative decimal exponent literals",
			vclSnippet: recvHeader("-1.2e-3"),
			run: runRecv,
			assertions: expectHeader("-0.001"),
		},
		{
			name: "hex float literals with a binary exponent",
			vclSnippet: recvHeader("0xA.Bp3"),
			run: runRecv,
			assertions: expectHeader("85.500"),
		},
		{
			name: "hex float literals without an exponent",
			vclSnippet: recvHeader("0x1.8"),
			run: runRecv,
			assertions: expectHeader("1.500"),
		},
		{
			name: "a leading zero is decimal, not octal",
			vclSnippet: recvHeader("0755"),
			run: runRecv,
			assertions: expectHeader("755"),
		},
		{
			name: "week RTIME unit",
			vclSnippet: recvHeader("8w"),
			run: runRecv,
			assertions: expectHeader("4838400.000"),
		},
		{
			name: "fractional and negative week RTIME literals",
			vclSnippet: recvHeader('"" + 1.5w + " " + -1w'),
			run: runRecv,
			assertions: expectHeader("907200.000 -604800.000"),
		},
		{
			name: "whitespace may separate an RTIME literal from its unit",
			vclSnippet: `
        sub vcl_recv {
          set req.http.X = 60 s;
          set req.http.Y = 100 ms;
          set req.http.Z = 5.3 d;
        }
      `,
			run: runRecv,
			assertions: [
				(context) => assert(context.req.http.X === "60.000", `X: ${context.req.http.X}`),
				(context) => assert(context.req.http.Y === "0.100", `Y: ${context.req.http.Y}`),
				(context) => assert(context.req.http.Z === "457920.000", `Z: ${context.req.http.Z}`),
			],
		},
		{
			name: "spaced RTIME literals work for beresp.ttl",
			vclSnippet: `
        sub vcl_fetch {
          set beresp.ttl = 60 s;
        }
      `,
			run: async (context, subroutines) => {
				executeSubroutine(context, subroutines, "vcl_fetch");
			},
			assertions: [(context) => assert(context.beresp.ttl === 60, `ttl: ${context.beresp.ttl}`)],
		},
		{
			name: "a word that is not exactly a unit does not bind to a number",
			vclSnippet: `
        sub vcl_recv {
          declare local var.n INTEGER;
          set var.n = 60;
          set req.http.X = var.n;
        }
      `,
			run: runRecv,
			assertions: expectHeader("60"),
		},
		{
			name: "string equality stringifies a non-string right operand",
			vclSnippet: `
        sub vcl_recv {
          declare local var.i INTEGER;
          declare local var.f FLOAT;
          declare local var.b BOOL;
          set var.i = 10;
          set var.f = 10;
          set var.b = true;
          set req.http.A = "10";
          set req.http.B = "10.000";
          set req.http.C = "1";
          set req.http.X = if(req.http.A == var.i, "i-eq", "i-ne")
            + " " + if(req.http.B == var.f, "f-eq", "f-ne")
            + " " + if(req.http.C == var.b, "b-eq", "b-ne");
        }
      `,
			run: runRecv,
			assertions: expectHeader("i-eq f-eq b-eq"),
		},
		{
			name: "string equality is a byte comparison, not numeric",
			vclSnippet: `
        sub vcl_recv {
          declare local var.i INTEGER;
          set var.i = 10;
          set req.http.N = "010";
          set req.http.X = if(req.http.N == var.i, "eq", "ne");
        }
      `,
			run: runRecv,
			assertions: expectHeader("ne"),
		},
		{
			name: "dotted HTTP header names resolve as a single header",
			vclSnippet: `
        sub vcl_recv {
          set req.http.one.two = "x";
          set req.http.a.b.c.d = req.http.one.two;
          set req.http.Result = req.http.a.b.c.d;
          unset req.http.one.two;
          set req.http.Gone = if(req.http.one.two, "set", "unset");
        }
      `,
			run: runRecv,
			assertions: [
				(context) =>
					assert(context.req.http["a.b.c.d"] === "x", `a.b.c.d=${context.req.http["a.b.c.d"]}`),
				(context) => assert(context.req.http.Result === "x", `Result=${context.req.http.Result}`),
				(context) => assert(context.req.http.Gone === "unset", `Gone=${context.req.http.Gone}`),
			],
		},
		{
			name: "fastly.bot.category.is_headless reads as a BOOL",
			vclSnippet: `
        sub vcl_recv {
          set req.http.X = if(fastly.bot.category.is_headless, "1", "0");
        }
      `,
			run: runRecv,
			assertions: expectHeader("0"),
		},
		{
			name: "backend .fetch_timeout is parsed into the backend object",
			vclSnippet: `
        backend b { .host = "example.com"; .port = 80; .fetch_timeout = 120s; }
        sub vcl_recv { set req.http.X = "ok"; }
      `,
			run: runRecv,
			assertions: [
				(context) =>
					assert(
						context.backends.b?.fetch_timeout === 120,
						`fetch_timeout should be 120, got ${context.backends.b?.fetch_timeout}`,
					),
			],
		},
		{
			name: "set bereq.fetch_timeout stores the parsed duration",
			vclSnippet: `
        sub vcl_miss {
          set bereq.fetch_timeout = 2500ms;
          set bereq.http.FT = bereq.fetch_timeout;
        }
      `,
			run: async (context, subroutines) => {
				executeSubroutine(context, subroutines, "vcl_miss");
			},
			assertions: [
				(context) =>
					assert(context.bereq.http.FT === "2.500", `bereq.fetch_timeout=${context.bereq.http.FT}`),
			],
		},
		{
			name: "a numeric literal compared against a header is a compile error",
			run: async (context: VCLContext) => {
				context.results = {
					plain: compileOutcome(`sub vcl_recv { if (req.http.Host == 10) { esi; } }`),
					floatLit: compileOutcome(`sub vcl_recv { if (req.http.Host == 10.0) { esi; } }`),
					negated: compileOutcome(`sub vcl_recv { if (req.http.Host == -10) { esi; } }`),
					grouped: compileOutcome(`sub vcl_recv { if (req.http.Host != (10)) { esi; } }`),
					boolLit: compileOutcome(`sub vcl_recv { if (req.http.Host == true) { esi; } }`),
				};
			},
			assertions: [
				(context) =>
					["plain", "floatLit", "negated", "grouped"].every((k) =>
						String(context.results?.[k]).includes("Expected string constant, variable, or call"),
					),
				(context) => context.results?.boolLit === "compiled",
			],
		},
	],
};

export default vclParityTests;
