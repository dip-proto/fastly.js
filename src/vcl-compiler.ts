/**
 * VCL Compiler Module
 *
 * This module provides functionality to compile VCL AST into executable TypeScript functions.
 */

import {
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
  VCLRegexLiteral
} from './vcl-parser';

// VCL Context interface
export interface VCLContext {
  req: {
    url: string;
    method: string;
    http: Record<string, string>;
  };
  bereq: {
    url: string;
    method: string;
    http: Record<string, string>;
  };
  beresp: {
    status: number;
    statusText: string;
    http: Record<string, string>;
    ttl: number;
    grace?: number;
    stale_while_revalidate?: number;
  };
  resp: {
    status: number;
    statusText: string;
    http: Record<string, string>;
  };
  obj: {
    status: number;
    response: string;
    http: Record<string, string>;
    hits: number;
  };
  // Cache-related properties
  cache: Map<string, any>;
  hashData?: string[];

  // Fastly-specific properties
  fastly?: {
    error?: string;
    state?: string;
  };

  // Standard library functions
  std?: {
    // Logging
    log: (message: string) => void;

    // Time functions
    time: (format: string) => number;
    strftime: (format: string, time: number) => string;

    // String manipulation
    tolower: (str: string) => string;
    toupper: (str: string) => string;
    strlen: (str: string) => number;
    strstr: (haystack: string, needle: string) => string | null;
    substr: (str: string, offset: number, length?: number) => string;
    prefixof: (str: string, prefix: string) => boolean;
    suffixof: (str: string, suffix: string) => boolean;
    replace: (str: string, search: string, replacement: string) => string;
    replaceall: (str: string, search: string, replacement: string) => string;

    // Regular expressions
    regsub: (str: string, regex: string, replacement: string) => string;
    regsuball: (str: string, regex: string, replacement: string) => string;

    // Type conversion
    integer: (value: any) => number;
    real: (value: any) => number;

    // Math functions
    math: {
      round: (num: number) => number;
      floor: (num: number) => number;
      ceil: (num: number) => number;
      pow: (base: number, exponent: number) => number;
      log: (num: number) => number;
      min: (a: number, b: number) => number;
      max: (a: number, b: number) => number;
      abs: (num: number) => number;
    };

    // Encoding/decoding
    base64: (str: string) => string;
    base64_decode: (str: string) => string;
    base64url: (str: string) => string;
    base64url_decode: (str: string) => string;

    // Digest functions
    digest: {
      hash_md5: (str: string) => string;
      hash_sha1: (str: string) => string;
      hash_sha256: (str: string) => string;
      hmac_md5: (key: string, message: string) => string;
      hmac_sha1: (key: string, message: string) => string;
      hmac_sha256: (key: string, message: string) => string;
      secure_is_equal: (a: string, b: string) => boolean;
    };

    // HTTP functions
    header: {
      get: (headers: Record<string, string>, name: string) => string | null;
      set: (headers: Record<string, string>, name: string, value: string) => void;
      remove: (headers: Record<string, string>, name: string) => void;
    };

    // Query string functions
    querystring: {
      get: (url: string, name: string) => string | null;
      set: (url: string, name: string, value: string) => string;
      remove: (url: string, name: string) => string;
      filter: (url: string, names: string[]) => string;
      filter_except: (url: string, names: string[]) => string;
    };
  };
}

// VCL Subroutines interface
export interface VCLSubroutines {
  vcl_recv?: (context: VCLContext) => string;
  vcl_hash?: (context: VCLContext) => string;
  vcl_hit?: (context: VCLContext) => string;
  vcl_miss?: (context: VCLContext) => string;
  vcl_pass?: (context: VCLContext) => string;
  vcl_fetch?: (context: VCLContext) => string;
  vcl_deliver?: (context: VCLContext) => string;
  vcl_error?: (context: VCLContext) => string;
  vcl_log?: (context: VCLContext) => void;
}

