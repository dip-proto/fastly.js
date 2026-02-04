import { runTestSuite, createMockRequest, TestSuite, TestAssertion, assert } from "./test-framework";
import { DigestModule, CryptoModule } from "../src/vcl-digest";
import { QueryStringModule } from "../src/vcl-querystring";
import { UUIDModule } from "../src/vcl-uuid";
import { createStdModule } from "../src/vcl-std";
import { createMathModule } from "../src/vcl-math";
import { createParseTimeDelta } from "../src/vcl-time";
import { AcceptModule } from "../src/vcl-accept";
import {
	urlencode,
	urldecode,
	strtol,
	regsub,
	regsuball,
	substr,
	cstr_escape,
	json_escape,
	xml_escape,
	Utf8Module,
} from "../src/vcl-strings";

const suite: TestSuite = {
	name: "Builtin Functions Tests",
	tests: [
		{
			name: "digest.hash_xxh32",
			vclSnippet: "",
			run: async () => {},
			assertions: [
				() => assert(DigestModule.hash_xxh32("example") === "6bd15b98", "xxh32('example') should be 6bd15b98"),
			],
		},
		{
			name: "digest.hash_xxh64",
			vclSnippet: "",
			run: async () => {},
			assertions: [
				() => assert(DigestModule.hash_xxh64("example") === "e6eda53558c41c5e", "xxh64('example') should be e6eda53558c41c5e"),
			],
		},
		{
			name: "digest.hash_crc32",
			vclSnippet: "",
			run: async () => {},
			assertions: [
				() => assert(DigestModule.hash_crc32("123456789") === "181989fc", "crc32('123456789') should be 181989fc"),
			],
		},
		{
			name: "digest.hash_crc32b",
			vclSnippet: "",
			run: async () => {},
			assertions: [
				() => assert(DigestModule.hash_crc32b("123456789") === "2639f4cb", "crc32b('123456789') should be 2639f4cb"),
			],
		},
		{
			name: "urlencode multibyte",
			vclSnippet: "",
			run: async () => {},
			assertions: [
				() => assert(urlencode("あ") === "%E3%81%82", "urlencode('あ') should be %E3%81%82"),
			],
		},
		{
			name: "urlencode emoji",
			vclSnippet: "",
			run: async () => {},
			assertions: [
				() => assert(urlencode("𠮷😯") === "%F0%A0%AE%B7%F0%9F%98%AF", "urlencode should handle emojis"),
			],
		},
		{
			name: "urldecode",
			vclSnippet: "",
			run: async () => {},
			assertions: [
				() => assert(urldecode("%E3%81%82") === "あ", "urldecode should decode multibyte"),
				() => assert(urldecode("hello%20world") === "hello world", "urldecode should decode space"),
			],
		},
		{
			name: "strtol base 0 auto-detection",
			vclSnippet: "",
			run: async () => {},
			assertions: [
				() => assert(strtol("123", 0) === 123, "strtol('123', 0) should be 123"),
				() => assert(strtol("0123", 0) === 83, "strtol('0123', 0) should be 83 (octal)"),
				() => assert(strtol("0xABC", 0) === 2748, "strtol('0xABC', 0) should be 2748 (hex)"),
			],
		},
		{
			name: "strtol with 0x prefix",
			vclSnippet: "",
			run: async () => {},
			assertions: [
				() => assert(strtol("0xABC", 16) === 2748, "strtol('0xABC', 16) should be 2748"),
				() => assert(strtol("0xABC", 24) === 6036, "strtol('0xABC', 24) should strip 0x and parse ABC"),
			],
		},
		{
			name: "regsub backreference",
			vclSnippet: "",
			run: async () => {},
			assertions: [
				() => assert(regsub("hello world", "(\\w+) (\\w+)", "\\2 \\1") === "world hello", "regsub should support \\1 backreferences"),
			],
		},
		{
			name: "regsuball backreference",
			vclSnippet: "",
			run: async () => {},
			assertions: [
				() => assert(regsuball("abc123def456", "(\\d+)", "[\\1]") === "abc[123]def[456]", "regsuball should support \\1 backreferences"),
			],
		},
		{
			name: "substr negative offset",
			vclSnippet: "",
			run: async () => {},
			assertions: [
				() => assert(substr("hello", -2) === "lo", "substr with negative offset"),
				() => assert(substr("hello", -10) === "", "substr with too negative offset"),
			],
		},
		{
			name: "substr negative length",
			vclSnippet: "",
			run: async () => {},
			assertions: [
				() => assert(substr("hello world", 0, -1) === "hello worl", "substr with negative length"),
			],
		},
		{
			name: "cstr_escape",
			vclSnippet: "",
			run: async () => {},
			assertions: [
				() => assert(cstr_escape('hello\nworld') === 'hello\\nworld', "cstr_escape should escape newlines"),
				() => assert(cstr_escape('hello\tworld') === 'hello\\tworld', "cstr_escape should escape tabs"),
			],
		},
		{
			name: "json_escape",
			vclSnippet: "",
			run: async () => {},
			assertions: [
				() => assert(json_escape('hello"world') === 'hello\\"world', "json_escape should escape quotes"),
				() => assert(json_escape('hello\nworld') === 'hello\\nworld', "json_escape should escape newlines"),
			],
		},
		{
			name: "xml_escape",
			vclSnippet: "",
			run: async () => {},
			assertions: [
				() => assert(xml_escape('<div>') === '&lt;div&gt;', "xml_escape should escape angle brackets"),
				() => assert(xml_escape('"test"') === '&quot;test&quot;', "xml_escape should escape quotes"),
			],
		},
		{
			name: "utf8 functions",
			vclSnippet: "",
			run: async () => {},
			assertions: [
				() => assert(Utf8Module.is_valid("hello") === true, "utf8.is_valid should return true for valid string"),
				() => assert(Utf8Module.codepoint_count("hello") === 5, "utf8.codepoint_count('hello') should be 5"),
				() => assert(Utf8Module.codepoint_count("日本語") === 3, "utf8.codepoint_count('日本語') should be 3"),
				() => assert(Utf8Module.substr("hello", 1, 3) === "ell", "utf8.substr should work correctly"),
			],
		},
		{
			name: "querystring.globfilter",
			vclSnippet: "",
			run: async () => {},
			assertions: [
				() => assert(QueryStringModule.globfilter("a=1&ab=2&b=3", "a*") === "b=3", "globfilter should remove matching params"),
			],
		},
		{
			name: "querystring.regfilter",
			vclSnippet: "",
			run: async () => {},
			assertions: [
				() => assert(QueryStringModule.regfilter("a=1&ab=2&b=3", "^a") === "b=3", "regfilter should remove matching params"),
			],
		},
		{
			name: "uuid.version7",
			vclSnippet: "",
			run: async () => {},
			assertions: [
				() => {
					const uuid = UUIDModule.version7();
					return assert(UUIDModule.is_valid(uuid), "uuid.version7 should generate valid UUID");
				},
				() => {
					const uuid = UUIDModule.version7();
					return assert(UUIDModule.is_version7(uuid), "uuid.version7 should be version 7");
				},
			],
		},
		{
			name: "uuid.oid and uuid.x500",
			vclSnippet: "",
			run: async () => {},
			assertions: [
				() => assert(UUIDModule.is_valid(UUIDModule.oid("test")), "uuid.oid should generate valid UUID"),
				() => assert(UUIDModule.is_valid(UUIDModule.x500("test")), "uuid.x500 should generate valid UUID"),
			],
		},
		{
			name: "parse_time_delta",
			vclSnippet: "",
			run: async () => {},
			assertions: [
				() => {
					const ptd = createParseTimeDelta();
					return assert(ptd("2d") === 172800, "parse_time_delta('2d') should be 172800 seconds");
				},
				() => {
					const ptd = createParseTimeDelta();
					return assert(ptd("3h") === 10800, "parse_time_delta('3h') should be 10800 seconds");
				},
				() => {
					const ptd = createParseTimeDelta();
					return assert(ptd("1m") === 60, "parse_time_delta('1m') should be 60 seconds");
				},
				() => {
					const ptd = createParseTimeDelta();
					return assert(ptd("10s") === 10, "parse_time_delta('10s') should be 10 seconds");
				},
				() => {
					const ptd = createParseTimeDelta();
					return assert(ptd("1d2h3m4s") === 93784, "parse_time_delta('1d2h3m4s') should be 93784 seconds");
				},
			],
		},
		{
			name: "math functions",
			vclSnippet: "",
			run: async () => {},
			assertions: [
				() => {
					const math = createMathModule();
					return assert(Math.abs(math.sin(Math.PI / 2) - 1) < 0.0001, "math.sin(PI/2) should be ~1");
				},
				() => {
					const math = createMathModule();
					return assert(Math.abs(math.cos(0) - 1) < 0.0001, "math.cos(0) should be 1");
				},
				() => {
					const math = createMathModule();
					return assert(math.sqrt(4) === 2, "math.sqrt(4) should be 2");
				},
				() => {
					const math = createMathModule();
					return assert(math.is_nan(NaN) === true, "math.is_nan(NaN) should be true");
				},
				() => {
					const math = createMathModule();
					return assert(math.is_infinite(Infinity) === true, "math.is_infinite(Infinity) should be true");
				},
			],
		},
		{
			name: "std functions",
			vclSnippet: "",
			run: async () => {},
			assertions: [
				() => {
					const std = createStdModule();
					return assert(std.strlen("hello") === 5, "std.strlen('hello') should be 5");
				},
				() => {
					const std = createStdModule();
					return assert(std.tolower("HELLO") === "hello", "std.tolower should work");
				},
				() => {
					const std = createStdModule();
					return assert(std.toupper("hello") === "HELLO", "std.toupper should work");
				},
			],
		},
		{
			name: "digest.awsv4_hmac",
			vclSnippet: "",
			run: async () => {},
			assertions: [
				() => {
					const result = DigestModule.awsv4_hmac(
						"wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY",
						"20150830",
						"us-east-1",
						"iam",
						"test"
					);
					return assert(typeof result === "string" && result.length === 64, "awsv4_hmac should return 64-char hex string");
				},
			],
		},
		{
			name: "accept.language_filter_basic",
			vclSnippet: "",
			run: async () => {},
			assertions: [
				() => {
					const result = AcceptModule.language_filter_basic("en:de:fr:nl", "nl", "de,nl,ja", 2);
					return assert(result === "de,nl", "language_filter_basic should return 'de,nl'");
				},
				() => {
					const result = AcceptModule.language_filter_basic("en:de:fr:nl", "nl", "ja,zh", 2);
					return assert(result === "nl", "language_filter_basic should return default when no match");
				},
				() => {
					const result = AcceptModule.language_filter_basic("en:de:fr:nl", "en", "fr;q=0.8,de;q=0.9", 1);
					return assert(result === "fr", "language_filter_basic should strip quality and take first match");
				},
			],
		},
	],
};

runTestSuite(suite);
