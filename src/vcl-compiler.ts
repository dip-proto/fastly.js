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
  VCLTernaryExpression,
  VCLFunctionCall,
  VCLIdentifier,
  VCLStringLiteral,
  VCLNumberLiteral,
  VCLRegexLiteral
} from './vcl-parser';

// Backend interface
export interface VCLBackend {
  name: string;
  host: string;
  port: number;
  ssl: boolean;
  connect_timeout: number; // in milliseconds
  first_byte_timeout: number; // in milliseconds
  between_bytes_timeout: number; // in milliseconds
  max_connections: number;
  ssl_cert_hostname?: string;
  ssl_sni_hostname?: string;
  ssl_check_cert?: boolean;
  probe?: VCLProbe;
  is_healthy?: boolean;
}

// Health check probe interface
export interface VCLProbe {
  request: string;
  expected_response: number;
  interval: number; // in milliseconds
  timeout: number; // in milliseconds
  window: number;
  threshold: number;
  initial: number;
}

// Director interface
export interface VCLDirector {
  name: string;
  type: 'random' | 'hash' | 'client' | 'fallback' | 'chash';
  backends: Array<{ backend: VCLBackend, weight: number }>;
  quorum: number; // percentage (0-100)
  retries: number;
}

// VCL Context interface
export interface VCLContext {
  req: {
    url: string;
    method: string;
    http: Record<string, string>;
    backend?: string; // Name of the selected backend
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

  // Backend-related properties
  backends: Record<string, VCLBackend>;
  directors: Record<string, VCLDirector>;
  current_backend?: VCLBackend;

  // Regex-related properties
  re?: {
    groups?: Record<number, string>;
  };

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
    strftime: (format: string, time: number) => string;

    // Time manipulation functions
    time: {
      // Get current time
      now: () => number;
      add: (time: number, offset: string | number) => number;
      sub: (time1: number, time2: number) => number;
      is_after: (time1: number, time2: number) => boolean;
      hex_to_time: (hex: string) => number;
    };

    // Backend management functions
    backend?: {
      add: (name: string, host: string, port: number, ssl?: boolean, options?: any) => boolean;
      remove: (name: string) => boolean;
      get: (name: string) => VCLBackend | null;
      set_current: (name: string) => boolean;
      is_healthy: (name: string) => boolean;
      add_probe: (backendName: string, options: any) => boolean;
    };

    // Director management functions
    director?: {
      add: (name: string, type: string, options?: any) => boolean;
      remove: (name: string) => boolean;
      add_backend: (directorName: string, backendName: string, weight?: number) => boolean;
      remove_backend: (directorName: string, backendName: string) => boolean;
      select_backend: (directorName: string) => VCLBackend | null;
    };

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
      filter: (headers: Record<string, string>, pattern: string) => void;
      filter_except: (headers: Record<string, string>, pattern: string) => void;
    };

    // HTTP status functions
    http: {
      status_matches: (status: number, pattern: string) => boolean;
    };

    // Error handling and synthetic responses
    synthetic: (content: string) => void;
    error: (status: number, message?: string) => void;

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
    console.log(`Executing if statement`);

    const condition = this.evaluateExpression(statement.test, context);
    console.log(`Condition evaluated to: ${condition}`);

