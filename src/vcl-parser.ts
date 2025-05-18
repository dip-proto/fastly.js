/**
 * VCL Parser Module
 *
 * This module provides functionality to parse VCL (Varnish Configuration Language) files
 * and convert them into executable TypeScript functions.
 */

// Types for the VCL AST (Abstract Syntax Tree)
export type VCLNodeType =
  | 'Program'
  | 'Subroutine'
  | 'Statement'
  | 'Assignment'
  | 'IfStatement'
  | 'ReturnStatement'
  | 'ErrorStatement'
  | 'SetStatement'
  | 'UnsetStatement'
  | 'LogStatement'
  | 'SyntheticStatement'
  | 'HashDataStatement'
  | 'GotoStatement'
  | 'LabelStatement'
  | 'RestartStatement'
  | 'BinaryExpression'
  | 'TernaryExpression'
  | 'FunctionCall'
  | 'Identifier'
  | 'StringLiteral'
  | 'NumberLiteral'
  | 'RegexLiteral'
  | 'Comment'
  | 'ACL'
  | 'ACLEntry';

export interface VCLNode {
  type: VCLNodeType;
  location?: {
    line: number;
    column: number;
  };
}

export interface VCLProgram extends VCLNode {
  type: 'Program';
  subroutines: VCLSubroutine[];
  comments: VCLComment[];
  acls: VCLACL[];
}

export interface VCLACL extends VCLNode {
  type: 'ACL';
  name: string;
  entries: VCLACLEntry[];
}

export interface VCLACLEntry extends VCLNode {
  type: 'ACLEntry';
  ip: string;
  subnet?: number; // CIDR notation (e.g., 24 for /24)
}

export interface VCLSubroutine extends VCLNode {
  type: 'Subroutine';
  name: string;
  body: VCLStatement[];
}

export interface VCLStatement extends VCLNode {
  type: 'Statement';
}

export interface VCLAssignment extends VCLStatement {
  type: 'Assignment';
  left: VCLIdentifier;
  right: VCLExpression;
}

export interface VCLIfStatement extends VCLStatement {
  type: 'IfStatement';
  test: VCLExpression;
  consequent: VCLStatement[];
  alternate?: VCLStatement[];
}

export interface VCLReturnStatement extends VCLStatement {
  type: 'ReturnStatement';
  argument: string;
}

export interface VCLErrorStatement extends VCLStatement {
  type: 'ErrorStatement';
  status: number;
  message: string;
}

export interface VCLSetStatement extends VCLStatement {
  type: 'SetStatement';
  target: string;
  value: VCLExpression;
}

export interface VCLUnsetStatement extends VCLStatement {
  type: 'UnsetStatement';
  target: string;
}

export interface VCLLogStatement extends VCLStatement {
  type: 'LogStatement';
  message: VCLExpression;
}

export interface VCLSyntheticStatement extends VCLStatement {
  type: 'SyntheticStatement';
  content: string;
}

export interface VCLHashDataStatement extends VCLStatement {
  type: 'HashDataStatement';
  value: VCLExpression;
}

export interface VCLGotoStatement extends VCLStatement {
  type: 'GotoStatement';
  label: string;
}

export interface VCLLabelStatement extends VCLStatement {
  type: 'LabelStatement';
  name: string;
  statement?: VCLStatement;
}

export interface VCLRestartStatement extends VCLStatement {
  type: 'RestartStatement';
}

export type VCLExpression =
  | VCLBinaryExpression
  | VCLTernaryExpression
  | VCLFunctionCall
  | VCLIdentifier
  | VCLStringLiteral
  | VCLNumberLiteral
  | VCLRegexLiteral;

export interface VCLBinaryExpression extends VCLNode {
  type: 'BinaryExpression';
  operator: string;
  left: VCLExpression;
  right: VCLExpression;
}

export interface VCLTernaryExpression extends VCLNode {
  type: 'TernaryExpression';
  condition: VCLExpression;
  trueExpr: VCLExpression;
  falseExpr: VCLExpression;
}

