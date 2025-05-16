/**
 * VCL Module
 *
 * This module provides the main interface for loading and executing VCL files.
 */

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { VCLLexer } from './vcl-parser';
import { VCLParser } from './vcl-parser-impl';
import { VCLCompiler, VCLSubroutines, VCLContext } from './vcl-compiler';

// Load and parse a VCL file
export function loadVCL(filePath: string): VCLSubroutines {
  try {
    // Check if the file exists
    const fullPath = join(process.cwd(), filePath);
    if (!existsSync(fullPath)) {
      console.error(`VCL file not found: ${fullPath}`);
      return {};
    }

    // Read the file content
    const content = readFileSync(fullPath, 'utf-8');
    console.log(`Loaded VCL file: ${fullPath} (${content.length} bytes)`);

    // Tokenize the VCL code
    const lexer = new VCLLexer(content);
    const tokens = lexer.tokenize();
    console.log(`Tokenized VCL file: ${tokens.length} tokens`);

    // Parse the tokens into an AST
    const parser = new VCLParser(tokens);
    const ast = parser.parse();
    console.log(`Parsed VCL file: ${ast.subroutines.length} subroutines`);

    // Compile the AST into executable functions
    const compiler = new VCLCompiler(ast);
    const subroutines = compiler.compile();
    console.log(`Compiled VCL file: ${Object.keys(subroutines).length} subroutines`);

    return subroutines;
  } catch (error) {
    console.error(`Error loading VCL file: ${error.message}`);
    console.error(error.stack);
    return {};
  }
}

// Create a new VCL context
export function createVCLContext(): VCLContext {
  const context: VCLContext = {
    req: {
      url: '',
      method: '',
      http: {}
    },
    bereq: {
      url: '',
      method: '',
      http: {}
    },
    beresp: {
      status: 0,
      statusText: '',
      http: {},
      ttl: 0,
      grace: 0,
      stale_while_revalidate: 0
    },
    resp: {
      status: 0,
      statusText: '',
      http: {}
    },
    obj: {
      status: 0,
      response: '',
      http: {},
      hits: 0
    },
    cache: new Map(),
    hashData: [],
    fastly: {
      error: '',
      state: 'recv'
    }
  };

  // Initialize standard library functions
  context.std = {
    log: (message: string) => {
      console.log(`[VCL] ${message}`);
    },
    time: (format: string) => {
      return Date.now();
    },
    strftime: (format: string, time: number) => {
      return new Date(time).toISOString();
    },
    tolower: (str: string) => {
      return str.toLowerCase();
    },
    toupper: (str: string) => {
      return str.toUpperCase();
    }
  };

  return context;
}

// Execute a VCL subroutine
export function executeVCL(
  subroutines: VCLSubroutines,
  subroutineName: keyof VCLSubroutines,
  context: VCLContext
): string {
  const subroutine = subroutines[subroutineName];

  if (!subroutine) {
    console.warn(`Subroutine ${subroutineName} not found`);
    return '';
  }

  try {
    return subroutine(context);
  } catch (error) {
    console.error(`Error executing subroutine ${subroutineName}:`, error);
    return 'error';
  }
}
