import { getIPType } from "./vcl-acl";
import {
	type Token,
	TokenType,
	type VCLACL,
	type VCLACLEntry,
	type VCLAddStatement,
	type VCLBackendDeclaration,
	type VCLBackendProperty,
	type VCLCallStatement,
	type VCLComment,
	type VCLDirectorDeclaration,
	type VCLErrorStatement,
	type VCLEsiStatement,
	type VCLExpression,
	type VCLGotoStatement,
	type VCLHashDataStatement,
	type VCLIdentifier,
	type VCLIfStatement,
	type VCLImportStatement,
	type VCLIncludeStatement,
	type VCLLabelStatement,
	type VCLLogStatement,
	type VCLNumberLiteral,
	type VCLPenaltyboxDeclaration,
	type VCLProgram,
	type VCLRatecounterDeclaration,
	type VCLRemoveStatement,
	type VCLRestartStatement,
	type VCLReturnStatement,
	type VCLSetStatement,
	type VCLStatement,
	type VCLStringLiteral,
	type VCLSubroutine,
	type VCLSubroutineParam,
	type VCLSwitchCase,
	type VCLSwitchStatement,
	type VCLSyntheticBase64Statement,
	type VCLSyntheticStatement,
	type VCLTableDeclaration,
	type VCLTableEntry,
	type VCLUnsetStatement,
} from "./vcl-parser";
import { TIME_UNITS } from "./vcl-time";

const INT64_MAX = 2n ** 63n - 1n;
const INT64_MIN_MAGNITUDE = 2n ** 63n;
// A hex literal: mantissa (with an optional fraction) and an optional lowercase
// binary exponent.
const HEX_LITERAL = /^0x([0-9a-fA-F]*)(?:\.([0-9a-fA-F]*))?(?:p([+-]?[0-9]+))?$/;

/**
 * Convert the numeric part of a NUMBER token to its value.
 * Handles decimal and hex integers, decimal-exponent floats, and hex floats
 * with a binary exponent.
 * Integer literals are range-checked against int64 like Fastly's compiler;
 * the magnitude 2^63 is only valid under a unary minus, where it becomes
 * INT64_MIN.
 * Values beyond 2^53 lose precision because the runtime stores numbers as
 * doubles; the range check itself is exact.
 */
function parseNumericLiteral(
	raw: string,
	negative: boolean,
	at: string,
): { value: number; isFloat: boolean } {
	const checkInt64 = (magnitude: bigint): number => {
		if (negative) {
			if (magnitude > INT64_MIN_MAGNITUDE) {
				throw new Error(`Negative signed integer overflow ${at}`);
			}
			return -Number(magnitude);
		}
		if (magnitude > INT64_MAX) {
			throw new Error(`Positive signed integer overflow ${at}`);
		}
		return Number(magnitude);
	};

	const hex = HEX_LITERAL.exec(raw);
	if (hex) {
		const [, whole = "", frac, exp] = hex;
		if (frac === undefined && exp === undefined) {
			return { value: checkInt64(BigInt(`0x${whole}`)), isFloat: false };
		}
		let mantissa = whole ? Number.parseInt(whole, 16) : 0;
		if (frac) mantissa += Number.parseInt(frac, 16) / 16 ** frac.length;
		const value = mantissa * 2 ** (exp !== undefined ? Number.parseInt(exp, 10) : 0);
		return { value: negative ? -value : value, isFloat: true };
	}
	if (!raw.includes(".") && !raw.includes("e")) {
		return { value: checkInt64(BigInt(raw)), isFloat: false };
	}
	const value = Number.parseFloat(raw);
	return { value: negative ? -value : value, isFloat: true };
}

// Paren-less `return <action>;` keywords.
const RETURN_ACTIONS = new Set([
	"lookup",
	"pass",
	"pipe",
	"error",
	"restart",
	"hash",
	"deliver",
	"deliver_stale",
	"fetch",
	"purge",
	"hit_for_pass",
	"upgrade",
]);

export class VCLParser {
	private tokens: Token[] = [];
	private current: number = 0;
	private source: string;

	constructor(tokens: Token[], source: string) {
		this.tokens = tokens.filter((token) => token.type !== TokenType.WHITESPACE);
		this.source = source;
	}

	parse(): VCLProgram {
		const program: VCLProgram = {
			type: "Program",
			subroutines: [],
			comments: [],
			acls: [],
			includes: [],
			imports: [],
			tables: [],
			backends: [],
			directors: [],
			penaltyboxes: [],
			ratecounters: [],
		};

		while (!this.isAtEnd()) {
			if (this.match(TokenType.COMMENT)) {
				program.comments.push(this.parseComment());
			} else if (this.check(TokenType.KEYWORD)) {
				const keyword = this.peek().value;
				this.advance();
				switch (keyword) {
					case "sub":
						program.subroutines.push(this.parseSubroutine());
						break;
					case "acl":
						program.acls.push(this.parseACL());
						break;
					case "include":
						program.includes.push(this.parseIncludeStatement());
						break;
					case "import":
						program.imports.push(this.parseImportStatement());
						break;
					case "table":
						program.tables.push(this.parseTableDeclaration());
						break;
					case "backend":
						program.backends.push(this.parseBackendDeclaration());
						break;
					case "director":
						program.directors.push(this.parseDirectorDeclaration());
						break;
					case "penaltybox":
						program.penaltyboxes.push(this.parsePenaltyboxDeclaration());
						break;
					case "ratecounter":
						program.ratecounters.push(this.parseRatecounterDeclaration());
						break;
					case "pragma":
						// Fastly-generated control line; skip through its semicolon.
						while (!this.isAtEnd() && !this.check(TokenType.PUNCTUATION, ";")) this.advance();
						if (this.check(TokenType.PUNCTUATION, ";")) this.advance();
						break;
					default: {
						const kw = this.previous();
						throw new Error(
							`Unexpected keyword "${kw.value}" at top level at line ${kw.line}, column ${kw.column}`,
						);
					}
				}
			} else {
				const tok = this.peek();
				// VCL version declaration, e.g. `vcl 4.0;` — recognized but carries no
				// semantics for the interpreter; consume it through its semicolon.
				if (tok.value === "vcl") {
					this.advance();
					while (!this.isAtEnd() && this.peek().value !== ";") this.advance();
					if (!this.isAtEnd()) this.advance();
					continue;
				}
				throw new Error(
					`Unexpected token "${tok.value}" at top level at line ${tok.line}, column ${tok.column}`,
				);
			}
		}
		return program;
	}

