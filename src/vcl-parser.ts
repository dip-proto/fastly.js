import { VCLParser } from "./vcl-parser-impl";

const UTF8_ENCODER = new TextEncoder();
const UTF8_STRICT_DECODER = new TextDecoder("utf-8", { fatal: true });
// Sticky matcher for a long-string opener {DELIM" at the current position.
const LONG_STRING_OPEN_RE = /\{([A-Za-z0-9_]*)"/y;

export type VCLNodeType =
	| "Program"
	| "Subroutine"
	| "Statement"
	| "Assignment"
	| "IfStatement"
	| "ReturnStatement"
	| "ErrorStatement"
	| "SetStatement"
	| "UnsetStatement"
	| "AddStatement"
	| "RemoveStatement"
	| "CallStatement"
	| "LogStatement"
	| "SyntheticStatement"
	| "SyntheticBase64Statement"
	| "EsiStatement"
	| "SwitchStatement"
	| "HashDataStatement"
	| "GotoStatement"
	| "LabelStatement"
	| "RestartStatement"
	| "DeclareStatement"
	| "ExpressionStatement"
	| "BlockStatement"
	| "IncludeStatement"
	| "ImportStatement"
	| "BackendDeclaration"
	| "DirectorDeclaration"
	| "PenaltyboxDeclaration"
	| "RatecounterDeclaration"
	| "TableDeclaration"
	| "BinaryExpression"
	| "UnaryExpression"
	| "TernaryExpression"
	| "FunctionCall"
	| "Identifier"
	| "StringLiteral"
	| "NumberLiteral"
	| "RTimeLiteral"
	| "BoolLiteral"
	| "RegexLiteral"
	| "MemberAccess"
	| "Comment"
	| "ACL"
	| "ACLEntry";

export interface VCLNode {
	type: VCLNodeType;
	location?: {
		line: number;
		column: number;
	};
}

export interface VCLProgram extends VCLNode {
	type: "Program";
	subroutines: VCLSubroutine[];
	comments: VCLComment[];
	acls: VCLACL[];
	includes: VCLIncludeStatement[];
	imports: VCLImportStatement[];
	tables: VCLTableDeclaration[];
	backends: VCLBackendDeclaration[];
	directors: VCLDirectorDeclaration[];
	penaltyboxes: VCLPenaltyboxDeclaration[];
	ratecounters: VCLRatecounterDeclaration[];
}

export interface VCLACL extends VCLNode {
	type: "ACL";
	name: string;
	entries: VCLACLEntry[];
}

export interface VCLACLEntry extends VCLNode {
	type: "ACLEntry";
	ip: string;
	subnet?: number;
	negated?: boolean;
}

export interface VCLSubroutineParam {
	name: string;
	paramType: string;
}

export interface VCLSubroutine extends VCLNode {
	type: "Subroutine";
	name: string;
	params?: VCLSubroutineParam[];
	body: VCLStatement[];
	raw?: string;
	statements?: VCLStatement[];
	returnType?: string;
}

// Base statement interface (not used directly in unions)
export interface VCLBaseStatement extends VCLNode {
	type: VCLStatementType;
}

export type VCLStatementType =
	| "Statement"
	| "Assignment"
	| "IfStatement"
	| "ReturnStatement"
	| "ErrorStatement"
	| "SetStatement"
	| "UnsetStatement"
	| "AddStatement"
	| "RemoveStatement"
	| "CallStatement"
	| "LogStatement"
	| "SyntheticStatement"
	| "SyntheticBase64Statement"
	| "EsiStatement"
	| "SwitchStatement"
	| "HashDataStatement"
	| "GotoStatement"
	| "LabelStatement"
	| "RestartStatement"
	| "DeclareStatement"
	| "ExpressionStatement"
	| "BlockStatement";

export interface VCLEmptyStatement extends VCLNode {
	type: "Statement";
}

export interface VCLAssignment extends VCLNode {
	type: "Assignment";
	left: VCLIdentifier;
	right: VCLExpression;
}

export interface VCLIfStatement extends VCLNode {
	type: "IfStatement";
	test: VCLExpression;
	consequent: VCLStatement[];
	alternate?: VCLStatement[];
	condition?: VCLExpression; // Alias for test (deprecated)
}

export interface VCLReturnStatement extends VCLNode {
	type: "ReturnStatement";
	argument: string;
	value?: VCLExpression;
}

export interface VCLErrorStatement extends VCLNode {
	type: "ErrorStatement";
	/** Status code expression; absent for a bare `error;` re-raise. */
	status?: VCLExpression;
	/** Response text expression (may be a concatenation). */
	message?: VCLExpression;
}

export interface VCLSetStatement extends VCLNode {
	type: "SetStatement";
	target: string;
	value: VCLExpression;
	operator?: string;
}

export interface VCLUnsetStatement extends VCLNode {
	type: "UnsetStatement";
	target: string;
}

export interface VCLAddStatement extends VCLNode {
	type: "AddStatement";
	target: string;
	value: VCLExpression;
}

export interface VCLRemoveStatement extends VCLNode {
	type: "RemoveStatement";
	target: string;
}

export interface VCLCallStatement extends VCLNode {
	type: "CallStatement";
	subroutineName: string;
	arguments: VCLExpression[];
}

export interface VCLSyntheticBase64Statement extends VCLNode {
	type: "SyntheticBase64Statement";
	content: VCLExpression;
}

export interface VCLEsiStatement extends VCLNode {
	type: "EsiStatement";
}

export interface VCLSwitchCase extends VCLNode {
	test: VCLExpression | null; // null for default case
	/** True for `case ~"pattern":` regex-match cases. */
	regex?: boolean;
	body: VCLStatement[];
	fallthrough: boolean;
}

export interface VCLSwitchStatement extends VCLNode {
	type: "SwitchStatement";
	subject: VCLExpression;
	cases: VCLSwitchCase[];
}

export interface VCLLogStatement extends VCLNode {
	type: "LogStatement";
	message: VCLExpression;
}

export interface VCLSyntheticStatement extends VCLNode {
	type: "SyntheticStatement";
	content: string;
	expression?: VCLExpression;
}

export interface VCLExpressionStatement extends VCLNode {
	type: "ExpressionStatement";
	expression: VCLExpression;
}

export interface VCLHashDataStatement extends VCLNode {
	type: "HashDataStatement";
	value: VCLExpression;
}

export interface VCLGotoStatement extends VCLNode {
	type: "GotoStatement";
	label: string;
}

export interface VCLLabelStatement extends VCLNode {
	type: "LabelStatement";
	name: string;
}

export interface VCLRestartStatement extends VCLNode {
	type: "RestartStatement";
}

/** A bare `{ ... }` group of statements. */
export interface VCLBlockStatement extends VCLNode {
	type: "BlockStatement";
	body: VCLStatement[];
}

// VCLStatement is a discriminated union of all statement types
export type VCLStatement =
	| VCLEmptyStatement
	| VCLAssignment
	| VCLIfStatement
	| VCLReturnStatement
	| VCLErrorStatement
	| VCLSetStatement
	| VCLUnsetStatement
	| VCLAddStatement
	| VCLRemoveStatement
	| VCLCallStatement
	| VCLLogStatement
	| VCLSyntheticStatement
	| VCLSyntheticBase64Statement
	| VCLEsiStatement
	| VCLSwitchStatement
	| VCLHashDataStatement
	| VCLGotoStatement
	| VCLLabelStatement
	| VCLRestartStatement
	| VCLDeclareStatement
	| VCLExpressionStatement
	| VCLBlockStatement;

export interface VCLIncludeStatement extends VCLNode {
	type: "IncludeStatement";
	module: string;
}

export interface VCLImportStatement extends VCLNode {
	type: "ImportStatement";
	module: string;
}

export interface VCLTableDeclaration extends VCLNode {
	type: "TableDeclaration";
	name: string;
	valueType?: string;
	entries: VCLTableEntry[];
}

export interface VCLTableEntry {
	key: string;
	value: string;
}

export interface VCLBackendDeclaration extends VCLNode {
	type: "BackendDeclaration";
	name: string;
	properties: VCLBackendProperty[];
}

export interface VCLBackendProperty {
	name: string;
	value: string | number | VCLBackendProbe;
}

export interface VCLBackendProbe {
	type: "probe";
	properties: VCLBackendProperty[];
}

export interface VCLDeclareStatement extends VCLNode {
	type: "DeclareStatement";
	variableName: string;
	variableType: string;
	initialValue?: VCLExpression;
}

export interface VCLDirectorDeclaration extends VCLNode {
	type: "DirectorDeclaration";
	name: string;
	directorType: string;
	properties: VCLBackendProperty[];
	backends: Array<{ name: string; weight?: number }>;
}

export interface VCLPenaltyboxDeclaration extends VCLNode {
	type: "PenaltyboxDeclaration";
	name: string;
}

export interface VCLRatecounterDeclaration extends VCLNode {
	type: "RatecounterDeclaration";
	name: string;
}

export interface VCLMemberAccess extends VCLNode {
	type: "MemberAccess";
	object: VCLExpression;
	property: string;
}

export type VCLExpression =
	| VCLBinaryExpression
	| VCLUnaryExpression
	| VCLTernaryExpression
	| VCLFunctionCall
	| VCLIdentifier
	| VCLStringLiteral
	| VCLNumberLiteral
	| VCLRTimeLiteral
	| VCLBoolLiteral
	| VCLRegexLiteral
	| VCLMemberAccess;

export interface VCLBinaryExpression extends VCLNode {
	type: "BinaryExpression";
	operator: string;
	left: VCLExpression;
	right: VCLExpression;
}

export interface VCLUnaryExpression extends VCLNode {
	type: "UnaryExpression";
	operator: string;
	operand: VCLExpression;
}

export interface VCLTernaryExpression extends VCLNode {
	type: "TernaryExpression";
	condition: VCLExpression;
	trueExpr: VCLExpression;
	falseExpr: VCLExpression;
}

export interface VCLFunctionCall extends VCLNode {
	type: "FunctionCall";
	name: string;
	arguments: VCLExpression[];
}

export interface VCLIdentifier extends VCLNode {
	type: "Identifier";
	name: string;
}

export interface VCLStringLiteral extends VCLNode {
	type: "StringLiteral";
	value: string;
}

export interface VCLNumberLiteral extends VCLNode {
	type: "NumberLiteral";
	value: number;
	/** True when the literal was written with a decimal point (VCL FLOAT). */
	isFloat?: boolean;
}

export interface VCLBoolLiteral extends VCLNode {
	type: "BoolLiteral";
	value: boolean;
}

export interface VCLRTimeLiteral extends VCLNode {
	type: "RTimeLiteral";
	/** Duration in seconds. */
	seconds: number;
	/** Original literal text, e.g. "10s", "1.5h". */
	raw: string;
}

export interface VCLRegexLiteral extends VCLNode {
	type: "RegexLiteral";
	pattern: string;
	flags: string;
}

export interface VCLComment extends VCLNode {
	type: "Comment";
	value: string;
	multiline: boolean;
}

// Token types for the lexer
export enum TokenType {
	KEYWORD = "KEYWORD",
	IDENTIFIER = "IDENTIFIER",
	STRING = "STRING",
	NUMBER = "NUMBER",
	REGEX = "REGEX",
	OPERATOR = "OPERATOR",
	PUNCTUATION = "PUNCTUATION",
	COMMENT = "COMMENT",
	WHITESPACE = "WHITESPACE",
	EOF = "EOF",
}

export interface Token {
	type: TokenType;
	value: string;
	line: number;
	column: number;
	position?: number;
	/**
	 * RTIME unit suffix for NUMBER tokens ("ms", "s", "m", "h", "d", "w", "y").
	 * The unit may be attached ("60s") or whitespace-separated ("60 s"), as on
	 * Fastly, where the unit is a separate token bound by the duration parser.
	 * `value` holds the normalized form without whitespace ("60s").
	 */
	unit?: string;
}

const RTIME_UNITS = new Set(["ms", "s", "m", "h", "d", "w", "y"]);
// A unit only binds to a number when the character after it ends the word, so
// "60 s" is an RTIME but "60 second" is a number followed by an identifier.
const UNIT_BOUNDARY = /[a-zA-Z0-9_.:-]/;

const VCL_KEYWORDS = [
	"sub",
	"if",
	"else",
	"elseif",
	"elsif",
	"pragma",
	"return",
	"set",
	"unset",
	"add",
	"remove",
	"call",
	"error",
	"synthetic",
	"hash_data",
	"true",
	"false",
	"deliver",
	"deliver_stale",
	"fetch",
	"pass",
	"pipe",
	"hash",
	"lookup",
	"restart",
	"purge",
	"log",
	"esi",
	"switch",
	"case",
	"default",
	"break",
	"fallthrough",
	"hit_for_pass",
	"acl",
	"goto",
	"include",
	"import",
	"backend",
	"table",
	"director",
	"penaltybox",
	"ratecounter",
];

export class VCLLexer {
	private input: string;
	private position: number = 0;
	private line: number = 1;
	private column: number = 1;
	private tokens: Token[] = [];

	constructor(input: string) {
		this.input = input;
	}

	tokenize(): Token[] {
		while (this.position < this.input.length) {
			const char = this.input[this.position]!;

			if (/\s/.test(char)) {
				this.tokenizeWhitespace();
				continue;
			}
			if (char === "#") {
				this.tokenizeComment();
				continue;
			}
			if (char === "/" && this.peek() === "/") {
				this.tokenizeComment();
				continue;
			}
			if (char === "/" && this.peek() === "*") {
				this.tokenizeBlockComment();
				continue;
			}
			if (char === '"' || char === "'") {
				this.tokenizeString(char);
				continue;
			}
			if (/[0-9]/.test(char)) {
				this.tokenizeNumber();
				continue;
			}
			// Fastly-generated VCL contains C!/W! control markers; skip them.
			if ((char === "C" || char === "W") && this.peek() === "!") {
				this.advance();
				this.advance();
				continue;
			}
			if (/[a-zA-Z_]/.test(char)) {
				this.tokenizeIdentifier();
				continue;
			}

			if (char === "~" || (char === "!" && this.peek() === "~")) {
				this.tokenizeOperator();
				continue;
			}

			if (/[+\-*/%=<>!&|^~]/.test(char)) {
				this.tokenizeOperator();
				continue;
			}

			if (char === "{") {
				const prevToken = this.tokens[this.tokens.length - 1];
				// A Fastly long string {"..."} — or with a custom delimiter, e.g.
				// {HTML"..."HTML} — can appear anywhere an expression can, so
				// concatenations like {"a"} + obj.status + {"b"} tokenize correctly.
				LONG_STRING_OPEN_RE.lastIndex = this.position;
				const delimMatch = LONG_STRING_OPEN_RE.exec(this.input);
				if (delimMatch) {
					this.tokenizeLongString(delimMatch[1]!);
					continue;
				}
				// The non-standard synthetic {expr} brace form is still scanned as one token.
				if (prevToken?.type === TokenType.KEYWORD && prevToken.value === "synthetic") {
					this.tokenizeSyntheticBlock();
					continue;
				}
			}

			if (/[(){}[\],;:]/.test(char)) {
				this.tokenizePunctuation();
				continue;
			}

			if (char === ".") {
				const prevIsDigit = this.position > 0 && /[0-9]/.test(this.input[this.position - 1] ?? "");
				const nextIsDigit = /[0-9]/.test(this.peek());
				if (prevIsDigit && nextIsDigit) continue;
				this.tokenizePunctuation();
				continue;
			}

			this.advance();
		}

		this.tokens.push({
			type: TokenType.EOF,
			value: "",
			line: this.line,
			column: this.column,
			position: this.position,
		});

		return this.tokens;
	}

	private peek(): string {
		return this.position + 1 < this.input.length ? (this.input[this.position + 1] ?? "") : "";
	}

	private tokenizeWhitespace(): void {
		while (this.position < this.input.length && /\s/.test(this.input[this.position] ?? "")) {
			if (this.input[this.position] === "\n") {
				this.line++;
				this.column = 1;
			} else {
				this.column++;
			}
			this.position++;
		}
	}

	private tokenizeComment(): void {
		const start = this.position;
		const startLine = this.line;
		const startColumn = this.column;
		this.advance();
		// Skip second / or # character if present
		if (this.position < this.input.length && this.input[this.position] === "/") {
			this.advance();
		}
		while (this.position < this.input.length && this.input[this.position] !== "\n") {
			this.advance();
		}
		this.tokens.push({
			type: TokenType.COMMENT,
			value: this.input.substring(start, this.position),
			line: startLine,
			column: startColumn,
			position: start,
		});
	}

	private tokenizeBlockComment(): void {
		const start = this.position;
		const startLine = this.line;
		const startColumn = this.column;
		this.advance(); // skip /
		this.advance(); // skip *
		while (
			this.position < this.input.length - 1 &&
			!(this.input[this.position] === "*" && this.input[this.position + 1] === "/")
		) {
			if (this.input[this.position] === "\n") {
				this.line++;
				this.column = 1;
			}
			this.advance();
		}
		if (this.position < this.input.length - 1) {
			this.advance(); // skip *
			this.advance(); // skip /
		}
		this.tokens.push({
			type: TokenType.COMMENT,
			value: this.input.substring(start, this.position),
			line: startLine,
			column: startColumn,
			position: start,
		});
	}

	private tokenizeString(quote: string): void {
		const start = this.position;
		const startLine = this.line;
		const startColumn = this.column;
		this.advance();

		// Triple-quoted string
		if (
			this.position < this.input.length - 2 &&
			this.input[this.position] === quote &&
			this.input[this.position + 1] === quote
		) {
			this.advance();
			this.advance();
			let content = "";
			while (this.position < this.input.length) {
				if (
					this.input[this.position] === quote &&
					this.position + 2 < this.input.length &&
					this.input[this.position + 1] === quote &&
					this.input[this.position + 2] === quote
				) {
					this.advance();
					this.advance();
					this.advance();
					break;
				}
				if (this.input[this.position] === "\n") {
					this.line++;
					this.column = 1;
				}
				content += this.input[this.position];
				this.advance();
			}
			this.tokens.push({
				type: TokenType.STRING,
				value: quote + content + quote,
				line: startLine,
				column: startColumn,
				position: start,
			});
			return;
		}

		// Regular (short) string. Fastly short strings have no backslash
		// escapes; "%XX" percent sequences decode to bytes (the byte stream
		// must be valid UTF-8), and a "%" not followed by two hex digits is a
		// lexing error. Literal "%" must be written "%25".
		//
		// Fast path: without any "%" the literal is taken verbatim.
		const closing = this.input.indexOf(quote, this.position);
		const rawEnd = closing === -1 ? this.input.length : closing;
		const raw = this.input.substring(this.position, rawEnd);
		let content: string;
		if (!raw.includes("%")) {
			for (const ch of raw) {
				if (ch === "\n") {
					this.line++;
					this.column = 1;
				}
				this.advance();
			}
			if (this.position < this.input.length) this.advance();
			content = raw;
		} else {
			const bytes: number[] = [];
			while (this.position < this.input.length && this.input[this.position] !== quote) {
				const ch = this.input[this.position]!;
				if (ch === "%") {
					const hex = this.input.substring(this.position + 1, this.position + 3);
					if (!/^[0-9a-fA-F]{2}$/.test(hex)) {
						throw new Error(
							`Invalid percent escape in string literal at line ${this.line}, column ${this.column}`,
						);
					}
					bytes.push(parseInt(hex, 16));
					this.advance();
					this.advance();
					this.advance();
					continue;
				}
				if (ch === "\n") {
					this.line++;
					this.column = 1;
				}
				// Consume a full code point so surrogate pairs encode correctly.
				const cp = this.input.codePointAt(this.position)!;
				const cpStr = String.fromCodePoint(cp);
				for (const b of UTF8_ENCODER.encode(cpStr)) bytes.push(b);
				for (let k = 0; k < cpStr.length; k++) this.advance();
			}
			if (this.position < this.input.length) this.advance();
			try {
				content = UTF8_STRICT_DECODER.decode(new Uint8Array(bytes));
			} catch {
				throw new Error(
					`Invalid UTF-8 percent escape in string literal at line ${startLine}, column ${startColumn}`,
				);
			}
		}
		this.tokens.push({
			type: TokenType.STRING,
			value: quote + content + quote,
			line: startLine,
			column: startColumn,
			position: start,
		});
	}

	private tokenizeLongString(delim: string = ""): void {
		const start = this.position;
		const startLine = this.line;
		const startColumn = this.column;
		this.advance();
		// The string ends only at "DELIM} with the matching delimiter.
		const close = `"${delim}}`;
		const end = this.input.indexOf(close, this.position + delim.length + 1);
		const stop = end === -1 ? this.input.length : end + close.length;
		while (this.position < stop) this.advanceTrackingLine();
		this.tokens.push({
			type: TokenType.STRING,
			value: this.input.substring(start, this.position),
			line: startLine,
			column: startColumn,
			position: start,
		});
	}

	private tokenizeSyntheticBlock(): void {
		const start = this.position;
		const startLine = this.line;
		const startColumn = this.column;
		this.advance();
		const longStringEnd =
			this.input[this.position] === '"' ? this.input.indexOf('"}', this.position + 1) : -1;
		if (longStringEnd !== -1) {
			while (this.position <= longStringEnd + 1) {
				this.advanceTrackingLine();
			}
		} else {
			let braceCount = 1;
			while (this.position < this.input.length && braceCount > 0) {
				if (this.input[this.position] === "{") braceCount++;
				else if (this.input[this.position] === "}") braceCount--;
				this.advanceTrackingLine();
			}
		}
		this.tokens.push({
			type: TokenType.STRING,
			value: this.input.substring(start, this.position),
			line: startLine,
			column: startColumn,
			position: start,
		});
	}

	private tokenizeNumber(): void {
		const start = this.position;
		const startLine = this.line;
		const startColumn = this.column;
		const isDigit = (c: string) => c >= "0" && c <= "9";
		const isHexDigit = (c: string) =>
			(c >= "0" && c <= "9") || (c >= "a" && c <= "f") || (c >= "A" && c <= "F");
		// A float exponent: the marker char, an optional sign, then decimal
		// digits. Consumed only when digits actually follow, so a bare "e"/"p"
		// is left for whatever comes next.
		const consumeExponent = (marker: string) => {
			if (this.input[this.position] !== marker) return;
			let probe = this.position + 1;
			if (this.input[probe] === "+" || this.input[probe] === "-") probe++;
			if (probe >= this.input.length || !isDigit(this.input[probe]!)) return;
			while (this.position <= probe) this.advance();
			while (this.position < this.input.length && isDigit(this.input[this.position]!))
				this.advance();
		};

		if (this.input[this.position] === "0" && this.input[this.position + 1] === "x") {
			// Hexadecimal literal. Only a lowercase "x" marks hex on Fastly;
			// digits are case-insensitive, and a lowercase "p" gives the binary
			// exponent.
			this.advance();
			this.advance();
			let digits = 0;
			while (this.position < this.input.length && isHexDigit(this.input[this.position]!)) {
				this.advance();
				digits++;
			}
			if (this.position < this.input.length && this.input[this.position] === ".") {
				this.advance();
				while (this.position < this.input.length && isHexDigit(this.input[this.position]!)) {
					this.advance();
					digits++;
				}
			}
			if (digits === 0) {
				throw new Error(`Invalid hexadecimal literal at line ${startLine}, column ${startColumn}`);
			}
			consumeExponent("p");
		} else {
			while (this.position < this.input.length && isDigit(this.input[this.position]!))
				this.advance();
			if (this.position < this.input.length && this.input[this.position] === ".") {
				this.advance();
				while (this.position < this.input.length && isDigit(this.input[this.position]!))
					this.advance();
			}
			// A lowercase "e" gives the decimal exponent; an uppercase "E" is
			// not an exponent on Fastly.
			consumeExponent("e");
		}

		const numberRaw = this.input.substring(start, this.position);

		// RTIME unit. Fastly lexes the unit as a separate token and binds it to
		// the number in duration contexts, so a space or tab may separate the
		// two ("60 s" == "60s") but a newline does not. The unit must be exact
		// and end at a word boundary, so "60 second" is a number followed by an
		// identifier.
		let wordStart = this.position;
		while (this.input[wordStart] === " " || this.input[wordStart] === "\t") wordStart++;
		let wordEnd = wordStart;
		while (
			wordEnd < this.input.length &&
			this.input[wordEnd]! >= "a" &&
			this.input[wordEnd]! <= "z"
		)
			wordEnd++;
		const word = this.input.substring(wordStart, wordEnd);
		let unit = "";
		const nextChar = this.input[wordEnd];
		if (RTIME_UNITS.has(word) && (nextChar === undefined || !UNIT_BOUNDARY.test(nextChar))) {
			unit = word;
			while (this.position < wordEnd) this.advance();
		}

		this.tokens.push({
			type: TokenType.NUMBER,
			value: numberRaw + unit,
			line: startLine,
			column: startColumn,
			position: start,
			unit: unit || undefined,
		});
	}

	private tokenizeIdentifier(): void {
		const start = this.position;
		const startLine = this.line;
		const startColumn = this.column;
		let includeHyphen = false;

		while (this.position < this.input.length) {
			const char = this.input[this.position] ?? "";
			const nextChar = this.peek();

			if (/[a-zA-Z0-9_]/.test(char)) {
				this.advance();
				includeHyphen = true;
			} else if (char === "." && /[a-zA-Z_0-9]/.test(nextChar)) {
				this.advance();
				includeHyphen = false;
			} else if (char === ":" && /[a-zA-Z_]/.test(nextChar)) {
				this.advance();
				includeHyphen = false;
			} else if (includeHyphen && char === "-" && /[a-zA-Z0-9_]/.test(nextChar)) {
				this.advance();
				includeHyphen = false;
			} else {
				break;
			}
		}

		const value = this.input.substring(start, this.position);
		const type = VCL_KEYWORDS.includes(value) ? TokenType.KEYWORD : TokenType.IDENTIFIER;
		this.tokens.push({
			type,
			value,
			line: startLine,
			column: startColumn,
			position: start,
		});
	}

	private tokenizeOperator(): void {
		const start = this.position;
		const startLine = this.line;
		const startColumn = this.column;
		while (
			this.position < this.input.length &&
			/[+\-*/%=<>!&|^~]/.test(this.input[this.position] ?? "")
		) {
			this.advance();
		}
		this.tokens.push({
			type: TokenType.OPERATOR,
			value: this.input.substring(start, this.position),
			line: startLine,
			column: startColumn,
			position: start,
		});
	}

	private tokenizePunctuation(): void {
		const start = this.position;
		const startLine = this.line;
		const startColumn = this.column;
		this.advance();
		this.tokens.push({
			type: TokenType.PUNCTUATION,
			value: this.input.substring(start, this.position),
			line: startLine,
			column: startColumn,
			position: start,
		});
	}

	private advance(): void {
		this.position++;
		this.column++;
	}

	private advanceTrackingLine(): void {
		if (this.input[this.position] === "\n") {
			this.line++;
			this.column = 1;
		}
		this.advance();
	}
}

export function parseVCL(input: string): VCLProgram {
	const lexer = new VCLLexer(input);
	const tokens = lexer.tokenize();
	const parser = new VCLParser(tokens, input);
	return parser.parse();
}