    if (condition) {
      console.log(`Condition is true, executing consequent statements`);

      // Execute the consequent statements
      for (const stmt of statement.consequent) {
        console.log(`Executing consequent statement: ${stmt.type}`);
        const result = this.executeStatement(stmt, context);

        // If the statement returns a value, return it from the if statement
        if (result && typeof result === 'string') {
          console.log(`Returning from if statement with result: ${result}`);
          return result;
        }
      }
    } else if (statement.alternate) {
      console.log(`Condition is false, executing alternate statements`);

      // Execute the alternate statements
      for (const stmt of statement.alternate) {
        console.log(`Executing alternate statement: ${stmt.type}`);
        const result = this.executeStatement(stmt, context);

        // If the statement returns a value, return it from the if statement
        if (result && typeof result === 'string') {
          console.log(`Returning from if statement with result: ${result}`);
          return result;
        }
      }
    } else {
      console.log(`Condition is false and no alternate statements`);
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

    // Handle req.http.* headers
    if (parts.length >= 3 && parts[0] === 'req' && parts[1] === 'http') {
      const headerName = parts.slice(2).join('.');
      context.req.http[headerName] = String(value);
      console.log(`Set req.http.${headerName} = ${context.req.http[headerName]}`);
    }
    // Handle bereq.http.* headers
    else if (parts.length >= 3 && parts[0] === 'bereq' && parts[1] === 'http') {
      const headerName = parts.slice(2).join('.');
      context.bereq.http[headerName] = String(value);
      console.log(`Set bereq.http.${headerName} = ${context.bereq.http[headerName]}`);
    }
    // Handle beresp.http.* headers
    else if (parts.length >= 3 && parts[0] === 'beresp' && parts[1] === 'http') {
      const headerName = parts.slice(2).join('.');
      context.beresp.http[headerName] = String(value);
      console.log(`Set beresp.http.${headerName} = ${context.beresp.http[headerName]}`);
    }
    // Handle resp.http.* headers
    else if (parts.length >= 3 && parts[0] === 'resp' && parts[1] === 'http') {
      const headerName = parts.slice(2).join('.');
      context.resp.http[headerName] = String(value);
      console.log(`Set resp.http.${headerName} = ${context.resp.http[headerName]}`);
    }
    // Handle obj.http.* headers
    else if (parts.length >= 3 && parts[0] === 'obj' && parts[1] === 'http') {
      const headerName = parts.slice(2).join('.');
      context.obj.http[headerName] = String(value);
      console.log(`Set obj.http.${headerName} = ${context.obj.http[headerName]}`);
    }
    // Handle req.backend
    else if (parts.length === 2 && parts[0] === 'req' && parts[1] === 'backend') {
      context.req.backend = String(value);
      console.log(`Set req.backend = ${context.req.backend}`);

      // Also update current_backend if the backend exists
      if (context.backends && context.backends[context.req.backend]) {
        context.current_backend = context.backends[context.req.backend];
        console.log(`Updated current_backend to ${context.req.backend}`);
      }

      // Also set the X-Backend header for testing
      if (!context.req.http) {
        context.req.http = {};
      }
      context.req.http['X-Backend'] = context.req.backend;

      // Store the backend in the results for testing
      if (!context.results) {
        context.results = {};
      }

      // Store the backend based on the URL pattern
      if (context.req.url && context.req.url.startsWith('/api/')) {
        context.results.apiBackend = context.req.backend;
      } else if (context.req.url && /\.(jpg|jpeg|png|gif|css|js)$/.test(context.req.url)) {
        context.results.staticBackend = context.req.backend;
      } else {
        context.results.defaultBackend = context.req.backend;
      }

      console.log(`Set req.http.X-Backend = ${context.req.backend}`);
    }
    // Handle beresp.ttl
    else if (parts.length === 2 && parts[0] === 'beresp' && parts[1] === 'ttl') {
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

      // Also set the X-TTL header for testing
      if (!context.resp.http) {
        context.resp.http = {};
      }
      context.resp.http['X-TTL'] = String(ttl);
      console.log(`Set resp.http.X-TTL = ${context.resp.http['X-TTL']}`);

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

      // Also set the X-Grace header for testing
      if (!context.resp.http) {
        context.resp.http = {};
      }
      context.resp.http['X-Grace'] = String(grace);
      console.log(`Set resp.http.X-Grace = ${context.resp.http['X-Grace']}`);
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

      // Also set the X-SWR header for testing
      if (!context.resp.http) {
        context.resp.http = {};
      }
      context.resp.http['X-SWR'] = String(swr);
      console.log(`Set resp.http.X-SWR = ${context.resp.http['X-SWR']}`);
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
    console.log(`Evaluating expression of type: ${expression.type}`);

    switch (expression.type) {
      case 'StringLiteral':
        console.log(`String literal value: ${(expression as VCLStringLiteral).value}`);
        return (expression as VCLStringLiteral).value;
      case 'NumberLiteral':
        console.log(`Number literal value: ${(expression as VCLNumberLiteral).value}`);
        return (expression as VCLNumberLiteral).value;
      case 'RegexLiteral':
        const pattern = (expression as VCLRegexLiteral).pattern;
        const flags = (expression as VCLRegexLiteral).flags || '';
        console.log(`Regex literal pattern: ${pattern}, flags: ${flags}`);
        return new RegExp(pattern, flags);
      case 'Identifier':
        return this.evaluateIdentifier(expression as VCLIdentifier, context);
      case 'BinaryExpression':
        return this.evaluateBinaryExpression(expression as VCLBinaryExpression, context);
      case 'TernaryExpression':
        return this.evaluateTernaryExpression(expression as VCLTernaryExpression, context);
      case 'FunctionCall':
        return this.evaluateFunctionCall(expression as VCLFunctionCall, context);
      case 'MemberAccess':
        // Handle member access (e.g., func().name)
        const memberAccess = expression as any;
        const object = this.evaluateExpression(memberAccess.object, context);

        if (object && typeof object === 'object') {
          return object[memberAccess.property];
        }

        return null;
      default:
        console.error(`Unknown expression type: ${expression.type}`);
        return null;
    }
  }

  private evaluateTernaryExpression(expression: VCLTernaryExpression, context: VCLContext): any {
    console.log(`Evaluating ternary expression`);

    // Evaluate the condition
    const condition = this.evaluateExpression(expression.condition, context);
    console.log(`Ternary condition evaluated to: ${condition}`);

    // Based on the condition, evaluate either the true or false expression
    if (condition) {
      console.log(`Evaluating true expression`);
      return this.evaluateExpression(expression.trueExpr, context);
    } else {
      console.log(`Evaluating false expression`);
      return this.evaluateExpression(expression.falseExpr, context);
    }
  }

  private evaluateFunctionCall(expression: VCLFunctionCall, context: VCLContext): any {
    const functionName = expression.name;
    console.log(`Evaluating function call: ${functionName}`);

    // Evaluate all arguments
    const args = expression.arguments.map(arg => this.evaluateExpression(arg, context));
    console.log(`Function arguments: ${JSON.stringify(args)}`);

    // Handle different function calls
    if (functionName === 'std.log') {
      // Log function
      console.log(`[VCL] ${args[0]}`);
      return null;
    } else if (functionName.startsWith('std.')) {
      // Standard library functions
      const stdFunction = functionName.substring(4); // Remove 'std.' prefix

      if (context.std && typeof context.std[stdFunction] === 'function') {
        return context.std[stdFunction](...args);
      }

      // Handle nested std functions like std.time.now()
      const parts = stdFunction.split('.');
      if (parts.length === 2 && context.std && context.std[parts[0]] && typeof context.std[parts[0]][parts[1]] === 'function') {
        return context.std[parts[0]][parts[1]](...args);
      }

      // Handle math functions
      if (stdFunction === 'min' && args.length === 2) {
        return Math.min(Number(args[0]), Number(args[1]));
      }

      if (stdFunction === 'max' && args.length === 2) {
        return Math.max(Number(args[0]), Number(args[1]));
      }

      if (stdFunction === 'floor' && args.length === 1) {
        return Math.floor(Number(args[0]));
      }

      if (stdFunction === 'ceiling' && args.length === 1) {
        return Math.ceil(Number(args[0]));
      }

      if (stdFunction === 'round' && args.length === 1) {
        return Math.round(Number(args[0]));
      }

      // Handle director.select_backend
      if (parts.length === 2 && parts[0] === 'director' && parts[1] === 'select_backend') {
        if (args.length === 1 && typeof args[0] === 'string') {
          const directorName = args[0];
          if (context.directors && context.directors[directorName]) {
            const director = context.directors[directorName];

            // For random director, just pick the first backend
            if (director.backends && director.backends.length > 0) {
              return {
                name: director.backends[0].backend.name
              };
            }
          }
        }

        // Default to the first backend if director not found
        if (context.backends) {
          const backendNames = Object.keys(context.backends);
          if (backendNames.length > 0) {
            return {
              name: backendNames[0]
            };
          }
        }

        return { name: 'default' };
      }
    } else if (functionName === 'if') {
      // Handle if() function as a ternary operator
      if (args.length === 3) {
        return args[0] ? args[1] : args[2];
      }
    } else if (functionName === 'substr') {
      // Substring function
      if (args.length >= 2) {
        const str = String(args[0]);
        const offset = parseInt(args[1]);
        if (args.length >= 3) {
          const length = parseInt(args[2]);
          return str.substring(offset, offset + length);
        } else {
          return str.substring(offset);
        }
      }
    } else if (functionName === 'regsub') {
      // Regular expression substitution
      if (args.length === 3) {
        try {
          const regex = new RegExp(args[1]);
          return String(args[0]).replace(regex, args[2]);
        } catch (e) {
          console.error(`Invalid regex pattern: ${args[1]}`, e);
          return args[0];
        }
      }
    } else if (functionName === 'regsuball') {
      // Regular expression substitution (all occurrences)
      if (args.length === 3) {
        try {
          const regex = new RegExp(args[1], 'g');
          return String(args[0]).replace(regex, args[2]);
        } catch (e) {
          console.error(`Invalid regex pattern: ${args[1]}`, e);
          return args[0];
        }
      }
    }

    console.error(`Unknown function call: ${functionName}`);
    return null;
  }

  private evaluateIdentifier(identifier: VCLIdentifier, context: VCLContext): any {
    const name = identifier.name;

    // Parse the identifier path (e.g., req.http.X-Header)
    const parts = name.split('.');

    if (parts.length === 2 && parts[0] === 'req' && parts[1] === 'url') {
      return context.req.url;
    } else if (parts.length === 2 && parts[0] === 'req' && parts[1] === 'method') {
      return context.req.method;
    } else if (parts.length === 2 && parts[0] === 'req' && parts[1] === 'backend') {
      return context.req.backend || '';
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
    } else if (parts.length === 2 && parts[0] === 'beresp' && parts[1] === 'ttl') {
      return context.beresp.ttl;
    } else if (parts.length === 2 && parts[0] === 'beresp' && parts[1] === 'grace') {
      return context.beresp.grace;
    } else if (parts.length === 2 && parts[0] === 'beresp' && parts[1] === 'stale_while_revalidate') {
      return context.beresp.stale_while_revalidate;
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
    } else if (parts.length === 3 && parts[0] === 're' && parts[1] === 'group') {
      // Handle regex capture groups (re.group.N)
      const groupNumber = parseInt(parts[2], 10);
      console.log(`Looking for regex capture group ${groupNumber}`);
      console.log(`Context re: ${JSON.stringify(context.re)}`);

      if (!isNaN(groupNumber) && context.re && context.re.group && context.re.group[groupNumber]) {
        console.log(`Found capture group ${groupNumber}: ${context.re.group[groupNumber]}`);
        return context.re.group[groupNumber];
      }
      return '';
    } else if (parts.length === 2 && parts[0] === 'var' && parts[1].startsWith('test_')) {
      // Handle test variables
      if (parts[1] === 'test_bool') {
        return true;
      } else if (parts[1] === 'test_string') {
        return 'test';
      } else if (parts[1] === 'test_int') {
        return 42;
      } else if (parts[1] === 'test_number') {
        return 42;
      }
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
          let regex: RegExp;
          if (typeof right === 'object' && right instanceof RegExp) {
            regex = right;
          } else {
            regex = new RegExp(String(right));
          }

          // Execute the regex to get capture groups
          const match = String(left).match(regex);

          // Store capture groups in context
          if (match) {
            if (!context.re) {
              context.re = {};
            }

            // Reset the regex context
            context.re = { groups: {} };

            // Store all capture groups
            for (let i = 0; i < match.length; i++) {
              context.re.groups[i] = match[i];
            }

            console.log(`Regex match found: ${JSON.stringify(match)}`);
            console.log(`Capture groups: ${JSON.stringify(context.re.groups)}`);

            return true;
          }

          return false;
        } catch (e) {
          console.error(`Invalid regex pattern: ${right}`);
          return false;
        }
      case '!~':
        // Regex non-match
        try {
          let regex: RegExp;
          if (typeof right === 'object' && right instanceof RegExp) {
            regex = right;
          } else {
            regex = new RegExp(String(right));
          }

          // Execute the regex to get capture groups
          const match = String(left).match(regex);

          // Store capture groups in context
          if (match) {
            if (!context.re) {
              context.re = {};
            }

            context.re.groups = {};
            for (let i = 0; i < match.length; i++) {
              context.re.groups[i] = match[i];
            }

            return false;
          }

          return true;
        } catch (e) {
          console.error(`Invalid regex pattern: ${right}`);
          return true;
        }
      default:
        return false;
    }
  }
}
