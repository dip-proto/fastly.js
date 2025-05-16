/**
 * VCL Parser Implementation
 *
 * This module implements the parser for VCL (Varnish Configuration Language) files.
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
  VCLComment
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
      comments: []
    };

    // Parse comments and subroutines
    while (!this.isAtEnd()) {
      if (this.match(TokenType.COMMENT)) {
        program.comments.push(this.parseComment());
      } else if (this.match(TokenType.KEYWORD) && this.previous().value === 'sub') {
        program.subroutines.push(this.parseSubroutine());
      } else {
        // Skip unknown tokens
        this.advance();
      }
    }

    return program;
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

  private parseStatement(): VCLStatement {
    console.log(`Parsing statement at position ${this.current}, token: ${this.peek().type} - ${this.peek().value}`);

    if (this.match(TokenType.KEYWORD)) {
      const keyword = this.previous().value;
      console.log(`Found keyword: ${keyword}`);

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
      }
    } else if (this.match(TokenType.IDENTIFIER)) {
      const identifier = this.previous().value;
      console.log(`Found identifier: ${identifier}`);

      if (identifier.startsWith('std.log')) {
        return this.parseLogStatement();
      } else if (identifier === 'hash_data') {
        return this.parseHashDataStatement();
      }
    }

    console.log(`Unknown statement, skipping to semicolon`);

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

  private parseIfStatement(): VCLIfStatement {
    const token = this.previous();
    console.log(`Parsing if statement at line ${token.line}, column ${token.column}`);

    // Parse the condition
    const test = this.parseExpression();
    console.log(`Parsed condition: ${JSON.stringify(test)}`);

    this.consume(TokenType.PUNCTUATION, "Expected '{' after if condition");
    console.log(`Found opening brace`);

    const consequent: VCLStatement[] = [];

    // Parse statements until we reach the closing brace
    while (!this.check(TokenType.PUNCTUATION, '}') && !this.isAtEnd()) {
      const statement = this.parseStatement();
      console.log(`Parsed consequent statement: ${statement.type}`);
      consequent.push(statement);
    }

    this.consume(TokenType.PUNCTUATION, "Expected '}' after if body");
    console.log(`Found closing brace`);

    // Check for else
    let alternate: VCLStatement[] | undefined;

    if (this.match(TokenType.KEYWORD) && this.previous().value === 'else') {
      console.log(`Found else keyword`);

      // Check for else if
      if (this.check(TokenType.KEYWORD) && this.peek().value === 'if') {
        console.log(`Found else if`);
        this.advance(); // Consume the 'if' token

        // Parse the else if as a nested if statement
        const elseIfStatement = this.parseIfStatement();

        // Create an alternate array with just the else if statement
        alternate = [elseIfStatement];
      } else {
        // Parse the opening brace
        this.consume(TokenType.PUNCTUATION, "Expected '{' after else");
        console.log(`Found opening brace for else`);

        alternate = [];

        // Parse statements until we reach the closing brace
        while (!this.check(TokenType.PUNCTUATION, '}') && !this.isAtEnd()) {
          const statement = this.parseStatement();
          console.log(`Parsed alternate statement: ${statement.type}`);
          alternate.push(statement);
        }

        this.consume(TokenType.PUNCTUATION, "Expected '}' after else body");
        console.log(`Found closing brace for else`);
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
      throw new Error(`Expected return argument at line ${this.peek().line}, column ${this.peek().column}`);
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

  private parseSetStatement(): VCLSetStatement {
    const token = this.previous();
    console.log(`Parsing set statement at line ${token.line}, column ${token.column}`);

    // Parse the target (e.g., req.http.X-Header)
    let target = '';

    // First part of the target (e.g., req)
    if (this.match(TokenType.IDENTIFIER)) {
      target = this.previous().value;
      console.log(`Target first part: ${target}`);

      // Check for dot notation (e.g., req.http)
      while (this.match(TokenType.PUNCTUATION, '.')) {
        if (this.match(TokenType.IDENTIFIER)) {
          // Handle headers with hyphens (e.g., X-Test)
          let identifier = this.previous().value;

          // Check for hyphen followed by more text
          while (this.match(TokenType.PUNCTUATION, '-')) {
            if (this.match(TokenType.IDENTIFIER)) {
              identifier += '-' + this.previous().value;
              console.log(`Extended identifier with hyphen: ${identifier}`);
            } else {
              this.error("Expected identifier after '-'");
              break;
            }
          }

          target += '.' + identifier;
          console.log(`Target extended: ${target}`);
        } else {
          this.error("Expected identifier after '.'");
          break;
        }
      }
    } else {
      this.error("Expected identifier after 'set'");
    }

    // Parse the equals sign
    this.consume(TokenType.OPERATOR, "Expected '=' after identifier");
    console.log(`Found equals sign`);

    // Parse the value
    const value = this.parseExpression();
    console.log(`Parsed expression: ${JSON.stringify(value)}`);

    // Parse the semicolon
    this.consume(TokenType.PUNCTUATION, "Expected ';' after set statement");
    console.log(`Found semicolon`);

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
      throw new Error(`Expected string or '{' after synthetic at line ${this.peek().line}, column ${this.peek().column}`);
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
    // Simple expression parsing for now
    if (this.match(TokenType.STRING)) {
      const token = this.previous();
      return {
        type: 'StringLiteral',
        value: token.value.slice(1, -1), // Remove quotes
        location: {
          line: token.line,
          column: token.column
        }
      };
    } else if (this.match(TokenType.NUMBER)) {
      const token = this.previous();
      return {
        type: 'NumberLiteral',
        value: parseFloat(token.value),
        location: {
          line: token.line,
          column: token.column
        }
      };
    } else if (this.match(TokenType.REGEX)) {
      const token = this.previous();
      return {
        type: 'RegexLiteral',
        pattern: token.value.slice(2, -1), // Remove ~ and quotes
        flags: '',
        location: {
          line: token.line,
          column: token.column
        }
      };
    } else if (this.match(TokenType.IDENTIFIER)) {
      const token = this.previous();

      // Check for binary expression
      if (this.match(TokenType.OPERATOR)) {
        const operator = this.previous().value;
        const right = this.parseExpression();

        return {
          type: 'BinaryExpression',
          operator,
          left: {
            type: 'Identifier',
            name: token.value,
            location: {
              line: token.line,
              column: token.column
            }
          },
          right,
          location: {
            line: token.line,
            column: token.column
          }
        };
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

  private peek(): Token {
    return this.tokens[this.current];
  }

  private previous(): Token {
    return this.tokens[this.current - 1];
  }
}
