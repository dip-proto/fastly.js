/**
 * Unicode (utf8.*) Functions Tests
 *
 * Tests for the VCL Unicode functions:
 * - utf8.is_valid
 * - utf8.codepoint_count
 * - utf8.substr
 * - utf8.strpad
 * - utf8.translate
 *
 * The expected values come from Fastly's own test suite for these functions.
 */

import type { VCLContext, VCLSubroutines } from "../src/vcl-compiler";
import {
	assert,
	compileOutcome,
	executeSubroutine,
	runTestSuite,
	type TestSuite,
} from "./test-framework";

// The four codepoints of the Fastly test suite, one per UTF-8 encoded length.
const B1234 = "%7F%DF%BF%EF%BF%BF%F4%8F%BF%BF";
const SMILEYS = "%F0%9F%98%80%F0%9F%98%81";
// An unpaired surrogate: text that UTF-8 cannot encode.
const ILL_FORMED = "a\uD800b";
// A byte order mark. It is valid UTF-8, and it counts as one codepoint.
const BOM = "%EF%BB%BF";

const ROT13_FROM = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const ROT13_TO = "NOPQRSTUVWXYZABCDEFGHIJKLMnopqrstuvwxyzabcdefghijklm";

/** A vcl_recv that stores one expression, and the error after it. */
function recvHeader(expression: string): string {
	return `
    sub vcl_recv {
      set req.http.X = ${expression};
      set req.http.E = fastly.error;
    }
  `;
}

/** Run vcl_recv with headers that VCL source cannot write. */
function runWithHeaders(headers: Record<string, string>) {
	return async (context: VCLContext, subroutines: VCLSubroutines) => {
		Object.assign(context.req.http, headers);
		executeSubroutine(context, subroutines, "vcl_recv");
	};
}

const runRecv = runWithHeaders({});

/** A null expectation means the function returned a not-set STRING. */
function expectHeader(expected: string | null, error = "") {
	return [
		(context: VCLContext) => {
			const got = "X" in context.req.http ? context.req.http.X : null;
			return assert(
				got === expected,
				`req.http.X should be ${JSON.stringify(expected)}, got ${JSON.stringify(got)}`,
			);
		},
		(context: VCLContext) =>
			assert(
				context.req.http.E === error,
				`fastly.error should be ${JSON.stringify(error)}, got ${JSON.stringify(context.req.http.E)}`,
			),
	];
}

/** A utf8.translate call that must not load, and the error it must report. */
function expectLoadError(sets: string, message: string) {
	return () => {
		const outcome = compileOutcome(
			`sub vcl_recv { set req.http.x = utf8.translate(req.http.y, ${sets}); }`,
		);
		return assert(
			outcome.includes(message),
			`utf8.translate(${sets}) should fail with "${message}", got "${outcome}"`,
		);
	};
}

/** A utf8.translate call that must load. */
function expectLoads(sets: string) {
	return () => {
		const outcome = compileOutcome(
			`sub vcl_recv { set req.http.x = utf8.translate(req.http.y, ${sets}); }`,
		);
		return assert(outcome === "compiled", `utf8.translate(${sets}) should load, got "${outcome}"`);
	};
}

/** One translate case, with the sets from Fastly's own test. */
function translateCase(name: string, input: string, sets: [string, string], expected: string) {
	return {
		name,
		vclSnippet: recvHeader(`utf8.translate("${input}", "${sets[0]}", "${sets[1]}")`),
		run: runRecv,
		assertions: expectHeader(expected),
	};
}

