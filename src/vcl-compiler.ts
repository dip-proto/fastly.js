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
  // Simple cache for demonstration
  cache: Map<string, any>;
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
      try {
        // Execute each statement in the subroutine
        for (const statement of subroutine.body) {
          const result = this.executeStatement(statement, context);
          
          // If the statement returns a value, return it from the subroutine
          if (result && typeof result === 'string') {
            return result;
          }
        }
        
        // Default return values for each subroutine
        switch (subroutine.name) {
          case 'vcl_recv':
            return 'lookup';
          case 'vcl_hash':
            return 'hash';
          case 'vcl_hit':
          case 'vcl_miss':
          case 'vcl_pass':
            return 'fetch';
          case 'vcl_fetch':
          case 'vcl_deliver':
          case 'vcl_error':
            return 'deliver';
          default:
            return '';
        }
      } catch (error) {
        console.error(`Error executing subroutine ${subroutine.name}:`, error);
        
        // Handle errors based on the subroutine
        switch (subroutine.name) {
          case 'vcl_recv':
          case 'vcl_hash':
          case 'vcl_hit':
          case 'vcl_miss':
          case 'vcl_pass':
            return 'error';
          case 'vcl_fetch':
            return 'error';
          case 'vcl_deliver':
            return 'deliver';
          case 'vcl_error':
            return 'deliver';
          default:
            return '';
        }
      }
    };
  }
  
  private executeStatement(statement: VCLStatement, context: VCLContext): string | void {
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
      default:
        // Unknown statement type
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
    const value = this.evaluateExpression(statement.value, context);
    
    // Parse the target path (e.g., req.http.X-Header)
    const parts = statement.target.split('.');
    
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
      const ttlStr = String(value);
      let ttl = 0;
      
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
      
      context.beresp.ttl = ttl;
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
    // This is a placeholder for hash_data functionality
    // In a real implementation, this would update the cache key
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