export interface VCLFunctionCall extends VCLNode {
  type: 'FunctionCall';
  name: string;
  arguments: VCLExpression[];
}

export interface VCLIdentifier extends VCLNode {
  type: 'Identifier';
  name: string;
}

export interface VCLStringLiteral extends VCLNode {
  type: 'StringLiteral';
  value: string;
}

export interface VCLNumberLiteral extends VCLNode {
  type: 'NumberLiteral';
  value: number;
}

export interface VCLRegexLiteral extends VCLNode {
  type: 'RegexLiteral';
  pattern: string;
  flags: string;
}

export interface VCLComment extends VCLNode {
  type: 'Comment';
  value: string;
  multiline: boolean;
}

// Token types for the lexer
export enum TokenType {
  KEYWORD = 'KEYWORD',
  IDENTIFIER = 'IDENTIFIER',
  STRING = 'STRING',
  NUMBER = 'NUMBER',
  REGEX = 'REGEX',
  OPERATOR = 'OPERATOR',
  PUNCTUATION = 'PUNCTUATION',
  COMMENT = 'COMMENT',
  WHITESPACE = 'WHITESPACE',
  EOF = 'EOF'
}

export interface Token {
  type: TokenType;
  value: string;
  line: number;
  column: number;
  position?: number; // Position in the source code
}

// VCL Keywords
const VCL_KEYWORDS = [
  'sub', 'if', 'else', 'elseif', 'return', 'set', 'unset', 'error',
  'synthetic', 'hash_data', 'true', 'false', 'deliver', 'fetch',
  'pass', 'hash', 'lookup', 'restart', 'purge', 'acl', 'goto'
];