const utf8FunctionsTests: TestSuite = {
	name: "Unicode Functions Tests",
	tests: [
		{
			name: "utf8.is_valid accepts ASCII, an empty string, and astral characters",
			vclSnippet: recvHeader(
				`"" + utf8.is_valid("abc") + utf8.is_valid("") + utf8.is_valid("${SMILEYS}") + utf8.is_valid("${B1234}")`,
			),
			run: runRecv,
			assertions: expectHeader("1111"),
		},
		{
			name: "utf8.is_valid rejects a not-set string and ill-formed text",
			vclSnippet: recvHeader(`"" + utf8.is_valid(req.http.Nope) + utf8.is_valid(req.http.Bad)`),
			run: runWithHeaders({ Bad: ILL_FORMED }),
			assertions: expectHeader("00"),
		},
		{
			name: "utf8.codepoint_count counts codepoints, not bytes",
			vclSnippet: recvHeader(
				`"" + utf8.codepoint_count("") + "," + utf8.codepoint_count("abc") + "," + utf8.codepoint_count("${SMILEYS}") + "," + utf8.codepoint_count("${B1234}")`,
			),
			run: runRecv,
			assertions: expectHeader("0,3,2,4"),
		},
		{
			name: "utf8.codepoint_count is zero for a not-set string and for ill-formed text",
			vclSnippet: recvHeader(
				`"" + utf8.codepoint_count(req.http.Nope) + utf8.codepoint_count(req.http.Bad)`,
			),
			run: runWithHeaders({ Bad: ILL_FORMED }),
			assertions: expectHeader("00"),
		},
		{
			name: "a leading byte order mark is valid text, and counts as one codepoint",
			vclSnippet: recvHeader(
				`"" + utf8.is_valid("${BOM}abc") + "," + utf8.codepoint_count("${BOM}abc") + "," + utf8.substr("${BOM}abc", 1, 3)`,
			),
			run: runRecv,
			assertions: expectHeader("1,4,abc"),
		},
		{
			name: "an astral character written as itself survives the lexer",
			vclSnippet: recvHeader(
				`"" + utf8.codepoint_count("\u{1F30A}") + "," + std.strlen("\u{1F30A}")`,
			),
			run: runRecv,
			assertions: expectHeader("1,4"),
		},
		{
			name: "std.strlen still counts the bytes of the same strings",
			vclSnippet: recvHeader(`"" + std.strlen("${SMILEYS}") + "," + std.strlen("${B1234}")`),
			run: runRecv,
			assertions: expectHeader("8,10"),
		},
		{
			name: "utf8.substr does to ASCII what substr does",
			vclSnippet: recvHeader(
				`utf8.substr("foobar", 0, 3) + "," + utf8.substr("foobar", 3, 2) + "," + utf8.substr("foobar", 3, 4) + "," + utf8.substr("foobar", -4, 2) + "," + utf8.substr("foobar", 1, -2) + "," + utf8.substr("foobar", -4, -1)`,
			),
			run: runRecv,
			assertions: expectHeader("foo,ba,bar,ob,oob,oba"),
		},
		{
			name: "utf8.substr cuts on codepoint boundaries",
			vclSnippet: recvHeader(
				`"" + utf8.codepoint_count(utf8.substr("${B1234}", 0, 1)) + utf8.codepoint_count(utf8.substr("${B1234}", 1, 5)) + utf8.codepoint_count(utf8.substr("${B1234}", -3, 2)) + utf8.codepoint_count(utf8.substr("${SMILEYS}", 1, 1))`,
			),
			run: runRecv,
			assertions: expectHeader("1321"),
		},
		{
			name: "utf8.substr keeps whole astral characters",
			vclSnippet: recvHeader(`utf8.substr("${SMILEYS}", 1, 1)`),
			run: runRecv,
			assertions: expectHeader("\u{1F601}"),
		},
		{
			name: "utf8.substr without a length runs to the end of the string",
			vclSnippet: recvHeader(`utf8.substr("foobar", 2)`),
			run: runRecv,
			assertions: expectHeader("obar"),
		},
		{
			name: "utf8.substr at the end of the string is empty",
			vclSnippet: recvHeader(`utf8.substr("foobar", 6, 1)`),
			run: runRecv,
			assertions: expectHeader(""),
		},
		{
			name: "utf8.substr past the end of the string is not set",
			vclSnippet: recvHeader(`utf8.substr("foobar", 7, 1)`),
			run: runRecv,
			assertions: expectHeader(null),
		},
		{
			name: "utf8.substr before the start of the string is not set",
			vclSnippet: recvHeader(`utf8.substr("foobar", -7, 1)`),
			run: runRecv,
			assertions: expectHeader(null),
		},
		{
			name: "utf8.substr of a not-set string is not set",
			vclSnippet: recvHeader("utf8.substr(req.http.Nope, 0, 1)"),
			run: runRecv,
			assertions: expectHeader(null),
		},
		{
			name: "utf8.substr of ill-formed text is not set",
			vclSnippet: recvHeader("utf8.substr(req.http.Bad, 0, 1)"),
			run: runWithHeaders({ Bad: ILL_FORMED }),
			assertions: expectHeader(null),
		},
		{
			name: "utf8.strpad pads on the left, and on the right for a negative width",
			vclSnippet: recvHeader(
				`utf8.strpad("before", 20, "xyz") + "," + utf8.strpad("after", -20, "xyz")`,
			),
			run: runRecv,
			assertions: expectHeader("xyzxyzxyzxyzxybefore,afterxyzxyzxyzxyzxyz"),
		},
		{
			name: "utf8.strpad counts the padding in codepoints",
			vclSnippet: recvHeader(
				`utf8.strpad("h", 7, "å") + "," + utf8.strpad("å", -3, "xyz") + "," + utf8.strpad("abc", 7, "\u{1F338}\u{1F33C}")`,
			),
			run: runRecv,
			assertions: expectHeader("ååååååh,åxy,\u{1F338}\u{1F33C}\u{1F338}\u{1F33C}abc"),
		},
		{
			name: "utf8.strpad leaves a string that is already wide enough",
			vclSnippet: recvHeader(
				`utf8.strpad("abc", 2, "xyz") + "," + utf8.strpad("unchanged", 0, "xyz")`,
			),
			run: runRecv,
			assertions: expectHeader("abc,unchanged"),
		},
		{
			name: "utf8.strpad without padding characters returns the string itself",
			vclSnippet: recvHeader(`utf8.strpad("abc", 20, "")`),
			run: runRecv,
			assertions: expectHeader("abc"),
		},
		{
			name: "utf8.strpad pads a not-set string from nothing",
			vclSnippet: recvHeader(`utf8.strpad(req.http.Nope, 5, "-")`),
			run: runRecv,
			assertions: expectHeader("-----"),
		},
		{
			name: "utf8.strpad reports EDOM for the smallest INTEGER width",
			vclSnippet: recvHeader(`utf8.strpad("abc", -9223372036854775808, "pad")`),
			run: runRecv,
			assertions: expectHeader("", "EDOM"),
		},
		{
			name: "utf8.strpad keeps a byte order mark and pads around it",
			vclSnippet: recvHeader(`utf8.strpad("${BOM}ab", 5, "-")`),
			run: runRecv,
			assertions: expectHeader("--\uFEFFab"),
		},
		{
			name: "utf8.strpad checks the pad string before anything else",
			vclSnippet: recvHeader(`utf8.strpad(req.http.Bad, 20, "")`),
			run: runWithHeaders({ Bad: ILL_FORMED }),
			assertions: expectHeader(ILL_FORMED),
		},
		{
			name: "utf8.strpad reports EUTF8 for ill-formed text",
			vclSnippet: recvHeader(`utf8.strpad(req.http.Bad, 20, "-")`),
			run: runWithHeaders({ Bad: ILL_FORMED }),
			assertions: expectHeader(null, "EUTF8"),
		},
		translateCase("utf8.translate maps one character", "abcabc", ["a", "b"], "bbcbbc"),
		translateCase(
			"utf8.translate reuses the last character of set2",
			"abcabc",
			["ab", "c"],
			"cccccc",
		),
		translateCase("utf8.translate maps each character in turn", "abcabc", ["abc", "de"], "deedee"),
		translateCase("utf8.translate maps multibyte characters", "être", ["éèê", "e"], "etre"),
		translateCase("utf8.translate passes unmapped characters through", "être", ["ab", "c"], "être"),
		translateCase(
			"utf8.translate over both cases of the alphabet",
			"The quick brown fox jumps over the lazy dog.",
			[ROT13_FROM, ROT13_TO],
			"Gur dhvpx oebja sbk whzcf bire gur ynml qbt.",
		),
		translateCase("utf8.translate of an empty string is empty", "", ["a", "b"], ""),
		{
			name: "utf8.translate of a not-set string is empty",
			vclSnippet: recvHeader(`utf8.translate(req.http.Nope, "a", "b")`),
			run: runRecv,
			assertions: expectHeader(""),
		},
		{
			name: "utf8.translate passes a byte order mark through",
			vclSnippet: recvHeader(`utf8.translate("${BOM}abc", "a", "b")`),
			run: runRecv,
			assertions: expectHeader("\uFEFFbbc"),
		},
		{
			name: "utf8.translate reports EUTF8 for ill-formed text",
			vclSnippet: recvHeader(`utf8.translate(req.http.Bad, "a", "b")`),
			run: runWithHeaders({ Bad: ILL_FORMED }),
			assertions: expectHeader(null, "EUTF8"),
		},
		{
			name: "utf8.translate example: ROT13",
			vclSnippet: `
        sub vcl_recv {
          declare local var.in STRING;
          declare local var.out STRING;
          set var.in = "Hello, world!";
          set var.out = utf8.translate(var.in, "${ROT13_FROM}", "${ROT13_TO}");
          set req.http.X = var.out;
          set req.http.E = fastly.error;
        }
      `,
			run: runRecv,
			assertions: expectHeader("Uryyb, jbeyq!"),
		},
		{
			name: "utf8.translate example: dropping accents from the URL",
			vclSnippet: `
        sub vcl_recv {
          set req.url = utf8.translate(req.url, "áäåéëíïóöøúü", "aaaeeiiooouu");
          set req.http.X = req.url;
          set req.http.E = fastly.error;
        }
      `,
			run: async (context: VCLContext, subroutines: VCLSubroutines) => {
				context.req.url = "/éø";
				executeSubroutine(context, subroutines, "vcl_recv");
			},
			assertions: expectHeader("/eo"),
		},
		{
			name: "utf8.translate needs constant sets that hold characters",
			run: async () => {},
			assertions: [
				expectLoadError('"", "b"', "Characters required in set1"),
				expectLoadError('"a", ""', "Characters required in set2"),
				expectLoadError('"a", "bc"', "Excess characters in set2: Expected 1 or fewer, got 2"),
				expectLoadError('req.http.z, "b"', "Expected a constant string for set1"),
				expectLoadError('"ab", req.http.z', "Expected a constant string for set2"),
				expectLoads('"a" + "b", "xy"'),
				expectLoads('"a" "b", "xy"'),
			],
		},
	],
};

export default utf8FunctionsTests;

if (import.meta.main) {
	runTestSuite(utf8FunctionsTests);
}