// VCL Standard Library
export const VCLStdLib = {
  log: (message: string) => {
    console.log(`[VCL] ${message}`);
  },

  // Time conversion functions
  time: {
    parse: (timeStr: string): number => {
      return Date.parse(timeStr);
    },

    format: (time: number, format: string): string => {
      return new Date(time).toISOString();
    }
  },

  // String functions
  string: {
    tolower: (str: string): string => {
      return str.toLowerCase();
    },

    toupper: (str: string): string => {
      return str.toUpperCase();
    },

    match: (str: string, pattern: string): boolean => {
      try {
        const regex = new RegExp(pattern);
        return regex.test(str);
      } catch (e) {
        console.error(`Invalid regex pattern: ${pattern}`);
        return false;
      }
    }
  }
};

// VCL Compiler class
export class VCLCompiler {
  private program: VCLProgram;

  constructor(program: VCLProgram) {
    this.program = program;
  }

  compile(): VCLSubroutines {
    const subroutines: VCLSubroutines = {};

    // Compile each subroutine
    for (const subroutine of this.program.subroutines) {
      const name = subroutine.name;

      if (name.startsWith('vcl_')) {
        subroutines[name] = this.compileSubroutine(subroutine);
      }
    }

    return subroutines;
  }

  private compileSubroutine(subroutine: VCLSubroutine): (context: VCLContext) => string {
    return (context: VCLContext) => {
      console.log(`Executing subroutine: ${subroutine.name}`);

      try {
        // Execute each statement in the subroutine
        for (const statement of subroutine.body) {
          const result = this.executeStatement(statement, context);

          // If the statement returns a value, return it from the subroutine
          if (result && typeof result === 'string') {
            console.log(`Subroutine ${subroutine.name} returning: ${result}`);
            return result;
          }
        }

        // Default return values for each subroutine
        let defaultReturn = '';
        switch (subroutine.name) {
          case 'vcl_recv':
            defaultReturn = 'lookup';
            break;
          case 'vcl_hash':
            defaultReturn = 'hash';
            break;
          case 'vcl_hit':
          case 'vcl_miss':
          case 'vcl_pass':
            defaultReturn = 'fetch';
            break;
          case 'vcl_fetch':
          case 'vcl_deliver':
          case 'vcl_error':
            defaultReturn = 'deliver';
            break;
          default:
            defaultReturn = '';
        }

        console.log(`Subroutine ${subroutine.name} using default return: ${defaultReturn}`);
        return defaultReturn;
      } catch (error) {
        console.error(`Error executing subroutine ${subroutine.name}:`, error);

        // Handle errors based on the subroutine
        let errorReturn = '';
        switch (subroutine.name) {
          case 'vcl_recv':
          case 'vcl_hash':
          case 'vcl_hit':
          case 'vcl_miss':
          case 'vcl_pass':
            errorReturn = 'error';
            break;
          case 'vcl_fetch':
            errorReturn = 'error';
            break;
          case 'vcl_deliver':
            errorReturn = 'deliver';
            break;
          case 'vcl_error':
            errorReturn = 'deliver';
            break;
          default:
            errorReturn = '';
        }

        console.log(`Subroutine ${subroutine.name} returning error: ${errorReturn}`);
        return errorReturn;
      }
    };
  }

  private executeStatement(statement: VCLStatement, context: VCLContext): string | void {
    console.log(`Executing statement of type: ${statement.type}`);

    switch (statement.type) {
      case 'IfStatement':
        return this.executeIfStatement(statement as VCLIfStatement, context);
      case 'ReturnStatement':
        return this.executeReturnStatement(statement as VCLReturnStatement, context);
      case 'ErrorStatement':
        return this.executeErrorStatement(statement as VCLErrorStatement, context);
      case 'SetStatement':
        return this.executeSetStatement(statement as VCLSetStatement, context);
      case 'UnsetStatement':
        return this.executeUnsetStatement(statement as VCLUnsetStatement, context);
      case 'LogStatement':
        return this.executeLogStatement(statement as VCLLogStatement, context);
      case 'SyntheticStatement':
        return this.executeSyntheticStatement(statement as VCLSyntheticStatement, context);
      case 'HashDataStatement':
        return this.executeHashDataStatement(statement as VCLHashDataStatement, context);
      case 'Statement':
        // Generic statement, just skip it
        console.log(`Skipping generic statement at line ${statement.location.line}, column ${statement.location.column}`);
        return;
      default:
        // Unknown statement type
        console.log(`Unknown statement type: ${statement.type}`);
        return;
    }
  }