	/**
	 * Strip the delimiters from a STRING token value: plain quotes, or the
	 * long-string forms {"..."} and {DELIM"..."DELIM}.
	 */
	private unquoteStringToken(raw: string): string {
		const long = /^\{([A-Za-z0-9_]*)"([\s\S]*)"\1\}$/.exec(raw);
		if (long) return long[2]!;
		if (
			raw.length >= 2 &&
			((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'")))
		) {
			return raw.slice(1, -1);
		}
		return raw;
	}

	// Both delegate to the shared classifier so the parser accepts exactly what
	// the runtime matcher understands, including IPv4-mapped IPv6 forms
	// (::ffff:192.0.2.1).
	private isValidIPv4(ip: string): boolean {
		return getIPType(ip) === "ipv4";
	}

	private isValidIPv6(ip: string): boolean {
		return getIPType(ip) === "ipv6";
	}

	private isValidCIDR(subnet: number, isIPv6: boolean): boolean {
		return Number.isInteger(subnet) && subnet >= 0 && subnet <= (isIPv6 ? 128 : 32);
	}

	private parseACL(): VCLACL {
		// We've already consumed the 'acl' keyword
		const nameToken = this.consumeName("Expected ACL name");

		this.consume(TokenType.PUNCTUATION, "Expected '{' after ACL name");

		const entries: VCLACLEntry[] = [];

		// Parse entries until we reach the closing brace
		while (!this.check(TokenType.PUNCTUATION, "}") && !this.isAtEnd()) {
			// Check for negation operator
			let negated = false;
			if (this.check(TokenType.OPERATOR, "!")) {
				negated = true;
				this.advance();
			}

			// Parse an IP address or CIDR notation
			if (this.match(TokenType.STRING)) {
				const ipToken = this.previous();
				let ip = this.unquoteStringToken(ipToken.value);

				let subnet: number | undefined;

				// "localhost" is the one hostname Fastly allows in an ACL; it
				// stands for 127.0.0.1 and ::1 and takes no prefix length.
				if (ip === "localhost") {
					if (ip.includes("/") || this.check(TokenType.OPERATOR, "/")) {
						throw new Error(
							`A prefix length is not supported for "localhost" at line ${ipToken.line}, column ${ipToken.column}`,
						);
					}
					this.consume(TokenType.PUNCTUATION, "Expected ';' after ACL entry");
					entries.push({
						type: "ACLEntry",
						ip: "localhost",
						negated,
						location: { line: ipToken.line, column: ipToken.column },
					});
					continue;
				}

				// Check for CIDR notation inside the string
				if (ip.includes("/")) {
					const cidrParts = ip.split("/");
					ip = cidrParts[0] ?? "";
					subnet = parseInt(cidrParts[1] ?? "0", 10);
				}

				// Check for CIDR notation outside the string: "192.168.0.0"/16
				if (this.check(TokenType.OPERATOR, "/")) {
					this.advance();
					if (this.match(TokenType.NUMBER)) {
						subnet = parseInt(this.previous().value, 10);
					}
				}

				// Validate IP address format
				const isIPv6 = ip.includes(":");
				if (isIPv6) {
					if (!this.isValidIPv6(ip)) {
						throw new Error(
							`Invalid IPv6 address "${ip}" at line ${ipToken.line}, column ${ipToken.column}`,
						);
					}
				} else {
					if (!this.isValidIPv4(ip)) {
						throw new Error(
							`Invalid IPv4 address "${ip}" at line ${ipToken.line}, column ${ipToken.column}`,
						);
					}
				}

				// Validate CIDR subnet if present
				if (subnet !== undefined && !this.isValidCIDR(subnet, isIPv6)) {
					const maxSubnet = isIPv6 ? 128 : 32;
					throw new Error(
						`Invalid CIDR subnet /${subnet} (must be 0-${maxSubnet}) at line ${ipToken.line}, column ${ipToken.column}`,
					);
				}

				// Consume the semicolon
				this.consume(TokenType.PUNCTUATION, "Expected ';' after ACL entry");

				entries.push({
					type: "ACLEntry",
					ip,
					subnet,
					negated,
					location: {
						line: ipToken.line,
						column: ipToken.column,
					},
				});
			} else {
				// Skip unknown tokens
				this.advance();
			}
		}

		this.consume(TokenType.PUNCTUATION, "Expected '}' after ACL entries");

		return {
			type: "ACL",
			name: nameToken.value,
			entries,
			location: {
				line: nameToken.line,
				column: nameToken.column,
			},
		};
	}

	private parseIncludeStatement(): VCLIncludeStatement {
		const token = this.previous();
		const moduleToken = this.consume(TokenType.STRING, "Expected module name after 'include'");
		let module = moduleToken.value;
		if (
			(module.startsWith('"') && module.endsWith('"')) ||
			(module.startsWith("'") && module.endsWith("'"))
		) {
			module = module.slice(1, -1);
		}
		if (this.check(TokenType.PUNCTUATION, ";")) {
			this.advance();
		}
		return {
			type: "IncludeStatement",
			module,
			location: { line: token.line, column: token.column },
		};
	}

	private parseImportStatement(): VCLImportStatement {
		const token = this.previous();
		const moduleToken = this.consume(TokenType.IDENTIFIER, "Expected module name after 'import'");
		if (this.check(TokenType.PUNCTUATION, ";")) {
			this.advance();
		}
		return {
			type: "ImportStatement",
			module: moduleToken.value,
			location: { line: token.line, column: token.column },
		};
	}

	private parseTableDeclaration(): VCLTableDeclaration {
		const token = this.previous();
		const nameToken = this.consumeName("Expected table name");
		let valueType: string | undefined;
		if (this.check(TokenType.IDENTIFIER)) {
			valueType = this.advance().value;
		}
		this.consume(TokenType.PUNCTUATION, "Expected '{' after table name");

		const entries: VCLTableEntry[] = [];
		while (!this.check(TokenType.PUNCTUATION, "}") && !this.isAtEnd()) {
			if (this.match(TokenType.COMMENT)) continue;
			if (this.match(TokenType.STRING)) {
				const key = this.unquoteStringToken(this.previous().value);
				this.consume(TokenType.PUNCTUATION, "Expected ':' after table key");
				let value = "";
				if (this.match(TokenType.STRING)) {
					value = this.unquoteStringToken(this.previous().value);
				} else if (this.match(TokenType.NUMBER)) {
					value = this.previous().value;
				} else if (this.match(TokenType.OPERATOR, "-") && this.check(TokenType.NUMBER)) {
					value = `-${this.advance().value}`;
				} else if (this.match(TokenType.IDENTIFIER) || this.match(TokenType.KEYWORD)) {
					value = this.previous().value;
				} else {
					this.error("Expected table entry value");
				}
				if (this.check(TokenType.PUNCTUATION, ",")) {
					this.advance();
				}
				entries.push({ key, value });
			} else {
				this.error("Expected string key in table entry");
			}
		}
		this.consume(TokenType.PUNCTUATION, "Expected '}' after table entries");

		return {
			type: "TableDeclaration",
			name: nameToken.value,
			valueType,
			entries,
			location: { line: token.line, column: token.column },
		};
	}

	private parseBackendDeclaration(): VCLBackendDeclaration {
		const token = this.previous();
		const nameToken = this.consumeName("Expected backend name");
		this.consume(TokenType.PUNCTUATION, "Expected '{' after backend name");

		const properties: VCLBackendProperty[] = [];
		while (!this.check(TokenType.PUNCTUATION, "}") && !this.isAtEnd()) {
			if (this.match(TokenType.PUNCTUATION, ".")) {
				const propName = this.consumeName("Expected property name").value;
				this.consume(TokenType.OPERATOR, "Expected '=' after property name");
				let value: string | number = "";
				if (this.match(TokenType.STRING)) {
					value = this.previous().value;
					if (
						(value.startsWith('"') && value.endsWith('"')) ||
						(value.startsWith("'") && value.endsWith("'"))
					) {
						value = (value as string).slice(1, -1);
					}
				} else if (this.match(TokenType.NUMBER)) {
					const raw = this.previous().value;
					// Keep RTIME values ("5s", "500ms") as strings so the unit survives.
					value = /[a-z]$/.test(raw) ? raw : parseFloat(raw);
				} else if (this.match(TokenType.IDENTIFIER) || this.match(TokenType.KEYWORD)) {
					value = this.previous().value;
				} else if (this.check(TokenType.PUNCTUATION, "{")) {
					// Nested block value such as `.probe = { ... }`: parse its
					// dotted properties into a structured object.
					this.advance();
					const probeProps: VCLBackendProperty[] = [];
					while (!this.check(TokenType.PUNCTUATION, "}") && !this.isAtEnd()) {
						if (this.match(TokenType.PUNCTUATION, ".")) {
							const nestedName = this.consumeName("Expected probe property name").value;
							this.consume(TokenType.OPERATOR, "Expected '=' after probe property name");
							let nestedValue: string | number = "";
							const stringParts: string[] = [];
							// A probe .request is written as adjacent strings, one per line.
							while (this.check(TokenType.STRING)) {
								stringParts.push(this.unquoteStringToken(this.advance().value));
							}
							if (stringParts.length > 0) {
								nestedValue = stringParts.join("\r\n");
							} else if (this.match(TokenType.NUMBER)) {
								const raw = this.previous().value;
								nestedValue = /[a-z]$/.test(raw) ? raw : parseFloat(raw);
							} else if (this.match(TokenType.IDENTIFIER) || this.match(TokenType.KEYWORD)) {
								nestedValue = this.previous().value;
							}
							if (this.check(TokenType.PUNCTUATION, ";")) this.advance();
							probeProps.push({ name: nestedName, value: nestedValue });
						} else {
							this.advance();
						}
					}
					this.consume(TokenType.PUNCTUATION, "Expected '}' after probe block");
					properties.push({ name: propName, value: { type: "probe", properties: probeProps } });
					if (this.check(TokenType.PUNCTUATION, ";")) this.advance();
					continue;
				}
				if (this.check(TokenType.PUNCTUATION, ";")) {
					this.advance();
				}
				properties.push({ name: propName, value });
			} else {
				this.advance();
			}
		}
		this.consume(TokenType.PUNCTUATION, "Expected '}' after backend properties");

		return {
			type: "BackendDeclaration",
			name: nameToken.value,
			properties,
			location: { line: token.line, column: token.column },
		};
	}

	private parseComment(): VCLComment {
		const token = this.previous();
		return {
			type: "Comment",
			value: token.value.substring(1).trim(),
			multiline: false,
			location: { line: token.line, column: token.column },
		};
	}

	private parseSubroutine(): VCLSubroutine {
		const nameToken = this.consumeName("Expected subroutine name");
		let params: VCLSubroutineParam[] | undefined;
		let returnType: string | undefined;

		// Parse optional parameter list: sub name(TYPE param1, TYPE param2)
		if (this.check(TokenType.PUNCTUATION, "(")) {
			this.advance(); // consume '('
			params = [];
			while (!this.check(TokenType.PUNCTUATION, ")") && !this.isAtEnd()) {
				const paramType = this.consume(TokenType.IDENTIFIER, "Expected parameter type").value;
				const paramName = this.consume(TokenType.IDENTIFIER, "Expected parameter name").value;
				params.push({ name: paramName, paramType });
				if (!this.check(TokenType.PUNCTUATION, ")")) {
					this.consume(TokenType.PUNCTUATION, "Expected ',' between parameters");
				}
			}
			this.consume(TokenType.PUNCTUATION, "Expected ')' after parameters");
		}

		if (this.check(TokenType.IDENTIFIER) && !this.check(TokenType.PUNCTUATION, "{")) {
			returnType = this.advance().value;
		}
		this.consume(TokenType.PUNCTUATION, "Expected '{' after subroutine name");
		const startToken = this.tokens[this.current - 1];
		const startPos = startToken?.position !== undefined ? startToken.position + 1 : 0;
		const body: VCLStatement[] = [];
		while (!this.check(TokenType.PUNCTUATION, "}") && !this.isAtEnd()) {
			body.push(this.parseStatement());
		}
		const currentToken = this.tokens[this.current];
		const endPos = currentToken ? currentToken.position : this.source.length;
		const rawVCL = this.source.substring(startPos, endPos);
		this.consume(TokenType.PUNCTUATION, "Expected '}' after subroutine body");
		return {
			type: "Subroutine",
			name: nameToken.value,
			params,
			body,
			raw: rawVCL,
			returnType,
			location: { line: nameToken.line, column: nameToken.column },
		};
	}

	private parseStatement(): VCLStatement {
		const startToken = this.peek();
		// Check for label (identifier followed by colon)
		if (this.check(TokenType.IDENTIFIER)) {
			const nextToken = this.peek(1);
			if (nextToken?.type === TokenType.PUNCTUATION && nextToken.value === ":") {
				const labelName = this.advance().value;
				const labelToken = this.previous();
				this.advance();
				// A label is a pure position marker; the following statements are
				// parsed normally and belong to the enclosing block.
				return {
					type: "LabelStatement",
					name: labelName,
					location: { line: labelToken.line, column: labelToken.column },
				} as VCLLabelStatement;
			}
		}

		// Skip comments
		if (this.match(TokenType.COMMENT)) {
			return {
				type: "Statement",
				location: {
					line: this.previous().line,
					column: this.previous().column,
				},
			};
		}

		// Bare { ... } nested block: a statement group in its own scope.
		if (this.check(TokenType.PUNCTUATION, "{")) {
			const braceToken = this.advance();
			const body: VCLStatement[] = [];
			while (!this.check(TokenType.PUNCTUATION, "}") && !this.isAtEnd()) {
				body.push(this.parseStatement());
			}
			this.consume(TokenType.PUNCTUATION, "Expected '}' after block");
			return {
				type: "BlockStatement",
				body,
				location: { line: braceToken.line, column: braceToken.column },
			};
		}

		if (this.match(TokenType.KEYWORD)) {
			const keyword = this.previous().value;

			switch (keyword) {
				case "if":
					return this.parseIfStatement();
				case "return":
					return this.parseReturnStatement();
				case "error":
					return this.parseErrorStatement();
				case "set":
					return this.parseSetStatement();
				case "unset":
					return this.parseUnsetStatement();
				case "add":
					return this.parseAddStatement();
				case "remove":
					return this.parseRemoveStatement();
				case "call":
					return this.parseCallStatement();
				case "synthetic":
					return this.parseSyntheticStatement();
				case "hash_data":
					return this.parseHashDataStatement();
				case "log":
					return this.parseBareLogStatement();
				case "esi":
					return this.parseEsiStatement();
				case "switch":
					return this.parseSwitchStatement();
				case "declare":
					return this.parseDeclareStatement();
				case "goto":
					return this.parseGotoStatement();
				case "restart":
					return this.parseRestartStatement();
				case "include": {
					// Includes are not resolved to files by this loader (top-level
					// includes are recorded but not inlined); accept and ignore.
					const include = this.parseIncludeStatement();
					return { type: "Statement", location: include.location };
				}
				case "pragma": {
					// Skip pragma statements - consume tokens until semicolon
					while (!this.check(TokenType.PUNCTUATION, ";") && !this.isAtEnd()) this.advance();
					if (this.check(TokenType.PUNCTUATION, ";")) this.advance();
					return {
						type: "Statement",
						location: { line: this.previous().line, column: this.previous().column },
					};
				}
			}
		} else if (this.match(TokenType.IDENTIFIER)) {
			const identifier = this.previous().value;
			const token = this.previous();

			if (identifier === "declare") {
				return this.parseDeclareStatement();
			} else if (identifier === "synthetic.base64") {
				return this.parseSyntheticBase64Statement();
			} else if (identifier === "std.log" || identifier.startsWith("std.log")) {
				if (this.check(TokenType.PUNCTUATION, "(")) {
					return this.parseLogStatement();
				}
				const message: VCLStringLiteral = {
					type: "StringLiteral",
					value: "Log message",
					location: { line: token.line, column: token.column },
				};
				while (!this.check(TokenType.PUNCTUATION, ";") && !this.isAtEnd()) this.advance();
				this.consume(TokenType.PUNCTUATION, "Expected ';' after log statement");
				return {
					type: "LogStatement" as const,
					message,
					location: { line: token.line, column: token.column },
				};
			} else if (identifier === "hash_data") {
				return this.parseHashDataStatement();
			} else if (identifier.includes(".") && this.check(TokenType.OPERATOR, "=")) {
				this.consume(TokenType.OPERATOR, "Expected '=' after identifier");
				const value = this.parseExpression();
				this.consume(TokenType.PUNCTUATION, "Expected ';' after set statement");
				return {
					type: "SetStatement",
					target: identifier,
					value,
					location: {
						line: this.previous().line,
						column: this.previous().column,
					},
				};
			} else if (this.check(TokenType.PUNCTUATION, "(")) {
				// A bare function call is a valid statement for void builtins such as
				// ratelimit.penaltybox_add(...) or h2.disable_header_compression().
				const expression = this.parseFunctionCall(token);
				this.consume(TokenType.PUNCTUATION, "Expected ';' after function call statement");
				return {
					type: "ExpressionStatement",
					expression,
					location: { line: token.line, column: token.column },
				};
			}
		}

		throw new Error(
			`Unexpected statement "${startToken.value}" at line ${startToken.line}, column ${startToken.column}`,
		);
	}

	private parseDeclareStatement(): VCLStatement {
		const token = this.previous();

		if (this.match(TokenType.IDENTIFIER) && this.previous().value === "local") {
		}

		if (!this.match(TokenType.IDENTIFIER)) {
			this.error("Expected variable name after 'declare local'");
		}

		const variableName = this.previous().value;
		if (!variableName.startsWith("var.")) {
			const prev = this.previous();
			throw new Error(
				`Local variable "${variableName}" must be prefixed with 'var.' at line ${prev.line}, column ${prev.column}`,
			);
		}
		if (!this.match(TokenType.IDENTIFIER)) this.error("Expected variable type after variable name");
		const variableType = this.previous().value;

		let initialValue: VCLExpression | undefined;
		if (this.check(TokenType.OPERATOR, "=")) {
			this.advance(); // consume '='
			initialValue = this.parseExpression();
		}

		this.consume(TokenType.PUNCTUATION, "Expected ';' after declare statement");
		return {
			type: "DeclareStatement",
			variableName,
			variableType,
			initialValue,
			location: { line: token.line, column: token.column },
		};
	}

	private parseStatementBlock(requireBraces: boolean = false): VCLStatement[] {
		const statements: VCLStatement[] = [];
		const hasBraces = this.match(TokenType.PUNCTUATION, "{");
		if (requireBraces && !hasBraces) this.consume(TokenType.PUNCTUATION, "Expected '{'");
		while (
			(!hasBraces || !this.check(TokenType.PUNCTUATION, "}")) &&
			!this.check(TokenType.KEYWORD, "else") &&
			!this.isAtEnd()
		) {
			statements.push(this.parseStatement());
		}
		if (hasBraces) this.consume(TokenType.PUNCTUATION, "Expected '}' after block");
		return statements;
	}

	private parseElseClause(): VCLStatement[] | undefined {
		while (this.check(TokenType.COMMENT)) this.advance();
		if (!this.check(TokenType.KEYWORD)) return undefined;
		const kw = this.peek().value;
		if (kw === "elseif" || kw === "elsif") {
			this.advance();
			return [this.parseIfStatement()];
		}
		if (kw !== "else") return undefined;
		this.advance();
		if (this.check(TokenType.KEYWORD) && this.peek().value === "if") {
			this.advance();
			return [this.parseIfStatement()];
		}
		return this.parseStatementBlock(false);
	}

	private parseIfStatement(): VCLIfStatement {
		const token = this.previous();
		this.consume(TokenType.PUNCTUATION, "Expected '(' after if");
		const test = this.parseExpression();
		this.consume(TokenType.PUNCTUATION, "Expected ')' after condition");
		const consequent = this.parseStatementBlock(false);
		const alternate = this.parseElseClause();
		return {
			type: "IfStatement",
			test,
			consequent,
			alternate,
			location: { line: token.line, column: token.column },
		};
	}

	private parseReturnStatement(): VCLReturnStatement {
		const token = this.previous();

		// Bare `return;`
		if (this.check(TokenType.PUNCTUATION, ";")) {
			this.advance();
			return {
				type: "ReturnStatement",
				argument: "",
				location: { line: token.line, column: token.column },
			};
		}

		// Paren-less action form: `return lookup;` (keywords that start
		// expressions, like true/false, still parse as value returns).
		if (
			this.check(TokenType.KEYWORD) &&
			RETURN_ACTIONS.has(this.peek().value) &&
			this.peek(1)?.value === ";"
		) {
			const argument = this.advance().value;
			this.advance(); // consume ';'
			return {
				type: "ReturnStatement",
				argument,
				location: { line: token.line, column: token.column },
			};
		}

		if (this.check(TokenType.PUNCTUATION, "(")) {
			this.advance();
			let argument = "";
			if (this.match(TokenType.IDENTIFIER) || this.match(TokenType.KEYWORD)) {
				argument = this.previous().value;
			} else {
				throw new Error(
					`Expected return argument at line ${this.peek().line}, column ${this.peek().column}`,
				);
			}
			this.consume(TokenType.PUNCTUATION, "Expected ')' after return argument");
			this.consume(TokenType.PUNCTUATION, "Expected ';' after return statement");
			return {
				type: "ReturnStatement",
				argument,
				location: { line: token.line, column: token.column },
			};
		}

		// This is a return with a value expression: return expr;
		// Used in typed subroutines (sub my_func STRING { return "value"; })
		const value = this.parseExpression();

		this.consume(TokenType.PUNCTUATION, "Expected ';' after return statement");

		// For value returns, we store the expression as-is
		// The argument field is used for the string representation
		let argument: string;
		if (value.type === "StringLiteral") {
			argument = (value as VCLStringLiteral).value;
		} else if (value.type === "NumberLiteral") {
			argument = String((value as VCLNumberLiteral).value);
		} else if (value.type === "Identifier") {
			argument = (value as VCLIdentifier).name;
		} else {
			// For complex expressions, use a placeholder
			argument = "__expression__";
		}

		return {
			type: "ReturnStatement",
			argument,
			value, // Store the actual expression for evaluation
			location: {
				line: token.line,
				column: token.column,
			},
		};
	}

	/**
	 * Parses an error statement.
	 * Supports: `error;`, `error <code>;`, `error <code> <response-expr>;`
	 * where <code> is an integer literal, identifier, or function call and the
	 * response is a full expression (including concatenations).
	 *
	 * @returns The parsed error statement
	 */
	private parseErrorStatement(): VCLErrorStatement {
		const token = this.previous();

		let status: VCLExpression | undefined;
		let message: VCLExpression | undefined;

		if (!this.check(TokenType.PUNCTUATION, ";")) {
			// The status code must be an integer literal, identifier, or function
			// call; a full expression would swallow the response argument.
			if (this.check(TokenType.NUMBER)) {
				const numToken = this.advance();
				status = {
					type: "NumberLiteral",
					value: parseFloat(numToken.value),
					isFloat: numToken.value.includes("."),
					location: { line: numToken.line, column: numToken.column },
				};
			} else if (this.check(TokenType.IDENTIFIER)) {
				const identToken = this.advance();
				if (this.check(TokenType.PUNCTUATION, "(")) {
					status = this.parseFunctionCall(identToken);
				} else {
					status = {
						type: "Identifier",
						name: identToken.value,
						location: { line: identToken.line, column: identToken.column },
					};
				}
			} else {
				this.error("Expected status code after 'error'");
			}

			if (!this.check(TokenType.PUNCTUATION, ";")) {
				message = this.parseExpression();
			}
		}

		this.consume(TokenType.PUNCTUATION, "Expected ';' after error statement");

		return {
			type: "ErrorStatement",
			status,
			message,
			location: {
				line: token.line,
				column: token.column,
			},
		};
	}

	/**
	 * Parses a set statement
	 *
	 * @returns The parsed set statement
	 */
	private parseSetStatement(): VCLSetStatement {
		const token = this.previous();

		// Parse the target (e.g., req.http.X-Header)
		// Use parseExpression to handle complex expressions including property access chains
		if (!this.match(TokenType.IDENTIFIER)) {
			this.error("Expected identifier after 'set'");
		}

		// Create the identifier expression
		let targetExpr: VCLExpression = {
			type: "Identifier",
			name: this.previous().value,
			location: {
				line: this.previous().line,
				column: this.previous().column,
			},
		};

		// Handle property access (e.g., req.http.X-Header)
		while (this.check(TokenType.IDENTIFIER) && this.peek().value.startsWith(".")) {
			// Consume the property token
			const propertyToken = this.advance();
			const propertyName = propertyToken.value.substring(1); // Remove the leading dot

			targetExpr = {
				type: "MemberAccess",
				object: targetExpr,
				property: propertyName,
				location: {
					line: propertyToken.line,
					column: propertyToken.column,
				},
			};
		}

		// Convert the expression to a string target
		let target = "";
		if (targetExpr.type === "Identifier") {
			target = targetExpr.name;
		} else if (targetExpr.type === "MemberAccess") {
			// Recursively build the target string
			const buildTarget = (expr: VCLExpression): string => {
				if (expr.type === "Identifier") {
					return expr.name;
				} else if (expr.type === "MemberAccess") {
					return `${buildTarget(expr.object)}.${expr.property}`;
				}
				return "";
			};
			target = buildTarget(targetExpr);
		}

		// Parse the assignment operator (supports compound operators)
		const compoundOperators = [
			"+=",
			"-=",
			"*=",
			"/=",
			"%=",
			"&&=",
			"||=",
			"&=",
			"|=",
			"^=",
			"<<=",
			">>=",
			"rol=",
			"ror=",
		];
		let operator = "=";

		if (this.check(TokenType.IDENTIFIER)) {
			const identValue = this.peek().value;
			if (
				(identValue === "rol" || identValue === "ror") &&
				this.current + 1 < this.tokens.length &&
				this.tokens[this.current + 1]?.value === "="
			) {
				operator = `${identValue}=`;
				this.advance();
				this.advance();
			} else {
				this.error("Expected assignment operator after identifier");
			}
		} else if (this.check(TokenType.OPERATOR)) {
			const opToken = this.peek();
			if (compoundOperators.includes(opToken.value)) {
				operator = opToken.value;
				this.advance();
			} else if (opToken.value === "=") {
				operator = "=";
				this.advance();
			} else {
				this.error("Expected assignment operator after identifier");
			}
		} else {
			this.error("Expected assignment operator after identifier");
		}

		// Parse the value (if() functions are handled by parsePrimary)
		const value = this.parseExpression();

		// Parse the semicolon
		this.consume(TokenType.PUNCTUATION, "Expected ';' after set statement");

		return {
			type: "SetStatement",
			target,
			value,
			operator,
			location: {
				line: token.line,
				column: token.column,
			},
		};
	}

	/**
	 * Parses an unset statement
	 *
	 * @returns The parsed unset statement
	 */
	private parseUnsetStatement(): VCLUnsetStatement {
		const token = this.previous();

		// Parse the target
		let target = this.consume(TokenType.IDENTIFIER, "Expected unset target").value;

		// Support wildcard unset: unset req.http.X-Debug-*;
		// The lexer tokenizes the trailing -* as an OPERATOR token
		if (this.check(TokenType.OPERATOR) && this.peek().value.endsWith("*")) {
			target += this.advance().value;
		}

		this.consume(TokenType.PUNCTUATION, "Expected ';' after unset statement");

		return {
			type: "UnsetStatement",
			target,
			location: {
				line: token.line,
				column: token.column,
			},
		};
	}

	/**
	 * Parses a log statement
	 *
	 * @returns The parsed log statement
	 */
	private parseLogStatement(): VCLLogStatement {
		const token = this.previous();

		this.consume(TokenType.PUNCTUATION, "Expected '(' after std.log");

		// Parse the message
		const message = this.parseExpression();

		this.consume(TokenType.PUNCTUATION, "Expected ')' after log message");
		this.consume(TokenType.PUNCTUATION, "Expected ';' after log statement");

		return {
			type: "LogStatement",
			message,
			location: {
				line: token.line,
				column: token.column,
			},
		};
	}

	/**
	 * Parses a synthetic statement
	 *
	 * @returns The parsed synthetic statement
	 */
	private parseSyntheticBase64Statement(): VCLSyntheticBase64Statement {
		const token = this.previous();
		const content = this.parseExpression();
		this.consume(TokenType.PUNCTUATION, "Expected ';' after synthetic.base64 statement");
		return {
			type: "SyntheticBase64Statement",
			content,
			location: { line: token.line, column: token.column },
		};
	}

	private parseSyntheticStatement(): VCLSyntheticStatement {
		const token = this.previous();

		// Check if next identifier is .base64 (synthetic.base64)
		if (this.check(TokenType.IDENTIFIER) && this.peek().value === ".base64") {
			// This shouldn't normally get here since we handle it in the identifier branch,
			// but handle it as a safety measure
			this.advance(); // consume .base64
			const content = this.parseExpression();
			this.consume(TokenType.PUNCTUATION, "Expected ';' after synthetic.base64 statement");
			return {
				type: "SyntheticStatement",
				content: `__base64__:${content}`,
				location: { line: token.line, column: token.column },
			} as any;
		}

		// The synthetic body is a full expression in Fastly VCL, so it can be a
		// single string, a {"..."} long string, or any concatenation of strings and
		// variables such as {"Error "} + obj.status + {": "} + obj.response.
		const expression = this.parseExpression();
		this.consume(TokenType.PUNCTUATION, "Expected ';' after synthetic statement");

		return {
			type: "SyntheticStatement",
			content: "",
			expression,
			location: {
				line: token.line,
				column: token.column,
			},
		};
	}

	/**
	 * Parses a hash_data statement
	 *
	 * @returns The parsed hash_data statement
	 */
	private parseHashDataStatement(): VCLHashDataStatement {
		const token = this.previous();

		this.consume(TokenType.PUNCTUATION, "Expected '(' after hash_data");

		// Parse the value
		const value = this.parseExpression();

		this.consume(TokenType.PUNCTUATION, "Expected ')' after hash_data value");
		this.consume(TokenType.PUNCTUATION, "Expected ';' after hash_data statement");

		return {
			type: "HashDataStatement",
			value,
			location: {
				line: token.line,
				column: token.column,
			},
		};
	}

	/**
	 * Parses a goto statement
	 *
	 * @returns The parsed goto statement
	 */
	private parseGotoStatement(): VCLGotoStatement {
		const token = this.previous();

		// Parse the label name
		const labelToken = this.consume(TokenType.IDENTIFIER, "Expected label name after 'goto'");
		const label = labelToken.value;

		// Consume the semicolon
		this.consume(TokenType.PUNCTUATION, "Expected ';' after goto statement");

		return {
			type: "GotoStatement",
			label,
			location: {
				line: token.line,
				column: token.column,
			},
		};
	}

	/**
	 * Parses a restart statement
	 *
	 * @returns The parsed restart statement
	 */
	private parseRestartStatement(): VCLRestartStatement {
		const token = this.previous();

		// Consume the semicolon
		this.consume(TokenType.PUNCTUATION, "Expected ';' after restart statement");

		return {
			type: "RestartStatement",
			location: {
				line: token.line,
				column: token.column,
			},
		};
	}

	private parseAddStatement(): VCLAddStatement {
		const token = this.previous();
		// Parse like set but stores as AddStatement
		if (!this.match(TokenType.IDENTIFIER)) {
			this.error("Expected identifier after 'add'");
		}
		const target = this.previous().value;
		this.consume(TokenType.OPERATOR, "Expected '=' after identifier");
		const value = this.parseExpression();
		this.consume(TokenType.PUNCTUATION, "Expected ';' after add statement");
		return {
			type: "AddStatement",
			target,
			value,
			location: { line: token.line, column: token.column },
		};
	}

	private parseRemoveStatement(): VCLRemoveStatement {
		const token = this.previous();
		let target = this.consume(TokenType.IDENTIFIER, "Expected target after 'remove'").value;
		// Support wildcard: remove req.http.X-*;
		if (this.check(TokenType.OPERATOR) && this.peek().value.endsWith("*")) {
			target += this.advance().value;
		}
		this.consume(TokenType.PUNCTUATION, "Expected ';' after remove statement");
		return {
			type: "RemoveStatement",
			target,
			location: { line: token.line, column: token.column },
		};
	}

	private parseCallStatement(): VCLCallStatement {
		const token = this.previous();
		const subroutineName = this.consume(
			TokenType.IDENTIFIER,
			"Expected subroutine name after 'call'",
		).value;
		const args: VCLExpression[] = [];
		// Optional argument list
		if (this.check(TokenType.PUNCTUATION, "(")) {
			this.advance();
			if (!this.check(TokenType.PUNCTUATION, ")")) {
				do {
					args.push(this.parseExpression());
				} while (this.match(TokenType.PUNCTUATION, ","));
			}
			this.consume(TokenType.PUNCTUATION, "Expected ')' after call arguments");
		}
		this.consume(TokenType.PUNCTUATION, "Expected ';' after call statement");
		return {
			type: "CallStatement",
			subroutineName,
			arguments: args,
			location: { line: token.line, column: token.column },
		};
	}

	private parseBareLogStatement(): VCLLogStatement {
		const token = this.previous();
		const message = this.parseExpression();
		this.consume(TokenType.PUNCTUATION, "Expected ';' after log statement");
		return {
			type: "LogStatement",
			message,
			location: { line: token.line, column: token.column },
		};
	}

	private parseEsiStatement(): VCLEsiStatement {
		const token = this.previous();
		this.consume(TokenType.PUNCTUATION, "Expected ';' after esi statement");
		return {
			type: "EsiStatement",
			location: { line: token.line, column: token.column },
		};
	}

	private parseSwitchStatement(): VCLSwitchStatement {
		const token = this.previous();
		this.consume(TokenType.PUNCTUATION, "Expected '(' after switch");
		const subject = this.parseExpression();
		this.consume(TokenType.PUNCTUATION, "Expected ')' after switch expression");
		this.consume(TokenType.PUNCTUATION, "Expected '{' after switch");

		const cases: VCLSwitchCase[] = [];
		let sawDefault = false;
		while (!this.check(TokenType.PUNCTUATION, "}") && !this.isAtEnd()) {
			if (this.match(TokenType.COMMENT)) continue;
			if (this.match(TokenType.KEYWORD, "case")) {
				const caseToken = this.previous();
				// `case ~"pattern":` is a regex-match case.
				let isRegex = false;
				if (this.check(TokenType.OPERATOR, "~")) {
					this.advance();
					isRegex = true;
				}
				if (!this.check(TokenType.STRING)) {
					throw new Error(
						`Expected string literal after 'case' at line ${caseToken.line}, column ${caseToken.column}`,
					);
				}
				const test = this.parsePrimary();
				const label = (test as VCLStringLiteral).value;
				for (const other of cases) {
					if (
						other.test !== null &&
						Boolean(other.regex) === isRegex &&
						(other.test as VCLStringLiteral).value === label
					) {
						throw new Error(
							`Duplicate case "${label}" in switch at line ${caseToken.line}, column ${caseToken.column}`,
						);
					}
				}
				this.consume(TokenType.PUNCTUATION, "Expected ':' after case expression");
				const { body, fallthrough } = this.parseSwitchCaseBody(caseToken);
				cases.push({ test, regex: isRegex, body, fallthrough } as VCLSwitchCase);
			} else if (this.match(TokenType.KEYWORD, "default")) {
				const defaultToken = this.previous();
				if (sawDefault) {
					throw new Error(
						`Multiple default cases in switch at line ${defaultToken.line}, column ${defaultToken.column}`,
					);
				}
				sawDefault = true;
				this.consume(TokenType.PUNCTUATION, "Expected ':' after default");
				const { body, fallthrough } = this.parseSwitchCaseBody(defaultToken);
				cases.push({ test: null, body, fallthrough } as VCLSwitchCase);
			} else {
				const tok = this.peek();
				throw new Error(
					`Expected 'case' or 'default' in switch at line ${tok.line}, column ${tok.column}`,
				);
			}
		}
		this.consume(TokenType.PUNCTUATION, "Expected '}' after switch body");
		if (cases.length === 0) {
			throw new Error(`Empty switch statement at line ${token.line}, column ${token.column}`);
		}
		if (cases[cases.length - 1]!.fallthrough) {
			throw new Error(
				`Final case cannot have fallthrough at line ${token.line}, column ${token.column}`,
			);
		}
		return {
			type: "SwitchStatement",
			subject,
			cases,
			location: { line: token.line, column: token.column },
		};
	}

	/** Parse a case/default body; it must end with `break;` or `fallthrough;`. */
	private parseSwitchCaseBody(caseToken: Token): { body: VCLStatement[]; fallthrough: boolean } {
		const body: VCLStatement[] = [];
		while (
			!this.check(TokenType.KEYWORD, "case") &&
			!this.check(TokenType.KEYWORD, "default") &&
			!this.check(TokenType.PUNCTUATION, "}") &&
			!this.isAtEnd()
		) {
			if (this.match(TokenType.COMMENT)) continue;
			if (this.check(TokenType.KEYWORD, "break")) {
				this.advance();
				this.consume(TokenType.PUNCTUATION, "Expected ';' after break");
				return { body, fallthrough: false };
			}
			if (this.check(TokenType.KEYWORD, "fallthrough")) {
				this.advance();
				this.consume(TokenType.PUNCTUATION, "Expected ';' after fallthrough");
				return { body, fallthrough: true };
			}
			body.push(this.parseStatement());
		}
		throw new Error(
			`Case body must end with 'break' or 'fallthrough' at line ${caseToken.line}, column ${caseToken.column}`,
		);
	}

	private parseDirectorDeclaration(): VCLDirectorDeclaration {
		const token = this.previous();
		const nameToken = this.consumeName("Expected director name");
		// The director type is usually a plain identifier, but "hash" is also a
		// keyword, so accept either token kind here.
		if (!this.check(TokenType.IDENTIFIER) && !this.check(TokenType.KEYWORD)) {
			this.error("Expected director type");
		}
		const directorType = this.advance().value;
		this.consume(TokenType.PUNCTUATION, "Expected '{' after director type");

		const properties: VCLBackendProperty[] = [];
		const backends: Array<{ name: string; weight?: number }> = [];

		while (!this.check(TokenType.PUNCTUATION, "}") && !this.isAtEnd()) {
			if (this.match(TokenType.PUNCTUATION, "{")) {
				// Backend entry block: { .backend = name; .weight = N; }
				let backendName = "";
				let weight: number | undefined;
				while (!this.check(TokenType.PUNCTUATION, "}") && !this.isAtEnd()) {
					if (this.match(TokenType.PUNCTUATION, ".")) {
						const propName = this.consumeName("Expected property name").value;
						this.consume(TokenType.OPERATOR, "Expected '=' after property name");
						if (propName === "backend") {
							backendName = this.consumeName("Expected backend name").value;
						} else if (propName === "weight") {
							weight = parseFloat(this.consume(TokenType.NUMBER, "Expected weight value").value);
						} else {
							// Skip other properties
							if (
								this.match(TokenType.STRING) ||
								this.match(TokenType.NUMBER) ||
								this.match(TokenType.IDENTIFIER) ||
								this.match(TokenType.KEYWORD)
							) {
								// consumed value
							}
						}
						if (this.check(TokenType.PUNCTUATION, ";")) this.advance();
					} else {
						this.advance();
					}
				}
				this.consume(TokenType.PUNCTUATION, "Expected '}' after backend entry");
				if (backendName) backends.push({ name: backendName, weight });
			} else if (this.match(TokenType.PUNCTUATION, ".")) {
				const propName = this.consumeName("Expected property name").value;
				this.consume(TokenType.OPERATOR, "Expected '=' after property name");
				let value: string | number = "";
				if (this.match(TokenType.STRING)) {
					value = this.previous().value.replace(/^["']|["']$/g, "");
				} else if (this.match(TokenType.NUMBER)) {
					value = parseFloat(this.previous().value);
					// Consume trailing % (e.g., .quorum = 50%)
					if (this.check(TokenType.OPERATOR, "%")) this.advance();
				} else if (this.match(TokenType.IDENTIFIER) || this.match(TokenType.KEYWORD)) {
					value = this.previous().value;
				}
				if (this.check(TokenType.PUNCTUATION, ";")) this.advance();
				properties.push({ name: propName, value });
			} else {
				this.advance();
			}
		}
		this.consume(TokenType.PUNCTUATION, "Expected '}' after director declaration");

		return {
			type: "DirectorDeclaration",
			name: nameToken.value,
			directorType,
			properties,
			backends,
			location: { line: token.line, column: token.column },
		};
	}

	private parsePenaltyboxDeclaration(): VCLPenaltyboxDeclaration {
		const token = this.previous();
		const nameToken = this.consumeName("Expected penaltybox name");
		this.consume(TokenType.PUNCTUATION, "Expected '{' after penaltybox name");
		// Penaltybox body is typically empty
		while (!this.check(TokenType.PUNCTUATION, "}") && !this.isAtEnd()) {
			this.advance();
		}
		this.consume(TokenType.PUNCTUATION, "Expected '}' after penaltybox body");
		return {
			type: "PenaltyboxDeclaration",
			name: nameToken.value,
			location: { line: token.line, column: token.column },
		};
	}

	private parseRatecounterDeclaration(): VCLRatecounterDeclaration {
		const token = this.previous();
		const nameToken = this.consumeName("Expected ratecounter name");
		this.consume(TokenType.PUNCTUATION, "Expected '{' after ratecounter name");
		// Ratecounter body is typically empty
		while (!this.check(TokenType.PUNCTUATION, "}") && !this.isAtEnd()) {
			this.advance();
		}
		this.consume(TokenType.PUNCTUATION, "Expected '}' after ratecounter body");
		return {
			type: "RatecounterDeclaration",
			name: nameToken.value,
			location: { line: token.line, column: token.column },
		};
	}

	private parseExpression(): VCLExpression {
		return this.parseTernary();
	}

	private parseTernary(): VCLExpression {
		const expr = this.parseLogicalOr();

		// Check for ternary operator: condition ? trueExpr : falseExpr
		if (this.match(TokenType.PUNCTUATION, "?")) {
			// Parse the true expression
			const trueExpr = this.parseExpression();

			// Check for the colon
			if (
				this.match(TokenType.PUNCTUATION, ":") ||
				(this.match(TokenType.PUNCTUATION, ",") && this.check(TokenType.STRING))
			) {
				// Parse the false expression
				const falseExpr = this.parseExpression();

				// Create a ternary expression
				return {
					type: "TernaryExpression",
					condition: expr,
					trueExpr,
					falseExpr,
					location: {
						line: expr.location?.line || 0,
						column: expr.location?.column || 0,
					},
				};
			} else {
				// If there's no colon, it might be a function call with the 'if' syntax
				// For example: if(condition, trueExpr, falseExpr)
				if (this.match(TokenType.PUNCTUATION, ",")) {
					const falseExpr = this.parseExpression();

					// Check for closing parenthesis
					this.consume(TokenType.PUNCTUATION, "Expected ')' after ternary expression");

					// Create a ternary expression
					return {
						type: "TernaryExpression",
						condition: expr,
						trueExpr,
						falseExpr,
						location: {
							line: expr.location?.line || 0,
							column: expr.location?.column || 0,
						},
					};
				}
			}
		}

		return expr;
	}

	private parseLogicalOr(): VCLExpression {
		let expr = this.parseLogicalAnd();

		while (this.match(TokenType.OPERATOR, "||")) {
			const operator = this.previous().value;
			const right = this.parseLogicalAnd();

			expr = {
				type: "BinaryExpression",
				operator,
				left: expr,
				right,
				location: {
					line: expr.location?.line || 0,
					column: expr.location?.column || 0,
				},
			};
		}

		return expr;
	}

	private parseLogicalAnd(): VCLExpression {
		let expr = this.parseEquality();

		while (this.match(TokenType.OPERATOR, "&&")) {
			const operator = this.previous().value;
			const right = this.parseEquality();

			expr = {
				type: "BinaryExpression",
				operator,
				left: expr,
				right,
				location: {
					line: expr.location?.line || 0,
					column: expr.location?.column || 0,
				},
			};
		}

		return expr;
	}

	private parseEquality(): VCLExpression {
		let expr = this.parseComparison();

		while (this.match(TokenType.OPERATOR, "==") || this.match(TokenType.OPERATOR, "!=")) {
			const operator = this.previous().value;
			const right = this.parseComparison();

			// Fastly compiles a string equality's right side as a string
			// value, which admits only string constants, variables, and
			// calls. A numeric literal there — even grouped or negated — is
			// a compile error. Headers are the statically known STRINGs.
			if (
				expr.type === "Identifier" &&
				/^(req|bereq|beresp|resp|obj)\.http\./.test((expr as VCLIdentifier).name) &&
				(right.type === "NumberLiteral" || right.type === "RTimeLiteral")
			) {
				throw new Error(
					`Expected string constant, variable, or call at line ${right.location?.line}, column ${right.location?.column}`,
				);
			}

			expr = {
				type: "BinaryExpression",
				operator,
				left: expr,
				right,
				location: {
					line: expr.location?.line || 0,
					column: expr.location?.column || 0,
				},
			};
		}

		return expr;
	}

	private parseComparison(): VCLExpression {
		let expr = this.parseRegex();

		while (
			this.match(TokenType.OPERATOR, ">") ||
			this.match(TokenType.OPERATOR, ">=") ||
			this.match(TokenType.OPERATOR, "<") ||
			this.match(TokenType.OPERATOR, "<=")
		) {
			const operator = this.previous().value;
			const right = this.parseRegex();

			expr = {
				type: "BinaryExpression",
				operator,
				left: expr,
				right,
				location: {
					line: expr.location?.line || 0,
					column: expr.location?.column || 0,
				},
			};
		}

		return expr;
	}

	private parseRegex(): VCLExpression {
		let expr = this.parseTerm();

		while (this.match(TokenType.OPERATOR, "~") || this.match(TokenType.OPERATOR, "!~")) {
			const operator = this.previous().value;
			const right = this.parseTerm();

			expr = {
				type: "BinaryExpression",
				operator,
				left: expr,
				right,
				location: {
					line: expr.location?.line || 0,
					column: expr.location?.column || 0,
				},
			};
		}

		return expr;
	}

	private parseTerm(): VCLExpression {
		let expr = this.parseFactor();

		while (this.match(TokenType.OPERATOR, "+") || this.match(TokenType.OPERATOR, "-")) {
			const operator = this.previous().value;
			const right = this.parseFactor();

			expr = {
				type: "BinaryExpression",
				operator,
				left: expr,
				right,
				location: {
					line: expr.location?.line || 0,
					column: expr.location?.column || 0,
				},
			};
		}

		return expr;
	}

	private parseFactor(): VCLExpression {
		let expr = this.parseImplicitConcat();

		while (
			this.match(TokenType.OPERATOR, "*") ||
			this.match(TokenType.OPERATOR, "/") ||
			this.match(TokenType.OPERATOR, "%")
		) {
			const operator = this.previous().value;
			const right = this.parseImplicitConcat();

			expr = {
				type: "BinaryExpression",
				operator,
				left: expr,
				right,
				location: {
					line: expr.location?.line || 0,
					column: expr.location?.column || 0,
				},
			};
		}

		return expr;
	}

	/**
	 * Handles implicit string concatenation in VCL
	 * e.g., "S" time.start.sec "." time.start.usec_frac
	 * Adjacent values without operators are concatenated
	 */
	private parseImplicitConcat(): VCLExpression {
		let expr = this.parsePrimary();

		// Check if the next token is a value that can be implicitly concatenated
		// (STRING, IDENTIFIER, or NUMBER without an operator before it)
		while (this.canStartImplicitConcat()) {
			const right = this.parsePrimary();

			expr = {
				type: "BinaryExpression",
				operator: " ", // Space operator indicates implicit concatenation
				left: expr,
				right,
				location: {
					line: expr.location?.line || 0,
					column: expr.location?.column || 0,
				},
			};
		}

		return expr;
	}

	/**
	 * Checks if the current token can start an implicit concatenation
	 * Returns true if the token is STRING, IDENTIFIER, NUMBER, or if() function
	 * and not preceded by an operator
	 */
	private canStartImplicitConcat(): boolean {
		if (this.isAtEnd()) return false;

		const token = this.peek();

		// Check if we're looking at a value token that can be concatenated
		if (
			token.type === TokenType.STRING ||
			token.type === TokenType.IDENTIFIER ||
			token.type === TokenType.NUMBER
		) {
			// Don't concatenate if the identifier is a keyword like 'else', 'return', etc.
			// But 'if' followed by '(' is a function call, so we allow that
			if (token.type === TokenType.IDENTIFIER) {
				const keywords = [
					"else",
					"return",
					"error",
					"set",
					"unset",
					"add",
					"remove",
					"goto",
					"restart",
					"synthetic",
					"declare",
					"call",
					"log",
					"esi",
					"switch",
					"case",
					"default",
					"break",
					"fallthrough",
				];
				if (keywords.includes(token.value)) {
					return false;
				}
			}

			// Don't concatenate at statement boundaries (semicolon, closing paren/brace, comma)
			// These indicate we've reached the end of the expression
			return true;
		}

		// Allow if() function calls in implicit concatenation
		if (token.type === TokenType.KEYWORD && token.value === "if") {
			const nextToken = this.peek(1);
			if (nextToken && nextToken.type === TokenType.PUNCTUATION && nextToken.value === "(") {
				return true;
			}
		}

		return false;
	}

	private parsePrimary(): VCLExpression {
		// Handle parenthesized expressions
		if (this.match(TokenType.PUNCTUATION, "(")) {
			const expr = this.parseExpression();
			this.consume(TokenType.PUNCTUATION, "Expected ')' after expression");
			return expr;
		}

		// Handle literals
		if (this.match(TokenType.STRING)) {
			const token = this.previous();

			// Remove quotes (including the {"..."} / {DELIM"..."DELIM} delimiters)
			const value = this.unquoteStringToken(token.value);

			return {
				type: "StringLiteral",
				value,
				location: {
					line: token.line,
					column: token.column,
				},
			};
		}

		if (this.match(TokenType.NUMBER)) {
			return this.numberLiteralFromToken(this.previous(), false);
		}

		if (this.match(TokenType.REGEX)) {
			const token = this.previous();

			// Extract pattern and flags
			let pattern = token.value;
			const flags = "";

			// Remove the ~ operator
			if (pattern.startsWith("~")) {
				pattern = pattern.slice(1).trim();
			}

			// Remove quotes
			if (pattern.startsWith('"') && pattern.endsWith('"')) {
				pattern = pattern.slice(1, -1);
			} else if (pattern.startsWith("'") && pattern.endsWith("'")) {
				pattern = pattern.slice(1, -1);
			}

			return {
				type: "RegexLiteral",
				pattern,
				flags,
				location: {
					line: token.line,
					column: token.column,
				},
			};
		}

		if (this.match(TokenType.IDENTIFIER)) {
			const token = this.previous();

			// Check if this is a function call
			if (this.check(TokenType.PUNCTUATION, "(")) {
				return this.parseFunctionCall(token);
			}

			// Create the identifier expression
			let result: VCLExpression = {
				type: "Identifier",
				name: token.value,
				location: {
					line: token.line,
					column: token.column,
				},
			};

			// Handle property access (e.g., req.url)
			while (this.check(TokenType.IDENTIFIER) && this.peek().value.startsWith(".")) {
				// Consume the property token
				const propertyToken = this.advance();
				const propertyName = propertyToken.value.substring(1); // Remove the leading dot

				result = {
					type: "MemberAccess",
					object: result,
					property: propertyName,
					location: {
						line: propertyToken.line,
						column: propertyToken.column,
					},
				};
			}

			return result;
		}

		if (this.match(TokenType.KEYWORD, "true") || this.match(TokenType.KEYWORD, "false")) {
			const token = this.previous();
			return {
				type: "BoolLiteral",
				value: token.value === "true",
				location: {
					line: token.line,
					column: token.column,
				},
			} as any;
		}

		// Handle if() function call (ternary-like expression)
		// e.g., if(condition, true_value, false_value)
		if (this.check(TokenType.KEYWORD, "if") && this.peek(1)?.value === "(") {
			const token = this.advance(); // consume 'if'
			this.advance(); // consume '('

			// Parse condition
			const condition = this.parseExpression();

			// Consume comma
			this.consume(TokenType.PUNCTUATION, "Expected ',' after condition in if()");

			// Parse true expression
			const trueExpr = this.parseExpression();

			// Consume comma
			this.consume(TokenType.PUNCTUATION, "Expected ',' after true expression in if()");

			// Parse false expression
			const falseExpr = this.parseExpression();

			// Consume closing paren
			this.consume(TokenType.PUNCTUATION, "Expected ')' after if()");

			return {
				type: "TernaryExpression",
				condition,
				trueExpr,
				falseExpr,
				location: {
					line: token.line,
					column: token.column,
				},
			};
		}

		// Handle unary operators
		if (this.match(TokenType.OPERATOR, "!") || this.match(TokenType.OPERATOR, "-")) {
			const token = this.previous();
			const operator = token.value;
			// Fold a minus directly into a numeric literal, as Fastly's lexer
			// does; this is also what permits -9223372036854775808 (INT64_MIN)
			// while the bare positive magnitude overflows.
			if (operator === "-" && this.check(TokenType.NUMBER)) {
				return this.numberLiteralFromToken(this.advance(), true);
			}
			const operand = this.parsePrimary();

			return {
				type: "UnaryExpression",
				operator,
				operand,
				location: {
					line: token.line,
					column: token.column,
				},
			};
		}

		// Anything else is not a valid expression start.
		const tok = this.peek();
		throw new Error(
			`Unexpected token "${tok.value}" in expression at line ${tok.line}, column ${tok.column}`,
		);
	}

	/** Build a NumberLiteral or RTimeLiteral (unit-suffixed) from a NUMBER token. */
	private numberLiteralFromToken(token: Token, negative: boolean): VCLExpression {
		const unit = token.unit;
		const raw = unit ? token.value.slice(0, -unit.length) : token.value;
		const at = `at line ${token.line}, column ${token.column}`;
		const lit = parseNumericLiteral(raw, negative, at);
		if (unit) {
			return {
				type: "RTimeLiteral",
				seconds: lit.value * (TIME_UNITS[unit] ?? 1),
				raw: (negative ? "-" : "") + token.value,
				location: { line: token.line, column: token.column },
			};
		}
		return {
			type: "NumberLiteral",
			value: lit.value,
			isFloat: lit.isFloat,
			location: { line: token.line, column: token.column },
		};
	}

	private match(type: TokenType, value?: string): boolean {
		if (this.isAtEnd()) return false;
		if (this.peek().type !== type) return false;
		if (value !== undefined && this.peek().value !== value) return false;

		this.advance();
		return true;
	}

	private consume(type: TokenType, message: string): Token {
		if (this.check(type)) return this.advance();

		throw new Error(`${message} at line ${this.peek().line}, column ${this.peek().column}`);
	}

	private consumeName(message: string): Token {
		if (this.check(TokenType.IDENTIFIER) || this.check(TokenType.KEYWORD)) return this.advance();

		throw new Error(`${message} at line ${this.peek().line}, column ${this.peek().column}`);
	}

	private check(type: TokenType, value?: string): boolean {
		if (this.isAtEnd()) return false;
		if (this.peek().type !== type) return false;
		if (value !== undefined && this.peek().value !== value) return false;

		return true;
	}

	private advance(): Token {
		if (!this.isAtEnd()) this.current++;
		return this.previous();
	}

	private isAtEnd(): boolean {
		return this.peek().type === TokenType.EOF;
	}

	private peek(offset?: number): Token {
		if (offset === undefined) {
			return this.tokens[this.current]!;
		}

		const index = this.current + offset;
		if (index < 0) {
			return this.tokens[0]!;
		}
		if (index >= this.tokens.length) {
			return this.tokens[this.tokens.length - 1]!;
		}
		return this.tokens[index]!;
	}

	private previous(): Token {
		return this.tokens[this.current - 1]!;
	}

	private error(message: string): never {
		const token = this.peek();
		throw new Error(`${message} at line ${token.line}, column ${token.column}`);
	}

	private parseFunctionCall(token: Token): VCLExpression {
		const name = token.value;
		// Consume the opening parenthesis
		this.consume(TokenType.PUNCTUATION, "Expected '(' after function name");

		const args: VCLExpression[] = [];

		// Parse arguments
		if (!this.check(TokenType.PUNCTUATION, ")")) {
			do {
				args.push(this.parseExpression());
			} while (this.match(TokenType.PUNCTUATION, ","));
		}

		// Consume the closing parenthesis
		this.consume(TokenType.PUNCTUATION, "Expected ')' after function arguments");

		// Create the function call expression
		let result: VCLExpression = {
			type: "FunctionCall",
			name,
			arguments: args,
			location: {
				line: token.line,
				column: token.column,
			},
		};

		// Handle member access (e.g., func().name)
		// Keep checking for property access chains (e.g., func().prop1.prop2)
		while (this.check(TokenType.PUNCTUATION, ".")) {
			// Consume the dot
			this.advance();

			// Parse the property name
			const propertyToken = this.consume(TokenType.IDENTIFIER, "Expected property name after '.'");

			result = {
				type: "MemberAccess",
				object: result,
				property: propertyToken.value,
				location: {
					line: propertyToken.line,
					column: propertyToken.column,
				},
			};
		}

		return result;
	}
}
