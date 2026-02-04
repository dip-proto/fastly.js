import {
	type Token,
	TokenType,
	type VCLACL,
	type VCLACLEntry,
	type VCLBackendDeclaration,
	type VCLBackendProperty,
	type VCLComment,
	type VCLErrorStatement,
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
	type VCLProgram,
	type VCLRestartStatement,
	type VCLReturnStatement,
	type VCLSetStatement,
	type VCLStatement,
	type VCLStringLiteral,
	type VCLSubroutine,
	type VCLSyntheticStatement,
	type VCLTableDeclaration,
	type VCLTableEntry,
	type VCLUnsetStatement,
} from "./vcl-parser";

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
					default:
						break;
				}
			} else {
				this.advance();
			}
		}
		return program;
	}

	private isValidIPv4(ip: string): boolean {
		const parts = ip.split(".");
		if (parts.length !== 4) return false;
		return parts.every((part) => {
			const num = parseInt(part, 10);
			return (
				!Number.isNaN(num) && num >= 0 && num <= 255 && part === num.toString()
			);
		});
	}

	private isValidIPv6(ip: string): boolean {
		const doubleColonCount = (ip.match(/::/g) || []).length;
		if (doubleColonCount > 1) return false;
		const parts = ip
			.replace("::", ":DOUBLE:")
			.split(":")
			.filter((p) => p !== "");
		if (doubleColonCount === 0 && parts.length !== 8) return false;
		if (doubleColonCount === 1 && parts.length > 8) return false;
		return parts.every((p) => p === "DOUBLE" || /^[0-9a-fA-F]{1,4}$/.test(p));
	}

	private isValidCIDR(subnet: number, isIPv6: boolean): boolean {
		return (
			Number.isInteger(subnet) && subnet >= 0 && subnet <= (isIPv6 ? 128 : 32)
		);
	}

	private parseACL(): VCLACL {
		// We've already consumed the 'acl' keyword
		const nameToken = this.consume(TokenType.IDENTIFIER, "Expected ACL name");

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
				let ip = ipToken.value;

				// Remove quotes
				if (ip.startsWith('"') && ip.endsWith('"')) {
					ip = ip.slice(1, -1);
				} else if (ip.startsWith("'") && ip.endsWith("'")) {
					ip = ip.slice(1, -1);
				}

				let subnet: number | undefined;

				// Check for CIDR notation inside the string
				if (ip.includes("/")) {
					const parts = ip.split("/");
					ip = parts[0];
					subnet = parseInt(parts[1], 10);
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
		if ((module.startsWith('"') && module.endsWith('"')) ||
			(module.startsWith("'") && module.endsWith("'"))) {
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
		const nameToken = this.consume(TokenType.IDENTIFIER, "Expected table name");
		let valueType: string | undefined;
		if (this.check(TokenType.IDENTIFIER)) {
			valueType = this.advance().value;
		}
		this.consume(TokenType.PUNCTUATION, "Expected '{' after table name");

		const entries: VCLTableEntry[] = [];
		while (!this.check(TokenType.PUNCTUATION, "}") && !this.isAtEnd()) {
			if (this.match(TokenType.STRING)) {
				const keyToken = this.previous();
				let key = keyToken.value;
				if ((key.startsWith('"') && key.endsWith('"')) ||
					(key.startsWith("'") && key.endsWith("'"))) {
					key = key.slice(1, -1);
				}
				this.consume(TokenType.PUNCTUATION, "Expected ':' after table key");
				let value = "";
				if (this.match(TokenType.STRING)) {
					value = this.previous().value;
					if ((value.startsWith('"') && value.endsWith('"')) ||
						(value.startsWith("'") && value.endsWith("'"))) {
						value = value.slice(1, -1);
					}
				} else if (this.match(TokenType.NUMBER)) {
					value = this.previous().value;
				} else if (this.match(TokenType.IDENTIFIER)) {
					value = this.previous().value;
				}
				if (this.check(TokenType.PUNCTUATION, ",")) {
					this.advance();
				}
				entries.push({ key, value });
			} else {
				this.advance();
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
		const nameToken = this.consume(TokenType.IDENTIFIER, "Expected backend name");
		this.consume(TokenType.PUNCTUATION, "Expected '{' after backend name");

		const properties: VCLBackendProperty[] = [];
		while (!this.check(TokenType.PUNCTUATION, "}") && !this.isAtEnd()) {
			if (this.match(TokenType.PUNCTUATION, ".")) {
				const propName = this.consume(TokenType.IDENTIFIER, "Expected property name").value;
				this.consume(TokenType.OPERATOR, "Expected '=' after property name");
				let value: string | number = "";
				if (this.match(TokenType.STRING)) {
					value = this.previous().value;
					if ((value.startsWith('"') && value.endsWith('"')) ||
						(value.startsWith("'") && value.endsWith("'"))) {
						value = (value as string).slice(1, -1);
					}
				} else if (this.match(TokenType.NUMBER)) {
					value = parseFloat(this.previous().value);
				} else if (this.match(TokenType.IDENTIFIER)) {
					value = this.previous().value;
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
		const nameToken = this.consume(
			TokenType.IDENTIFIER,
			"Expected subroutine name",
		);
		let returnType: string | undefined;
		if (
			this.check(TokenType.IDENTIFIER) &&
			!this.check(TokenType.PUNCTUATION, "{")
		) {
			returnType = this.advance().value;
		}
		this.consume(TokenType.PUNCTUATION, "Expected '{' after subroutine name");
		const startPos = this.tokens[this.current - 1].position + 1;
		const body: VCLStatement[] = [];
		while (!this.check(TokenType.PUNCTUATION, "}") && !this.isAtEnd()) {
			body.push(this.parseStatement());
		}
		const endPos = this.tokens[this.current].position;
		const rawVCL = this.source.substring(startPos, endPos);
		this.consume(TokenType.PUNCTUATION, "Expected '}' after subroutine body");
		return {
			type: "Subroutine",
			name: nameToken.value,
			body,
			raw: rawVCL,
			returnType,
			location: { line: nameToken.line, column: nameToken.column },
		};
	}

	private parseStatement(): VCLStatement {
		// Check for label (identifier followed by colon)
		if (this.check(TokenType.IDENTIFIER)) {
			const nextToken = this.peek(1);
			if (
				nextToken?.type === TokenType.PUNCTUATION &&
				nextToken.value === ":"
			) {
				const labelName = this.advance().value;
				const labelToken = this.previous();
				this.advance();
				let statement: VCLStatement | null = null;
				if (this.check(TokenType.KEYWORD, "set")) {
					this.advance();
					statement = this.parseSetStatement();
				}
				return {
					type: "LabelStatement",
					name: labelName,
					statement,
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
				case "synthetic":
					return this.parseSyntheticStatement();
				case "declare":
					return this.parseDeclareStatement();
				case "goto":
					return this.parseGotoStatement();
				case "restart":
					return this.parseRestartStatement();
			}
		} else if (this.match(TokenType.IDENTIFIER)) {
			const identifier = this.previous().value;
			const token = this.previous();

			if (identifier === "declare") {
				return this.parseDeclareStatement();
			} else if (identifier === "std.log" || identifier.startsWith("std.log")) {
				if (this.check(TokenType.PUNCTUATION, "(")) {
					return this.parseLogStatement();
				}
				const message = {
					type: "StringLiteral",
					value: "Log message",
					location: { line: token.line, column: token.column },
				};
				while (!this.check(TokenType.PUNCTUATION, ";") && !this.isAtEnd())
					this.advance();
				this.consume(TokenType.PUNCTUATION, "Expected ';' after log statement");
				return {
					type: "LogStatement",
					message,
					location: { line: token.line, column: token.column },
				};
			} else if (identifier === "hash_data") {
				return this.parseHashDataStatement();
			} else if (
				identifier.includes(".") &&
				this.check(TokenType.OPERATOR, "=")
			) {
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
			}
		}

		while (!this.check(TokenType.PUNCTUATION, ";") && !this.isAtEnd())
			this.advance();
		if (!this.isAtEnd()) this.advance();
		return {
			type: "Statement",
			location: { line: this.previous().line, column: this.previous().column },
		};
	}

	private parseDeclareStatement(): VCLStatement {
		const token = this.previous();

		// Check for 'local' keyword
		if (this.match(TokenType.IDENTIFIER) && this.previous().value === "local") {
			// Found 'local' keyword
		}

		// Parse the variable name
		if (!this.match(TokenType.IDENTIFIER)) {
			this.error("Expected variable name after 'declare local'");
		}

		const variableName = this.previous().value;
		if (!this.match(TokenType.IDENTIFIER))
			this.error("Expected variable type after variable name");
		const variableType = this.previous().value;
		this.consume(TokenType.PUNCTUATION, "Expected ';' after declare statement");
		return {
			type: "DeclareStatement",
			variableName,
			variableType,
			location: { line: token.line, column: token.column },
		};
	}

	private parseStatementBlock(requireBraces: boolean = false): VCLStatement[] {
		const statements: VCLStatement[] = [];
		const hasBraces = this.match(TokenType.PUNCTUATION, "{");
		if (requireBraces && !hasBraces)
			this.consume(TokenType.PUNCTUATION, "Expected '{'");
		while (
			(!hasBraces || !this.check(TokenType.PUNCTUATION, "}")) &&
			!this.check(TokenType.KEYWORD, "else") &&
			!this.isAtEnd()
		) {
			statements.push(this.parseStatement());
		}
		if (hasBraces)
			this.consume(TokenType.PUNCTUATION, "Expected '}' after block");
		return statements;
	}

	private parseElseClause(): VCLStatement[] | undefined {
		while (this.check(TokenType.COMMENT)) this.advance();
		if (!this.check(TokenType.KEYWORD) || this.peek().value !== "else")
			return undefined;
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
			this.consume(
				TokenType.PUNCTUATION,
				"Expected ';' after return statement",
			);
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
	 * Parses an error statement
	 * Supports: error 401; or error 401 "message";
	 *
	 * @returns The parsed error statement
	 */
	private parseErrorStatement(): VCLErrorStatement {
		const token = this.previous();

		// Parse the error status code
		const status = parseInt(
			this.consume(TokenType.NUMBER, "Expected error status code").value,
			10,
		);

		// Parse the optional error message
		let message = "";
		if (this.check(TokenType.STRING)) {
			message = this.advance().value.slice(1, -1); // Remove quotes
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
		while (
			this.check(TokenType.IDENTIFIER) &&
			this.peek().value.startsWith(".")
		) {
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
		];
		let operator = "=";

		if (this.check(TokenType.OPERATOR)) {
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
		const target = this.consume(
			TokenType.IDENTIFIER,
			"Expected unset target",
		).value;

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
	private parseSyntheticStatement(): VCLSyntheticStatement {
		const token = this.previous();

		// In VCL, synthetic statements can have different formats:
		// 1. synthetic "simple string";
		// 2. synthetic {"multi-line string"};

		let content = "";

		// Check if the next token is a string
		if (this.match(TokenType.STRING)) {
			content = this.previous().value;

			// Remove quotes
			if (content.startsWith('"') && content.endsWith('"')) {
				content = content.slice(1, -1);
			}
		}
		// Check if the next token is an opening brace
		else if (this.match(TokenType.PUNCTUATION, "{")) {
			// Collect tokens until we find a closing brace
			let braceCount = 1;
			let syntheticContent = "";

			while (braceCount > 0 && !this.isAtEnd()) {
				if (this.match(TokenType.PUNCTUATION, "{")) {
					braceCount++;
					syntheticContent += "{";
				} else if (this.match(TokenType.PUNCTUATION, "}")) {
					braceCount--;
					if (braceCount > 0) {
						syntheticContent += "}";
					}
				} else {
					syntheticContent += `${this.advance().value} `;
				}
			}

			content = syntheticContent.trim();
		} else {
			throw new Error(
				`Expected string or '{' after synthetic at line ${this.peek().line}, column ${this.peek().column}`,
			);
		}

		// Consume the semicolon
		this.consume(
			TokenType.PUNCTUATION,
			"Expected ';' after synthetic statement",
		);

		return {
			type: "SyntheticStatement",
			content,
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
		this.consume(
			TokenType.PUNCTUATION,
			"Expected ';' after hash_data statement",
		);

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
		const labelToken = this.consume(
			TokenType.IDENTIFIER,
			"Expected label name after 'goto'",
		);
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

	private parseExpression(): VCLExpression {
		return this.parseTernary();
	}

	private parseTernary(): VCLExpression {
		const expr = this.parseLogicalOr();

		// Check for ternary operator: condition ? trueExpr : falseExpr
		if (
			this.match(TokenType.PUNCTUATION, "?") ||
			(this.match(TokenType.KEYWORD) && this.previous().value === "if")
		) {
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
					this.consume(
						TokenType.PUNCTUATION,
						"Expected ')' after ternary expression",
					);

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

		while (
			this.match(TokenType.OPERATOR, "==") ||
			this.match(TokenType.OPERATOR, "!=")
		) {
			const operator = this.previous().value;
			const right = this.parseComparison();

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

		while (
			this.match(TokenType.OPERATOR, "~") ||
			this.match(TokenType.OPERATOR, "!~")
		) {
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

		while (
			this.match(TokenType.OPERATOR, "+") ||
			this.match(TokenType.OPERATOR, "-")
		) {
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
					"goto",
					"restart",
					"synthetic",
					"declare",
					"call",
					"log",
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
			if (
				nextToken &&
				nextToken.type === TokenType.PUNCTUATION &&
				nextToken.value === "("
			) {
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

			// Remove quotes
			let value = token.value;
			if (value.startsWith('"') && value.endsWith('"')) {
				value = value.slice(1, -1);
			} else if (value.startsWith("'") && value.endsWith("'")) {
				value = value.slice(1, -1);
			}

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
			const token = this.previous();

			return {
				type: "NumberLiteral",
				value: parseFloat(token.value),
				location: {
					line: token.line,
					column: token.column,
				},
			};
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
			while (
				this.check(TokenType.IDENTIFIER) &&
				this.peek().value.startsWith(".")
			) {
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

		if (this.match(TokenType.KEYWORD, "true")) {
			const token = this.previous();
			return {
				type: "StringLiteral", // Using StringLiteral for booleans
				value: "true",
				location: {
					line: token.line,
					column: token.column,
				},
			};
		}

		if (this.match(TokenType.KEYWORD, "false")) {
			const token = this.previous();
			return {
				type: "StringLiteral", // Using StringLiteral for booleans
				value: "false",
				location: {
					line: token.line,
					column: token.column,
				},
			};
		}

		// Handle if() function call (ternary-like expression)
		// e.g., if(condition, true_value, false_value)
		if (this.check(TokenType.KEYWORD, "if") && this.peek(1)?.value === "(") {
			const token = this.advance(); // consume 'if'
			this.advance(); // consume '('

			// Parse condition
			const condition = this.parseExpression();

			// Consume comma
			this.consume(
				TokenType.PUNCTUATION,
				"Expected ',' after condition in if()",
			);

			// Parse true expression
			const trueExpr = this.parseExpression();

			// Consume comma
			this.consume(
				TokenType.PUNCTUATION,
				"Expected ',' after true expression in if()",
			);

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
		if (
			this.match(TokenType.OPERATOR, "!") ||
			this.match(TokenType.OPERATOR, "-")
		) {
			const token = this.previous();
			const operator = token.value;
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

		// If we can't parse a valid expression, return an empty identifier
		// Default to an empty identifier
		return {
			type: "Identifier",
			name: "",
			location: {
				line: this.peek().line,
				column: this.peek().column,
			},
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

		throw new Error(
			`${message} at line ${this.peek().line}, column ${this.peek().column}`,
		);
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
			return this.tokens[this.current];
		}

		const index = this.current + offset;
		if (index < 0) {
			return this.tokens[0];
		}
		if (index >= this.tokens.length) {
			return this.tokens[this.tokens.length - 1];
		}
		return this.tokens[index];
	}

	private previous(): Token {
		return this.tokens[this.current - 1];
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
		this.consume(
			TokenType.PUNCTUATION,
			"Expected ')' after function arguments",
		);

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
			const propertyToken = this.consume(
				TokenType.IDENTIFIER,
				"Expected property name after '.'",
			);

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