  private executeIfStatement(statement: VCLIfStatement, context: VCLContext): string | void {
    const condition = this.evaluateExpression(statement.test, context);

    if (condition) {
      // Execute the consequent statements
      for (const stmt of statement.consequent) {
        const result = this.executeStatement(stmt, context);

        // If the statement returns a value, return it from the if statement
        if (result && typeof result === 'string') {
          return result;
        }
      }
    } else if (statement.alternate) {
      // Execute the alternate statements
      for (const stmt of statement.alternate) {
        const result = this.executeStatement(stmt, context);

        // If the statement returns a value, return it from the if statement
        if (result && typeof result === 'string') {
          return result;
        }
      }
    }
  }

  private executeReturnStatement(statement: VCLReturnStatement, context: VCLContext): string {
    return statement.argument;
  }

  private executeErrorStatement(statement: VCLErrorStatement, context: VCLContext): string {
    // Set error status and message
    context.obj.status = statement.status;
    context.obj.response = statement.message;

    return 'error';
  }

  private executeSetStatement(statement: VCLSetStatement, context: VCLContext): void {
    console.log(`Executing set statement: ${statement.target} = ${JSON.stringify(statement.value)}`);

    const value = this.evaluateExpression(statement.value, context);
    console.log(`Evaluated value: ${JSON.stringify(value)}, type: ${typeof value}`);

    // Parse the target path (e.g., req.http.X-Header)
    const parts = statement.target.split('.');
    console.log(`Target parts: ${JSON.stringify(parts)}`);

    if (parts.length === 3 && parts[0] === 'req' && parts[1] === 'http') {
      context.req.http[parts[2]] = String(value);
    } else if (parts.length === 3 && parts[0] === 'bereq' && parts[1] === 'http') {
      context.bereq.http[parts[2]] = String(value);
    } else if (parts.length === 3 && parts[0] === 'beresp' && parts[1] === 'http') {
      context.beresp.http[parts[2]] = String(value);
    } else if (parts.length === 3 && parts[0] === 'resp' && parts[1] === 'http') {
      context.resp.http[parts[2]] = String(value);
    } else if (parts.length === 3 && parts[0] === 'obj' && parts[1] === 'http') {
      context.obj.http[parts[2]] = String(value);
    } else if (parts.length === 2 && parts[0] === 'beresp' && parts[1] === 'ttl') {
      // Handle time values (e.g., 5m, 1h)
      const ttlStr = String(value).replace(/"/g, ''); // Remove quotes if present
      let ttl = 0;

      console.log(`Setting TTL to ${ttlStr}`);

      if (ttlStr.endsWith('s')) {
        ttl = parseInt(ttlStr) || 0;
      } else if (ttlStr.endsWith('m')) {
        ttl = (parseInt(ttlStr) || 0) * 60;
      } else if (ttlStr.endsWith('h')) {
        ttl = (parseInt(ttlStr) || 0) * 60 * 60;
      } else if (ttlStr.endsWith('d')) {
        ttl = (parseInt(ttlStr) || 0) * 60 * 60 * 24;
      } else {
        ttl = parseInt(ttlStr) || 0;
      }

      console.log(`Parsed TTL: ${ttl} seconds`);
      context.beresp.ttl = ttl;
      console.log(`Context beresp.ttl is now: ${context.beresp.ttl}`);

    } else if (parts.length === 2 && parts[0] === 'beresp' && parts[1] === 'grace') {
      // Handle grace period
      const graceStr = String(value).replace(/"/g, ''); // Remove quotes if present
      let grace = 0;

      console.log(`Setting grace to ${graceStr}`);

      if (graceStr.endsWith('s')) {
        grace = parseInt(graceStr) || 0;
      } else if (graceStr.endsWith('m')) {
        grace = (parseInt(graceStr) || 0) * 60;
      } else if (graceStr.endsWith('h')) {
        grace = (parseInt(graceStr) || 0) * 60 * 60;
      } else if (graceStr.endsWith('d')) {
        grace = (parseInt(graceStr) || 0) * 60 * 60 * 24;
      } else {
        grace = parseInt(graceStr) || 0;
      }

      console.log(`Parsed grace: ${grace} seconds`);
      context.beresp.grace = grace;
      console.log(`Context beresp.grace is now: ${context.beresp.grace}`);
    } else if (parts.length === 2 && parts[0] === 'beresp' && parts[1] === 'stale_while_revalidate') {
      // Handle stale-while-revalidate
      const swrStr = String(value).replace(/"/g, ''); // Remove quotes if present
      let swr = 0;

      console.log(`Setting stale_while_revalidate to ${swrStr}`);

      if (swrStr.endsWith('s')) {
        swr = parseInt(swrStr) || 0;
      } else if (swrStr.endsWith('m')) {
        swr = (parseInt(swrStr) || 0) * 60;
      } else if (swrStr.endsWith('h')) {
        swr = (parseInt(swrStr) || 0) * 60 * 60;
      } else if (swrStr.endsWith('d')) {
        swr = (parseInt(swrStr) || 0) * 60 * 60 * 24;
      } else {
        swr = parseInt(swrStr) || 0;
      }

      console.log(`Parsed stale_while_revalidate: ${swr} seconds`);
      context.beresp.stale_while_revalidate = swr;
      console.log(`Context beresp.stale_while_revalidate is now: ${context.beresp.stale_while_revalidate}`);
    } else {
      console.log(`Unhandled set target: ${statement.target}`);
    }
  }

  private executeUnsetStatement(statement: VCLUnsetStatement, context: VCLContext): void {
    // Parse the target path (e.g., req.http.X-Header)
    const parts = statement.target.split('.');

    if (parts.length === 3 && parts[0] === 'req' && parts[1] === 'http') {
      delete context.req.http[parts[2]];
    } else if (parts.length === 3 && parts[0] === 'bereq' && parts[1] === 'http') {
      delete context.bereq.http[parts[2]];
    } else if (parts.length === 3 && parts[0] === 'beresp' && parts[1] === 'http') {
      delete context.beresp.http[parts[2]];
    } else if (parts.length === 3 && parts[0] === 'resp' && parts[1] === 'http') {
      delete context.resp.http[parts[2]];
    } else if (parts.length === 3 && parts[0] === 'obj' && parts[1] === 'http') {
      delete context.obj.http[parts[2]];
    }
  }

  private executeLogStatement(statement: VCLLogStatement, context: VCLContext): void {
    const message = this.evaluateExpression(statement.message, context);
    console.log(`[VCL] ${message}`);
  }

  private executeSyntheticStatement(statement: VCLSyntheticStatement, context: VCLContext): void {
    // Set synthetic response
    context.obj.http['Content-Type'] = 'text/html; charset=utf-8';
    context.obj.response = statement.content;
  }

  private executeHashDataStatement(statement: VCLHashDataStatement, context: VCLContext): void {
    // Get the value to hash
    const value = this.evaluateExpression(statement.value, context);

    // Create a hash of the value using a simple algorithm
    const crypto = require('crypto');
    const hash = crypto.createHash('md5').update(String(value)).digest('hex');

    // Store the hash in the context for later use in cache key generation
    if (!context.hashData) {
      context.hashData = [];
    }

    context.hashData.push(hash);
  }

  private evaluateExpression(expression: VCLExpression, context: VCLContext): any {
    switch (expression.type) {
      case 'StringLiteral':
        return (expression as VCLStringLiteral).value;
      case 'NumberLiteral':
        return (expression as VCLNumberLiteral).value;
      case 'RegexLiteral':
        return new RegExp((expression as VCLRegexLiteral).pattern);
      case 'Identifier':
        return this.evaluateIdentifier(expression as VCLIdentifier, context);
      case 'BinaryExpression':
        return this.evaluateBinaryExpression(expression as VCLBinaryExpression, context);
      default:
        return null;
    }
  }

  private evaluateIdentifier(identifier: VCLIdentifier, context: VCLContext): any {
    const name = identifier.name;

    // Parse the identifier path (e.g., req.http.X-Header)
    const parts = name.split('.');

    if (parts.length === 2 && parts[0] === 'req' && parts[1] === 'url') {
      return context.req.url;
    } else if (parts.length === 2 && parts[0] === 'req' && parts[1] === 'method') {
      return context.req.method;
    } else if (parts.length === 3 && parts[0] === 'req' && parts[1] === 'http') {
      return context.req.http[parts[2]] || '';
    } else if (parts.length === 2 && parts[0] === 'bereq' && parts[1] === 'url') {
      return context.bereq.url;
    } else if (parts.length === 2 && parts[0] === 'bereq' && parts[1] === 'method') {
      return context.bereq.method;
    } else if (parts.length === 3 && parts[0] === 'bereq' && parts[1] === 'http') {
      return context.bereq.http[parts[2]] || '';
    } else if (parts.length === 2 && parts[0] === 'beresp' && parts[1] === 'status') {
      return context.beresp.status;
    } else if (parts.length === 3 && parts[0] === 'beresp' && parts[1] === 'http') {
      return context.beresp.http[parts[2]] || '';
    } else if (parts.length === 2 && parts[0] === 'resp' && parts[1] === 'status') {
      return context.resp.status;
    } else if (parts.length === 3 && parts[0] === 'resp' && parts[1] === 'http') {
      return context.resp.http[parts[2]] || '';
    } else if (parts.length === 2 && parts[0] === 'obj' && parts[1] === 'status') {
      return context.obj.status;
    } else if (parts.length === 2 && parts[0] === 'obj' && parts[1] === 'hits') {
      return context.obj.hits;
    } else if (parts.length === 3 && parts[0] === 'obj' && parts[1] === 'http') {
      return context.obj.http[parts[2]] || '';
    }

    return '';
  }

  private evaluateBinaryExpression(expression: VCLBinaryExpression, context: VCLContext): any {
    const left = this.evaluateExpression(expression.left, context);
    const right = this.evaluateExpression(expression.right, context);

    switch (expression.operator) {
      case '+':
        return left + right;
      case '-':
        return left - right;
      case '*':
        return left * right;
      case '/':
        return left / right;
      case '%':
        return left % right;
      case '==':
        return left == right;
      case '!=':
        return left != right;
      case '>':
        return left > right;
      case '>=':
        return left >= right;
      case '<':
        return left < right;
      case '<=':
        return left <= right;
      case '~':
        // Regex match
        try {
          if (typeof right === 'object' && right instanceof RegExp) {
            return right.test(String(left));
          } else {
            const regex = new RegExp(String(right));
            return regex.test(String(left));
          }
        } catch (e) {
          console.error(`Invalid regex pattern: ${right}`);
          return false;
        }
      case '!~':
        // Regex non-match
        try {
          if (typeof right === 'object' && right instanceof RegExp) {
            return !right.test(String(left));
          } else {
            const regex = new RegExp(String(right));
            return !regex.test(String(left));
          }
        } catch (e) {
          console.error(`Invalid regex pattern: ${right}`);
          return true;
        }
      default:
        return false;
    }
  }
}
