import { VCLParser } from "./vcl-parser-impl";

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
	| "LogStatement"
	| "SyntheticStatement"
	| "HashDataStatement"
	| "GotoStatement"
	| "LabelStatement"
	| "RestartStatement"
	| "DeclareStatement"
	| "IncludeStatement"
	| "ImportStatement"
	| "BackendDeclaration"
	| "TableDeclaration"
	| "BinaryExpression"
	| "UnaryExpression"
	| "TernaryExpression"
	| "FunctionCall"
	| "Identifier"
	| "StringLiteral"
	| "NumberLiteral"
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

export interface VCLSubroutine extends VCLNode {
	type: "Subroutine";
	name: string;
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
	| "LogStatement"
	| "SyntheticStatement"
	| "HashDataStatement"
	| "GotoStatement"
	| "LabelStatement"
	| "RestartStatement"
	| "DeclareStatement";

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
	status: number;
	message: string;
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

export interface VCLLogStatement extends VCLNode {
	type: "LogStatement";
	message: VCLExpression;
}

export interface VCLSyntheticStatement extends VCLNode {
	type: "SyntheticStatement";
	content: string;
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
	statement?: VCLStatement | null;
}

export interface VCLRestartStatement extends VCLNode {
	type: "RestartStatement";
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
	| VCLLogStatement
	| VCLSyntheticStatement
	| VCLHashDataStatement
	| VCLGotoStatement
	| VCLLabelStatement
	| VCLRestartStatement
	| VCLDeclareStatement;

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
}

const VCL_KEYWORDS = [
	"sub",
	"if",
	"else",
	"elseif",
	"return",
	"set",
	"unset",
	"error",
	"synthetic",
	"hash_data",
	"true",
	"false",
	"deliver",
	"fetch",
	"pass",
	"hash",
	"lookup",
	"restart",
	"purge",
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
			if (char === '"' || char === "'") {
				this.tokenizeString(char);
				continue;
			}
			if (/[0-9]/.test(char)) {
				this.tokenizeNumber();
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

		// Regular string with escape sequences
		const escapes: Record<string, string> = {
			n: "\n",
			t: "\t",
			r: "\r",
			"\\": "\\",
			'"': '"',
			"'": "'",
			"0": "\0",
		};
		let content = "";
		while (this.position < this.input.length && this.input[this.position] !== quote) {
			if (this.input[this.position] === "\\" && this.position + 1 < this.input.length) {
				this.advance();
				const escChar = this.input[this.position] ?? "";
				content += escapes[escChar] ?? escChar;
				this.advance();
				continue;
			}
			if (this.input[this.position] === "\n") {
				this.line++;
				this.column = 1;
			}
			content += this.input[this.position];
			this.advance();
		}
		if (this.position < this.input.length) this.advance();
		this.tokens.push({
			type: TokenType.STRING,
			value: quote + content + quote,
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
		let braceCount = 1;
		while (this.position < this.input.length && braceCount > 0) {
			if (this.input[this.position] === "{") braceCount++;
			else if (this.input[this.position] === "}") braceCount--;
			if (this.input[this.position] === "\n") {
				this.line++;
				this.column = 1;
			}
			this.advance();
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

		while (this.position < this.input.length && /[0-9]/.test(this.input[this.position] ?? ""))
			this.advance();
		if (this.position < this.input.length && this.input[this.position] === ".") {
			this.advance();
			while (this.position < this.input.length && /[0-9]/.test(this.input[this.position] ?? ""))
				this.advance();
		}

		// Time units (s, m, h, d, y)
		if (this.position < this.input.length && /[smhdy]/.test(this.input[this.position] ?? "")) {
			this.advance();
			const value = this.input.substring(start, this.position);
			this.tokens.push({
				type: TokenType.STRING,
				value: `"${value}"`,
				line: startLine,
				column: startColumn,
				position: start,
			});
			return;
		}

		this.tokens.push({
			type: TokenType.NUMBER,
			value: this.input.substring(start, this.position),
			line: startLine,
			column: startColumn,
			position: start,
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
}

export function parseVCL(input: string): VCLProgram {
	const lexer = new VCLLexer(input);
	const tokens = lexer.tokenize();
	const parser = new VCLParser(tokens, input);
	return parser.parse();
}
