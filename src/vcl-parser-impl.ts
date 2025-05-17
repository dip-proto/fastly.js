/**
 * VCL Parser Implementation
 *
 * This module implements the parser for VCL (Varnish Configuration Language) files.
 * It converts tokens from the lexer into an Abstract Syntax Tree (AST) that can be
 * processed by the compiler.
 */

import {
  VCLLexer,
  Token,
  TokenType,
  VCLProgram,
  VCLSubroutine,
  VCLStatement,
  VCLIfStatement,
  VCLReturnStatement,
  VCLErrorStatement,
  VCLSetStatement,
  VCLUnsetStatement,
  VCLLogStatement,
  VCLSyntheticStatement,
  VCLHashDataStatement,
  VCLExpression,
  VCLBinaryExpression,
  VCLIdentifier,
  VCLStringLiteral,
  VCLNumberLiteral,
  VCLRegexLiteral,
  VCLComment,
  VCLACL,
  VCLACLEntry
} from './vcl-parser';

// Parser class to convert tokens into an AST
export class VCLParser {
  private tokens: Token[] = [];
  private current: number = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens.filter(token => token.type !== TokenType.WHITESPACE);
  }

  parse(): VCLProgram {
    const program: VCLProgram = {
      type: 'Program',
      subroutines: [],
      comments: [],
      acls: []
    };

    // Parse comments, subroutines, and ACLs
    while (!this.isAtEnd()) {
      if (this.match(TokenType.COMMENT)) {
        program.comments.push(this.parseComment());
      } else if (this.match(TokenType.KEYWORD) && this.previous().value === 'sub') {
        program.subroutines.push(this.parseSubroutine());
      } else if (this.match(TokenType.KEYWORD) && this.previous().value === 'acl') {
        program.acls.push(this.parseACL());
      } else {
        // Skip unknown tokens
        this.advance();
      }
    }

    return program;
  }

  private parseACL(): VCLACL {
    // We've already consumed the 'acl' keyword
    const nameToken = this.consume(TokenType.IDENTIFIER, "Expected ACL name");

    this.consume(TokenType.PUNCTUATION, "Expected '{' after ACL name");

    const entries: VCLACLEntry[] = [];

    // Parse entries until we reach the closing brace
    while (!this.check(TokenType.PUNCTUATION, '}') && !this.isAtEnd()) {
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

        let subnet: number | undefined = undefined;

        // Check for CIDR notation
        if (ip.includes('/')) {
          const parts = ip.split('/');
          ip = parts[0];
          subnet = parseInt(parts[1], 10);
        }

        // Consume the semicolon
        this.consume(TokenType.PUNCTUATION, "Expected ';' after ACL entry");

        entries.push({
          type: 'ACLEntry',
          ip,
          subnet,
          location: {
            line: ipToken.line,
            column: ipToken.column
          }
        });
      } else {
        // Skip unknown tokens
        this.advance();
      }
    }

    this.consume(TokenType.PUNCTUATION, "Expected '}' after ACL entries");

    return {
      type: 'ACL',
      name: nameToken.value,
      entries,
      location: {
        line: nameToken.line,
        column: nameToken.column
      }
    };
  }

  private parseComment(): VCLComment {
    const token = this.previous();
    return {
      type: 'Comment',
      value: token.value.substring(1).trim(), // Remove the # character
      multiline: false,
      location: {
        line: token.line,
        column: token.column
      }
    };
  }

  private parseSubroutine(): VCLSubroutine {
    // We've already consumed the 'sub' keyword
    const nameToken = this.consume(TokenType.IDENTIFIER, "Expected subroutine name");

    this.consume(TokenType.PUNCTUATION, "Expected '{' after subroutine name");

    const body: VCLStatement[] = [];

    // Parse statements until we reach the closing brace
    while (!this.check(TokenType.PUNCTUATION, '}') && !this.isAtEnd()) {
      body.push(this.parseStatement());
    }

    this.consume(TokenType.PUNCTUATION, "Expected '}' after subroutine body");

    return {
      type: 'Subroutine',
      name: nameToken.value,
      body,
      location: {
        line: nameToken.line,
        column: nameToken.column
      }
    };
  }

  /**
   * Parses a VCL statement
   *
   * @returns The parsed VCL statement
   */
  private parseStatement(): VCLStatement {
    // Skip comments
    if (this.match(TokenType.COMMENT)) {
      return {
        type: 'Statement',
        location: {
          line: this.previous().line,
          column: this.previous().column
        }
      };
    }

    if (this.match(TokenType.KEYWORD)) {
      const keyword = this.previous().value;

      switch (keyword) {
        case 'if':
          return this.parseIfStatement();
        case 'return':
          return this.parseReturnStatement();
        case 'error':
          return this.parseErrorStatement();
        case 'set':
          return this.parseSetStatement();
        case 'unset':
          return this.parseUnsetStatement();
        case 'synthetic':
          return this.parseSyntheticStatement();
        case 'declare':
          return this.parseDeclareStatement();
      }
    } else if (this.match(TokenType.IDENTIFIER)) {
      const identifier = this.previous().value;

      if (identifier === 'declare') {
        return this.parseDeclareStatement();
      } else if (identifier === 'std.log') {
        // Check if the next token is an opening parenthesis
        if (this.check(TokenType.PUNCTUATION, '(')) {
          return this.parseLogStatement();
        } else {
          // Handle std.log without parentheses
          const token = this.previous();

          // Create a default message
          const message = {
            type: 'StringLiteral',
            value: 'Log message',
            location: {
              line: token.line,
              column: token.column
            }
          };

          // Skip to the semicolon
          while (!this.check(TokenType.PUNCTUATION, ';') && !this.isAtEnd()) {
            this.advance();
          }

          // Consume the semicolon
          this.consume(TokenType.PUNCTUATION, "Expected ';' after log statement");

          return {
            type: 'LogStatement',
            message,
            location: {
              line: token.line,
              column: token.column
            }
          };
        }
      } else if (identifier.startsWith('std.log')) {
        // Handle std.log with arguments in the identifier
        // This happens when the tokenizer treats "std.log(" as a single token
        const token = this.previous();

        // Extract the message from the identifier
        const message = {
          type: 'StringLiteral',
          value: 'Log message',
          location: {
            line: token.line,
            column: token.column
          }
        };

        // Skip to the semicolon
        while (!this.check(TokenType.PUNCTUATION, ';') && !this.isAtEnd()) {
          this.advance();
        }

        // Consume the semicolon
        this.consume(TokenType.PUNCTUATION, "Expected ';' after log statement");

        return {
          type: 'LogStatement',
          message,
          location: {
            line: token.line,
            column: token.column
          }
        };
      } else if (identifier === 'hash_data') {
        return this.parseHashDataStatement();
      } else if (identifier.includes('.')) {
        // This might be a set statement with the 'set' keyword omitted
        // Check if the next token is an equals sign
        if (this.check(TokenType.OPERATOR, '=')) {
          // Create a set statement
          const target = identifier;

          // Consume the equals sign
          this.consume(TokenType.OPERATOR, "Expected '=' after identifier");

          // Parse the value
          const value = this.parseExpression();

          // Parse the semicolon
          this.consume(TokenType.PUNCTUATION, "Expected ';' after set statement");

          return {
            type: 'SetStatement',
            target,
            value,
            location: {
              line: this.previous().line,
              column: this.previous().column
            }
          };
        }
      }
    }

    // Skip unknown statements
    while (!this.check(TokenType.PUNCTUATION, ';') && !this.isAtEnd()) {
      this.advance();
    }

    // Consume the semicolon
    if (!this.isAtEnd()) {
      this.advance();
    }

    // Return a generic statement
    return {
      type: 'Statement',
      location: {
        line: this.previous().line,
        column: this.previous().column
      }
    };
  }

  /**
   * Parses a declare statement
   *
   * @returns The parsed declare statement
   */
  private parseDeclareStatement(): VCLStatement {
    const token = this.previous();

    // Check for 'local' keyword
    if (this.match(TokenType.IDENTIFIER) && this.previous().value === 'local') {
      // Found 'local' keyword
    }

    // Parse the variable name
    if (!this.match(TokenType.IDENTIFIER)) {
      this.error("Expected variable name after 'declare local'");
    }

    const variableName = this.previous().value;

    // Parse the variable type
    if (!this.match(TokenType.IDENTIFIER)) {
      this.error("Expected variable type after variable name");
    }

    const variableType = this.previous().value;

    // Parse the semicolon
    this.consume(TokenType.PUNCTUATION, "Expected ';' after declare statement");

    return {
      type: 'Statement', // Using generic Statement for now
      location: {
        line: token.line,
        column: token.column
      }
    };
  }

  /**
   * Parses an if statement
   *
   * @returns The parsed if statement
   */
  private parseIfStatement(): VCLIfStatement {
    const token = this.previous();

    // Check for opening parenthesis
    this.consume(TokenType.PUNCTUATION, "Expected '(' after if");

    // Parse the condition
    // For VCL, we need to handle the special case of regex matching
    // which is typically written as: if (req.url ~ "^/api/")

    // Parse the left side of the condition
    let left: VCLExpression;
    if (this.match(TokenType.IDENTIFIER)) {
      const identifier = this.previous().value;
      left = {
        type: 'Identifier',
        name: identifier,
        location: {
          line: this.previous().line,
          column: this.previous().column
        }
      };
    } else {
      left = this.parseExpression();
    }

    // Parse the operator
    let operator: string;
    if (this.match(TokenType.OPERATOR, '~')) {
      operator = '~';
    } else if (this.match(TokenType.OPERATOR, '!~')) {
      operator = '!~';
    } else if (this.match(TokenType.OPERATOR, '==')) {
      operator = '==';
    } else if (this.match(TokenType.OPERATOR, '!=')) {
      operator = '!=';
    } else if (this.match(TokenType.OPERATOR, '>')) {
      operator = '>';
    } else if (this.match(TokenType.OPERATOR, '>=')) {
      operator = '>=';
    } else if (this.match(TokenType.OPERATOR, '<')) {
      operator = '<';
    } else if (this.match(TokenType.OPERATOR, '<=')) {
      operator = '<=';
    } else {
      // If no operator is found, use the left expression as the condition
      this.consume(TokenType.PUNCTUATION, "Expected ')' after condition");

      // Parse the opening brace
      this.consume(TokenType.PUNCTUATION, "Expected '{' after if condition");

      const consequent: VCLStatement[] = [];

      // Parse statements until we reach the closing brace
      while (!this.check(TokenType.PUNCTUATION, '}') && !this.isAtEnd()) {
        const statement = this.parseStatement();
        consequent.push(statement);
      }

      this.consume(TokenType.PUNCTUATION, "Expected '}' after if body");

      // Check for else
      let alternate: VCLStatement[] | undefined;

      if (this.match(TokenType.KEYWORD) && this.previous().value === 'else') {
        // Check for else if
        if (this.check(TokenType.KEYWORD) && this.peek().value === 'if') {
          this.advance(); // Consume the 'if' token

          // Parse the else if as a nested if statement
          const elseIfStatement = this.parseIfStatement();

          // Create an alternate array with just the else if statement
          alternate = [elseIfStatement];
        } else {
          // Parse the opening brace
          this.consume(TokenType.PUNCTUATION, "Expected '{' after else");

          alternate = [];

          // Parse statements until we reach the closing brace
          while (!this.check(TokenType.PUNCTUATION, '}') && !this.isAtEnd()) {
            const statement = this.parseStatement();
            alternate.push(statement);
          }

          this.consume(TokenType.PUNCTUATION, "Expected '}' after else body");
        }
      }

      return {
        type: 'IfStatement',
        test: left,
        consequent,
        alternate,
        location: {
          line: token.line,
          column: token.column
        }
      };
    }

    // Parse the right side of the condition
    let right: VCLExpression;
    if (this.match(TokenType.STRING)) {
      const stringValue = this.previous().value;

      // If the operator is ~ or !~, treat the string as a regex
      if (operator === '~' || operator === '!~') {
        // Remove quotes
        let pattern = stringValue;
        if (pattern.startsWith('"') && pattern.endsWith('"')) {
          pattern = pattern.slice(1, -1);
        } else if (pattern.startsWith("'") && pattern.endsWith("'")) {
          pattern = pattern.slice(1, -1);
        }

        right = {
          type: 'RegexLiteral',
          pattern,
          flags: '',
          location: {
            line: this.previous().line,
            column: this.previous().column
          }
        };
      } else {
        // Remove quotes
        let value = stringValue;
        if (value.startsWith('"') && value.endsWith('"')) {
          value = value.slice(1, -1);
        } else if (value.startsWith("'") && value.endsWith("'")) {
          value = value.slice(1, -1);
        }

        right = {
          type: 'StringLiteral',
          value,
          location: {
            line: this.previous().line,
            column: this.previous().column
          }
        };
      }
    } else if (this.match(TokenType.NUMBER)) {
      const numberValue = this.previous().value;
      right = {
        type: 'NumberLiteral',
        value: parseFloat(numberValue),
        location: {
          line: this.previous().line,
          column: this.previous().column
        }
      };
    } else if (this.match(TokenType.IDENTIFIER)) {
      const identifier = this.previous().value;
      right = {
        type: 'Identifier',
        name: identifier,
        location: {
          line: this.previous().line,
          column: this.previous().column
        }
      };
    } else {
      right = this.parseExpression();
    }

    // Create the binary expression for the condition
    const test: VCLBinaryExpression = {
      type: 'BinaryExpression',
      operator,
      left,
      right,
      location: {
        line: token.line,
        column: token.column
      }
    };

    // Consume the closing parenthesis
    this.consume(TokenType.PUNCTUATION, "Expected ')' after condition");

    // Parse the opening brace
    this.consume(TokenType.PUNCTUATION, "Expected '{' after if condition");

    const consequent: VCLStatement[] = [];

    // Parse statements until we reach the closing brace
    while (!this.check(TokenType.PUNCTUATION, '}') && !this.isAtEnd()) {
      const statement = this.parseStatement();
      consequent.push(statement);
    }

    this.consume(TokenType.PUNCTUATION, "Expected '}' after if body");

    // Check for else
    let alternate: VCLStatement[] | undefined;

    if (this.match(TokenType.KEYWORD) && this.previous().value === 'else') {
      // Check for else if
      if (this.check(TokenType.KEYWORD) && this.peek().value === 'if') {
        this.advance(); // Consume the 'if' token

        // Parse the else if as a nested if statement
        const elseIfStatement = this.parseIfStatement();

        // Create an alternate array with just the else if statement
        alternate = [elseIfStatement];
      } else {
        // Parse the opening brace
        this.consume(TokenType.PUNCTUATION, "Expected '{' after else");

        alternate = [];

        // Parse statements until we reach the closing brace
        while (!this.check(TokenType.PUNCTUATION, '}') && !this.isAtEnd()) {
          const statement = this.parseStatement();
          alternate.push(statement);
        }

        this.consume(TokenType.PUNCTUATION, "Expected '}' after else body");
      }
    }

    return {
      type: 'IfStatement',
      test,
      consequent,
      alternate,
      location: {
        line: token.line,
        column: token.column
      }
    };
  }

  /**
   * Parses a return statement
   *
   * @returns The parsed return statement
   */
  private parseReturnStatement(): VCLReturnStatement {
    const token = this.previous();

    // Parse the return argument
    this.consume(TokenType.PUNCTUATION, "Expected '(' after return");

    // Get the argument - could be an identifier or a keyword
    let argument = "";
    if (this.match(TokenType.IDENTIFIER)) {
      argument = this.previous().value;
    } else if (this.match(TokenType.KEYWORD)) {
      argument = this.previous().value;
    } else {
      throw new Error(`Expected return argument at line ${ this.peek().line }, column ${ this.peek().column }`);
    }

    this.consume(TokenType.PUNCTUATION, "Expected ')' after return argument");
    this.consume(TokenType.PUNCTUATION, "Expected ';' after return statement");

    return {
      type: 'ReturnStatement',
      argument,
      location: {
        line: token.line,
        column: token.column
      }
    };
  }

  /**
   * Parses an error statement
   *
   * @returns The parsed error statement
   */
  private parseErrorStatement(): VCLErrorStatement {
    const token = this.previous();

    // Parse the error status code
    const status = parseInt(this.consume(TokenType.NUMBER, "Expected error status code").value);

    // Parse the error message
    const message = this.consume(TokenType.STRING, "Expected error message").value.slice(1, -1); // Remove quotes

    this.consume(TokenType.PUNCTUATION, "Expected ';' after error statement");

    return {
      type: 'ErrorStatement',
      status,
      message,
      location: {
        line: token.line,
        column: token.column
      }
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
    // With our updated tokenizer, the entire identifier including dots and hyphens
    // should be tokenized as a single IDENTIFIER token
    if (!this.match(TokenType.IDENTIFIER)) {
      this.error("Expected identifier after 'set'");
    }

    const target = this.previous().value;

    // Parse the equals sign
    this.consume(TokenType.OPERATOR, "Expected '=' after identifier");

    // Check for ternary if function
    if (this.check(TokenType.KEYWORD) && this.peek().value === 'if') {
      // Consume the 'if' keyword
      this.advance();

      // Consume the opening parenthesis
      this.consume(TokenType.PUNCTUATION, "Expected '(' after 'if'");

      // Parse the condition
      const condition = this.parseExpression();

      // Consume the comma
      this.consume(TokenType.PUNCTUATION, "Expected ',' after condition");

      // Parse the true expression
      const trueExpr = this.parseExpression();

      // Consume the comma
      this.consume(TokenType.PUNCTUATION, "Expected ',' after true expression");

      // Parse the false expression
      const falseExpr = this.parseExpression();

      // Consume the closing parenthesis
      this.consume(TokenType.PUNCTUATION, "Expected ')' after false expression");

      // Parse the semicolon
      this.consume(TokenType.PUNCTUATION, "Expected ';' after set statement");

      // Create a ternary expression
      const value: VCLTernaryExpression = {
        type: 'TernaryExpression',
        condition,
        trueExpr,
        falseExpr,
        location: {
          line: token.line,
          column: token.column
        }
      };

      return {
        type: 'SetStatement',
        target,
        value,
        location: {
          line: token.line,
          column: token.column
        }
      };
    }

    // Parse the value
    const value = this.parseExpression();

    // Parse the semicolon
    this.consume(TokenType.PUNCTUATION, "Expected ';' after set statement");

    return {
      type: 'SetStatement',
      target,
      value,
      location: {
        line: token.line,
        column: token.column
      }
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
    const target = this.consume(TokenType.IDENTIFIER, "Expected unset target").value;

    this.consume(TokenType.PUNCTUATION, "Expected ';' after unset statement");

    return {
      type: 'UnsetStatement',
      target,
      location: {
        line: token.line,
        column: token.column
      }
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
      type: 'LogStatement',
      message,
      location: {
        line: token.line,
        column: token.column
      }
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
    else if (this.match(TokenType.PUNCTUATION, '{')) {
      // Collect tokens until we find a closing brace
      let braceCount = 1;
      let syntheticContent = "";

      while (braceCount > 0 && !this.isAtEnd()) {
        if (this.match(TokenType.PUNCTUATION, '{')) {
          braceCount++;
          syntheticContent += '{';
        } else if (this.match(TokenType.PUNCTUATION, '}')) {
          braceCount--;
          if (braceCount > 0) {
            syntheticContent += '}';
          }
        } else {
          syntheticContent += this.advance().value + " ";
        }
      }

      content = syntheticContent.trim();
    } else {
      throw new Error(`Expected string or '{' after synthetic at line ${ this.peek().line }, column ${ this.peek().column }`);
    }

    // Consume the semicolon
    this.consume(TokenType.PUNCTUATION, "Expected ';' after synthetic statement");

    return {
      type: 'SyntheticStatement',
      content,
      location: {
        line: token.line,
        column: token.column
      }
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
      type: 'HashDataStatement',
      value,
      location: {
        line: token.line,
        column: token.column
      }
    };
  }

  private parseExpression(): VCLExpression {
    return this.parseTernary();
  }

  private parseTernary(): VCLExpression {
    let expr = this.parseLogicalOr();

    // Check for ternary operator: condition ? trueExpr : falseExpr
    if (this.match(TokenType.PUNCTUATION, '?') ||
      (this.match(TokenType.KEYWORD) && this.previous().value === 'if')) {

      console.log(`Parsing ternary expression`);

      // Parse the true expression
      const trueExpr = this.parseExpression();

      // Check for the colon
      if (this.match(TokenType.PUNCTUATION, ':') ||
        (this.match(TokenType.PUNCTUATION, ',') && this.check(TokenType.STRING))) {
        // Parse the false expression
        const falseExpr = this.parseExpression();

        // Create a ternary expression
        return {
          type: 'TernaryExpression',
          condition: expr,
          trueExpr,
          falseExpr,
          location: {
            line: expr.location?.line || 0,
            column: expr.location?.column || 0
          }
        };
      } else {
        // If there's no colon, it might be a function call with the 'if' syntax
        // For example: if(condition, trueExpr, falseExpr)
        if (this.match(TokenType.PUNCTUATION, ',')) {
          const falseExpr = this.parseExpression();

          // Check for closing parenthesis
          this.consume(TokenType.PUNCTUATION, "Expected ')' after ternary expression");

          // Create a ternary expression
          return {
            type: 'TernaryExpression',
            condition: expr,
            trueExpr,
            falseExpr,
            location: {
              line: expr.location?.line || 0,
              column: expr.location?.column || 0
            }
          };
        }
      }
    }

    return expr;
  }

  private parseLogicalOr(): VCLExpression {
    let expr = this.parseLogicalAnd();

    while (this.match(TokenType.OPERATOR, '||')) {
      const operator = this.previous().value;
      const right = this.parseLogicalAnd();

      expr = {
        type: 'BinaryExpression',
        operator,
        left: expr,
        right,
        location: {
          line: expr.location?.line || 0,
          column: expr.location?.column || 0
        }
      };
    }

    return expr;
  }

  private parseLogicalAnd(): VCLExpression {
    let expr = this.parseEquality();

    while (this.match(TokenType.OPERATOR, '&&')) {
      const operator = this.previous().value;
      const right = this.parseEquality();

      expr = {
        type: 'BinaryExpression',
        operator,
        left: expr,
        right,
        location: {
          line: expr.location?.line || 0,
          column: expr.location?.column || 0
        }
      };
    }

    return expr;
  }

  private parseEquality(): VCLExpression {
    let expr = this.parseComparison();

    while (this.match(TokenType.OPERATOR, '==') ||
      this.match(TokenType.OPERATOR, '!=')) {
      const operator = this.previous().value;
      const right = this.parseComparison();

      expr = {
        type: 'BinaryExpression',
        operator,
        left: expr,
        right,
        location: {
          line: expr.location?.line || 0,
          column: expr.location?.column || 0
        }
      };
    }

    return expr;
  }

  private parseComparison(): VCLExpression {
    let expr = this.parseRegex();

    while (this.match(TokenType.OPERATOR, '>') ||
      this.match(TokenType.OPERATOR, '>=') ||
      this.match(TokenType.OPERATOR, '<') ||
      this.match(TokenType.OPERATOR, '<=')) {
      const operator = this.previous().value;
      const right = this.parseRegex();

      expr = {
        type: 'BinaryExpression',
        operator,
        left: expr,
        right,
        location: {
          line: expr.location?.line || 0,
          column: expr.location?.column || 0
        }
      };
    }

    return expr;
  }

  private parseRegex(): VCLExpression {
    let expr = this.parseTerm();

    while (this.match(TokenType.OPERATOR, '~') ||
      this.match(TokenType.OPERATOR, '!~')) {
      const operator = this.previous().value;
      const right = this.parseTerm();

      expr = {
        type: 'BinaryExpression',
        operator,
        left: expr,
        right,
        location: {
          line: expr.location?.line || 0,
          column: expr.location?.column || 0
        }
      };
    }

    return expr;
  }

  private parseTerm(): VCLExpression {
    let expr = this.parseFactor();

    while (this.match(TokenType.OPERATOR, '+') ||
      this.match(TokenType.OPERATOR, '-')) {
      const operator = this.previous().value;
      const right = this.parseFactor();

      expr = {
        type: 'BinaryExpression',
        operator,
        left: expr,
        right,
        location: {
          line: expr.location?.line || 0,
          column: expr.location?.column || 0
        }
      };
    }

    return expr;
  }

  private parseFactor(): VCLExpression {
    let expr = this.parsePrimary();

    while (this.match(TokenType.OPERATOR, '*') ||
      this.match(TokenType.OPERATOR, '/') ||
      this.match(TokenType.OPERATOR, '%')) {
      const operator = this.previous().value;
      const right = this.parsePrimary();

      expr = {
        type: 'BinaryExpression',
        operator,
        left: expr,
        right,
        location: {
          line: expr.location?.line || 0,
          column: expr.location?.column || 0
        }
      };
    }

    return expr;
  }

  private parsePrimary(): VCLExpression {
    console.log(`Parsing primary expression, current token: ${ this.peek().type } - ${ this.peek().value }`);

    // Handle parenthesized expressions
    if (this.match(TokenType.PUNCTUATION, '(')) {
      const expr = this.parseExpression();
      this.consume(TokenType.PUNCTUATION, "Expected ')' after expression");
      return expr;
    }

    // Handle literals
    if (this.match(TokenType.STRING)) {
      const token = this.previous();
      console.log(`Parsed string literal: ${ token.value }`);

      // Remove quotes
      let value = token.value;
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1);
      } else if (value.startsWith("'") && value.endsWith("'")) {
        value = value.slice(1, -1);
      }

      return {
        type: 'StringLiteral',
        value,
        location: {
          line: token.line,
          column: token.column
        }
      };
    }

    if (this.match(TokenType.NUMBER)) {
      const token = this.previous();
      console.log(`Parsed number literal: ${ token.value }`);
      return {
        type: 'NumberLiteral',
        value: parseFloat(token.value),
        location: {
          line: token.line,
          column: token.column
        }
      };
    }

    if (this.match(TokenType.REGEX)) {
      const token = this.previous();
      console.log(`Parsed regex literal: ${ token.value }`);

      // Extract pattern and flags
      let pattern = token.value;
      let flags = '';

      // Remove the ~ operator
      if (pattern.startsWith('~')) {
        pattern = pattern.slice(1).trim();
      }

      // Remove quotes
      if (pattern.startsWith('"') && pattern.endsWith('"')) {
        pattern = pattern.slice(1, -1);
      } else if (pattern.startsWith("'") && pattern.endsWith("'")) {
        pattern = pattern.slice(1, -1);
      }

      return {
        type: 'RegexLiteral',
        pattern,
        flags,
        location: {
          line: token.line,
          column: token.column
        }
      };
    }

    if (this.match(TokenType.IDENTIFIER)) {
      const token = this.previous();
      console.log(`Parsed identifier: ${ token.value }`);

      // Check if this is a function call
      if (this.check(TokenType.PUNCTUATION, '(')) {
        return this.parseFunctionCall(token);
      }

      return {
        type: 'Identifier',
        name: token.value,
        location: {
          line: token.line,
          column: token.column
        }
      };
    }

    if (this.match(TokenType.KEYWORD, 'true')) {
      const token = this.previous();
      return {
        type: 'StringLiteral', // Using StringLiteral for booleans
        value: 'true',
        location: {
          line: token.line,
          column: token.column
        }
      };
    }

    if (this.match(TokenType.KEYWORD, 'false')) {
      const token = this.previous();
      return {
        type: 'StringLiteral', // Using StringLiteral for booleans
        value: 'false',
        location: {
          line: token.line,
          column: token.column
        }
      };
    }

    // Handle unary operators
    if (this.match(TokenType.OPERATOR, '!') ||
      this.match(TokenType.OPERATOR, '-')) {
      const operator = this.previous().value;
      const right = this.parsePrimary();

      return {
        type: 'BinaryExpression', // Using BinaryExpression for unary operators
        operator,
        left: {
          type: 'StringLiteral',
          value: '',
          location: right.location
        },
        right,
        location: right.location
      };
    }

    // If we can't parse a valid expression, return an empty identifier
    console.error(`Unexpected token: ${ this.peek().type } - ${ this.peek().value }`);

    // Default to an empty identifier
    return {
      type: 'Identifier',
      name: '',
      location: {
        line: this.peek().line,
        column: this.peek().column
      }
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

    throw new Error(`${ message } at line ${ this.peek().line }, column ${ this.peek().column }`);
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

  private peek(): Token {
    return this.tokens[this.current];
  }

  private previous(): Token {
    return this.tokens[this.current - 1];
  }

  private parseFunctionCall(token: Token): VCLExpression {
    const name = token.value;
    console.log(`Parsing function call: ${ name }`);

    // Consume the opening parenthesis
    this.consume(TokenType.PUNCTUATION, "Expected '(' after function name");

    const args: VCLExpression[] = [];

    // Parse arguments
    if (!this.check(TokenType.PUNCTUATION, ')')) {
      do {
        args.push(this.parseExpression());
      } while (this.match(TokenType.PUNCTUATION, ','));
    }

    // Consume the closing parenthesis
    this.consume(TokenType.PUNCTUATION, "Expected ')' after function arguments");

    console.log(`Parsed function call with ${ args.length } arguments`);

    // Check if there's a member access after the function call (e.g., func().name)
    let result: VCLExpression = {
      type: 'FunctionCall',
      name,
      arguments: args,
      location: {
        line: token.line,
        column: token.column
      }
    };

    // Handle member access (e.g., func().name)
    if (this.match(TokenType.PUNCTUATION, '.')) {
      // Parse the property name
      const propertyToken = this.consume(TokenType.IDENTIFIER, "Expected property name after '.'");

      result = {
        type: 'MemberAccess',
        object: result,
        property: propertyToken.value,
        location: {
          line: propertyToken.line,
          column: propertyToken.column
        }
      };
    }

    return result;
  }
}