// Lexer class to tokenize VCL code
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
      const char = this.input[this.position];

      // Handle whitespace
      if (/\s/.test(char)) {
        this.tokenizeWhitespace();
        continue;
      }

      // Handle comments
      if (char === '#') {
        this.tokenizeComment();
        continue;
      }

      // Handle strings
      if (char === '"' || char === "'") {
        this.tokenizeString(char);
        continue;
      }

      // Handle numbers
      if (/[0-9]/.test(char)) {
        this.tokenizeNumber();
        continue;
      }

      // Handle identifiers and keywords
      if (/[a-zA-Z_.]/.test(char)) {
        this.tokenizeIdentifier();
        continue;
      }

      // Handle regex operators
      if (char === '~' || (char === '!' && this.position + 1 < this.input.length && this.input[this.position + 1] === '~')) {
        // Tokenize as an operator, not a regex
        this.tokenizeOperator();
        continue;
      }

      // Handle operators
      if (/[+\-*/%=<>!&|^~]/.test(char)) {
        this.tokenizeOperator();
        continue;
      }

      // Handle synthetic blocks
      if (char === '{') {
        // Check if the previous token is 'synthetic'
        const prevToken = this.tokens.length > 0 ? this.tokens[this.tokens.length - 1] : null;
        if (prevToken && prevToken.type === TokenType.KEYWORD && prevToken.value === 'synthetic') {
          this.tokenizeSyntheticBlock();
          continue;
        }
      }

      // Handle punctuation
      if (/[(){}\[\],;.]/.test(char)) {
        this.tokenizePunctuation();
        continue;
      }

      // Skip unknown characters
      this.advance();
    }

    // Add EOF token
    this.tokens.push({
      type: TokenType.EOF,
      value: '',
      line: this.line,
      column: this.column
    });

    return this.tokens;
  }

  private tokenizeWhitespace(): void {
    const start = this.position;
    while (this.position < this.input.length && /\s/.test(this.input[this.position])) {
      if (this.input[this.position] === '\n') {
        this.line++;
        this.column = 1;
      } else {
        this.column++;
      }
      this.position++;
    }

    // We don't add whitespace tokens to the token list
  }

  private tokenizeComment(): void {
    const start = this.position;
    const startLine = this.line;
    const startColumn = this.column;

    // Skip the # character
    this.advance();

    // Read until end of line
    while (this.position < this.input.length && this.input[this.position] !== '\n') {
      this.advance();
    }

    const value = this.input.substring(start, this.position);

    this.tokens.push({
      type: TokenType.COMMENT,
      value,
      line: startLine,
      column: startColumn
    });
  }

  private tokenizeString(quote: string): void {
    const start = this.position;
    const startLine = this.line;
    const startColumn = this.column;

    // Skip the opening quote
    this.advance();

    // Check if this is a multi-line string (for synthetic blocks)
    if (this.position < this.input.length - 2 &&
      this.input[this.position] === quote &&
      this.input[this.position + 1] === quote) {
      // Skip the next two quotes
      this.advance();
      this.advance();

      // Read until closing triple quote
      while (this.position < this.input.length) {
        if (this.input[this.position] === quote &&
          this.position + 2 < this.input.length &&
          this.input[this.position + 1] === quote &&
          this.input[this.position + 2] === quote) {
          // Skip the closing triple quotes
          this.advance();
          this.advance();
          this.advance();
          break;
        }

        if (this.input[this.position] === '\n') {
          this.line++;
          this.column = 1;
        }

        this.advance();
      }
    } else {
      // Regular string
      while (this.position < this.input.length && this.input[this.position] !== quote) {
        // Handle escape sequences
        if (this.input[this.position] === '\\' && this.position + 1 < this.input.length) {
          this.advance(); // Skip the backslash
        }

        if (this.input[this.position] === '\n') {
          this.line++;
          this.column = 1;
        }

        this.advance();
      }

      // Skip the closing quote
      if (this.position < this.input.length) {
        this.advance();
      }
    }

    const value = this.input.substring(start, this.position);

    this.tokens.push({
      type: TokenType.STRING,
      value,
      line: startLine,
      column: startColumn
    });
  }

  // Special method to handle VCL synthetic blocks
  private tokenizeSyntheticBlock(): void {
    const start = this.position;
    const startLine = this.line;
    const startColumn = this.column;

    // Skip the opening brace
    this.advance();

    // Read until closing brace
    let braceCount = 1;
    while (this.position < this.input.length && braceCount > 0) {
      if (this.input[this.position] === '{') {
        braceCount++;
      } else if (this.input[this.position] === '}') {
        braceCount--;
      }

      if (this.input[this.position] === '\n') {
        this.line++;
        this.column = 1;
      }

      this.advance();
    }

    const value = this.input.substring(start, this.position);

    this.tokens.push({
      type: TokenType.STRING,
      value,
      line: startLine,
      column: startColumn
    });
  }

  private tokenizeNumber(): void {
    const start = this.position;
    const startLine = this.line;
    const startColumn = this.column;

    // Read digits
    while (this.position < this.input.length && /[0-9]/.test(this.input[this.position])) {
      this.advance();
    }

    // Handle decimal point
    if (this.position < this.input.length && this.input[this.position] === '.') {
      this.advance();

      // Read decimal digits
      while (this.position < this.input.length && /[0-9]/.test(this.input[this.position])) {
        this.advance();
      }
    }

    // Handle time units (s, m, h, d, y)
    if (this.position < this.input.length && /[smhdy]/.test(this.input[this.position])) {
      this.advance();

      // Check for VCL time units like "5m" (5 minutes)
      const value = this.input.substring(start, this.position);

      console.log(`Tokenizing time value: ${ value }`);

      this.tokens.push({
        type: TokenType.STRING, // Treat time values as strings to preserve the unit
        value: `"${ value }"`, // Wrap in quotes to make it a string literal
        line: startLine,
        column: startColumn
      });

      return;
    }

    const value = this.input.substring(start, this.position);

    this.tokens.push({
      type: TokenType.NUMBER,
      value,
      line: startLine,
      column: startColumn
    });
  }

  private tokenizeIdentifier(): void {
    const start = this.position;
    const startLine = this.line;
    const startColumn = this.column;

    // Read identifier characters (letters, digits, underscore, dot, hyphen)
    // We'll include hyphens in identifiers to handle headers like X-Test
    let includeHyphen = false;

    while (this.position < this.input.length) {
      const char = this.input[this.position];

      // Always accept letters, digits, underscore, dot
      if (/[a-zA-Z0-9_.]/.test(char)) {
        this.advance();
        // After we've seen a letter, digit, underscore, or dot, we can accept hyphens
        includeHyphen = true;
      }
      // Accept hyphens only after we've seen a letter, digit, underscore, or dot
      // This prevents operators like "-" from being treated as part of an identifier
      else if (includeHyphen && char === '-') {
        this.advance();
        // After a hyphen, we need to see a letter, digit, underscore, or dot
        includeHyphen = false;
      }
      else {
        break;
      }
    }

    const value = this.input.substring(start, this.position);

    console.log(`Tokenized identifier: ${ value }`);

    // Check if it's a keyword
    if (VCL_KEYWORDS.includes(value)) {
      this.tokens.push({
        type: TokenType.KEYWORD,
        value,
        line: startLine,
        column: startColumn
      });
    } else {
      this.tokens.push({
        type: TokenType.IDENTIFIER,
        value,
        line: startLine,
        column: startColumn
      });
    }
  }

  private tokenizeRegex(): void {
    const start = this.position;
    const startLine = this.line;
    const startColumn = this.column;

    // Skip the ~ or !~ operator
    if (this.input[this.position] === '~') {
      this.advance();
    } else if (this.position + 1 < this.input.length &&
      this.input[this.position] === '!' &&
      this.input[this.position + 1] === '~') {
      this.advance(); // Skip !
      this.advance(); // Skip ~
    }

    // Skip whitespace
    while (this.position < this.input.length && /\s/.test(this.input[this.position])) {
      if (this.input[this.position] === '\n') {
        this.line++;
        this.column = 1;
      }
      this.advance();
    }

    // Check for opening quote (either " or ')
    if (this.position < this.input.length &&
      (this.input[this.position] === '"' || this.input[this.position] === "'")) {
      const quoteChar = this.input[this.position];

      // Skip the opening quote
      this.advance();

      // Read until closing quote
      while (this.position < this.input.length && this.input[this.position] !== quoteChar) {
        // Handle escape sequences
        if (this.input[this.position] === '\\' && this.position + 1 < this.input.length) {
          this.advance(); // Skip the backslash
        }

        if (this.input[this.position] === '\n') {
          this.line++;
          this.column = 1;
        }

        this.advance();
      }

      // Skip the closing quote
      if (this.position < this.input.length) {
        this.advance();
      }
    }

    const value = this.input.substring(start, this.position);
    console.log(`Tokenized regex: ${ value }`);

    this.tokens.push({
      type: TokenType.REGEX,
      value,
      line: startLine,
      column: startColumn
    });
  }

  private tokenizeOperator(): void {
    const start = this.position;
    const startLine = this.line;
    const startColumn = this.column;

    // Read operator characters
    while (this.position < this.input.length && /[+\-*/%=<>!&|^~]/.test(this.input[this.position])) {
      this.advance();
    }

    const value = this.input.substring(start, this.position);

    this.tokens.push({
      type: TokenType.OPERATOR,
      value,
      line: startLine,
      column: startColumn
    });
  }

  private tokenizePunctuation(): void {
    const start = this.position;
    const startLine = this.line;
    const startColumn = this.column;

    // Read a single punctuation character
    this.advance();

    const value = this.input.substring(start, this.position);

    this.tokens.push({
      type: TokenType.PUNCTUATION,
      value,
      line: startLine,
      column: startColumn
    });
  }

  private advance(): void {
    this.position++;
    this.column++;
  }
}

/**
 * Parse VCL code into an AST
 *
 * @param input - The VCL code to parse
 * @returns The parsed VCL program
 */
export function parseVCL(input: string): VCLProgram {
  // Tokenize the input
  const lexer = new VCLLexer(input);
  const tokens = lexer.tokenize();

  // Add position information to tokens
  for (let i = 0; i < tokens.length; i++) {
    tokens[i].position = input.indexOf(tokens[i].value, tokens[i - 1]?.position || 0);
  }

  // Parse the tokens into an AST
  const parser = new VCLParser(tokens, input);
  return parser.parse();
}
