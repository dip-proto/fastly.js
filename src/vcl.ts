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
    // Logging
    log: (message: string) => {
      console.log(`[VCL] ${message}`);
    },

    // Time functions
    time: (format: string) => {
      return Date.now();
    },
    strftime: (format: string, time: number) => {
      return new Date(time).toISOString();
    },

    // String manipulation
    tolower: (str: string) => {
      return String(str).toLowerCase();
    },
    toupper: (str: string) => {
      return String(str).toUpperCase();
    },
    strlen: (str: string) => {
      return String(str).length;
    },
    strstr: (haystack: string, needle: string) => {
      const index = String(haystack).indexOf(String(needle));
      return index >= 0 ? String(haystack).substring(index) : null;
    },
    substr: (str: string, offset: number, length?: number) => {
      const s = String(str);
      return length !== undefined
        ? s.substring(offset, offset + length)
        : s.substring(offset);
    },
    prefixof: (str: string, prefix: string) => {
      return String(str).startsWith(String(prefix));
    },
    suffixof: (str: string, suffix: string) => {
      return String(str).endsWith(String(suffix));
    },
    replace: (str: string, search: string, replacement: string) => {
      return String(str).replace(String(search), String(replacement));
    },
    replaceall: (str: string, search: string, replacement: string) => {
      return String(str).split(String(search)).join(String(replacement));
    },

    // Regular expressions
    regsub: (str: string, regex: string, replacement: string) => {
      try {
        const re = new RegExp(regex);
        return String(str).replace(re, replacement);
      } catch (e) {
        console.error(`Invalid regex: ${regex}`, e);
        return str;
      }
    },
    regsuball: (str: string, regex: string, replacement: string) => {
      try {
        const re = new RegExp(regex, 'g');
        return String(str).replace(re, replacement);
      } catch (e) {
        console.error(`Invalid regex: ${regex}`, e);
        return str;
      }
    },

    // Type conversion
    integer: (value: any) => {
      return parseInt(String(value), 10) || 0;
    },
    real: (value: any) => {
      return parseFloat(String(value)) || 0.0;
    },

    // Math functions
    math: {
      round: (num: number) => {
        return Math.round(num);
      },
      floor: (num: number) => {
        return Math.floor(num);
      },
      ceil: (num: number) => {
        return Math.ceil(num);
      },
      pow: (base: number, exponent: number) => {
        return Math.pow(base, exponent);
      },
      log: (num: number) => {
        return Math.log(num);
      },
      min: (a: number, b: number) => {
        return Math.min(a, b);
      },
      max: (a: number, b: number) => {
        return Math.max(a, b);
      },
      abs: (num: number) => {
        return Math.abs(num);
      }
    },

    // Encoding/decoding
    base64: (str: string) => {
      return Buffer.from(String(str)).toString('base64');
    },
    base64_decode: (str: string) => {
      try {
        return Buffer.from(String(str), 'base64').toString('utf-8');
      } catch (e) {
        console.error(`Invalid base64 string: ${str}`, e);
        return '';
      }
    },
    base64url: (str: string) => {
      return Buffer.from(String(str))
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
    },
    base64url_decode: (str: string) => {
      try {
        // Add padding if needed
        const padded = String(str).padEnd(
          Math.ceil(String(str).length / 4) * 4,
          '='
        ).replace(/-/g, '+').replace(/_/g, '/');

        return Buffer.from(padded, 'base64').toString('utf-8');
      } catch (e) {
        console.error(`Invalid base64url string: ${str}`, e);
        return '';
      }
    },

    // Digest functions
    digest: {
      hash_md5: (str: string) => {
        const crypto = require('crypto');
        return crypto.createHash('md5').update(String(str)).digest('hex');
      },
      hash_sha1: (str: string) => {
        const crypto = require('crypto');
        return crypto.createHash('sha1').update(String(str)).digest('hex');
      },
      hash_sha256: (str: string) => {
        const crypto = require('crypto');
        return crypto.createHash('sha256').update(String(str)).digest('hex');
      },
      hmac_md5: (key: string, message: string) => {
        const crypto = require('crypto');
        return crypto.createHmac('md5', String(key))
          .update(String(message))
          .digest('hex');
      },
      hmac_sha1: (key: string, message: string) => {
        const crypto = require('crypto');
        return crypto.createHmac('sha1', String(key))
          .update(String(message))
          .digest('hex');
      },
      hmac_sha256: (key: string, message: string) => {
        const crypto = require('crypto');
        return crypto.createHmac('sha256', String(key))
          .update(String(message))
          .digest('hex');
      },
      secure_is_equal: (a: string, b: string) => {
        const crypto = require('crypto');
        try {
          return crypto.timingSafeEqual(
            Buffer.from(String(a)),
            Buffer.from(String(b))
          );
        } catch (e) {
          // If buffers are not the same length, return false
          return false;
        }
      }
    },

    // HTTP functions
    header: {
      get: (headers: Record<string, string>, name: string) => {
        const normalizedName = String(name).toLowerCase();
        for (const [key, value] of Object.entries(headers)) {
          if (key.toLowerCase() === normalizedName) {
            return value;
          }
        }
        return null;
      },
      set: (headers: Record<string, string>, name: string, value: string) => {
        headers[String(name)] = String(value);
      },
      remove: (headers: Record<string, string>, name: string) => {
        const normalizedName = String(name).toLowerCase();
        for (const key of Object.keys(headers)) {
          if (key.toLowerCase() === normalizedName) {
            delete headers[key];
          }
        }
      }
    },

    // Query string functions
    querystring: {
      get: (url: string, name: string) => {
        try {
          const urlObj = new URL(String(url));
          return urlObj.searchParams.get(String(name));
        } catch (e) {
          // If the URL is invalid, try to parse just the query string
          try {
            const queryString = String(url).split('?')[1] || '';
            const params = new URLSearchParams(queryString);
            return params.get(String(name));
          } catch (e) {
            console.error(`Invalid URL or query string: ${url}`, e);
            return null;
          }
        }
      },
      set: (url: string, name: string, value: string) => {
        try {
          const urlObj = new URL(String(url));
          urlObj.searchParams.set(String(name), String(value));
          return urlObj.toString();
        } catch (e) {
          // If the URL is invalid, try to modify just the query string
          try {
            const [base, queryString] = String(url).split('?');
            const params = new URLSearchParams(queryString || '');
            params.set(String(name), String(value));
            return `${base}?${params.toString()}`;
          } catch (e) {
            console.error(`Invalid URL or query string: ${url}`, e);
            return url;
          }
        }
      },
      remove: (url: string, name: string) => {
        try {
          const urlObj = new URL(String(url));
          urlObj.searchParams.delete(String(name));
          return urlObj.toString();
        } catch (e) {
          // If the URL is invalid, try to modify just the query string
          try {
            const [base, queryString] = String(url).split('?');
            const params = new URLSearchParams(queryString || '');
            params.delete(String(name));
            const newQueryString = params.toString();
            return newQueryString ? `${base}?${newQueryString}` : base;
          } catch (e) {
            console.error(`Invalid URL or query string: ${url}`, e);
            return url;
          }
        }
      },
      filter: (url: string, names: string[]) => {
        try {
          const urlObj = new URL(String(url));
          const params = urlObj.searchParams;
          const filteredParams = new URLSearchParams();

          // Only keep parameters in the names array
          for (const name of names) {
            const values = params.getAll(name);
            for (const value of values) {
              filteredParams.append(name, value);
            }
          }

          urlObj.search = filteredParams.toString();
          return urlObj.toString();
        } catch (e) {
          // If the URL is invalid, try to modify just the query string
          try {
            const [base, queryString] = String(url).split('?');
            const params = new URLSearchParams(queryString || '');
            const filteredParams = new URLSearchParams();

            // Only keep parameters in the names array
            for (const name of names) {
              const values = params.getAll(name);
              for (const value of values) {
                filteredParams.append(name, value);
              }
            }

            const newQueryString = filteredParams.toString();
            return newQueryString ? `${base}?${newQueryString}` : base;
          } catch (e) {
            console.error(`Invalid URL or query string: ${url}`, e);
            return url;
          }
        }
      },
      filter_except: (url: string, names: string[]) => {
        try {
          const urlObj = new URL(String(url));
          const params = urlObj.searchParams;
          const filteredParams = new URLSearchParams();

          // Keep all parameters except those in the names array
          for (const [name, value] of params.entries()) {
            if (!names.includes(name)) {
              filteredParams.append(name, value);
            }
          }

          urlObj.search = filteredParams.toString();
          return urlObj.toString();
        } catch (e) {
          // If the URL is invalid, try to modify just the query string
          try {
            const [base, queryString] = String(url).split('?');
            const params = new URLSearchParams(queryString || '');
            const filteredParams = new URLSearchParams();

            // Keep all parameters except those in the names array
            for (const [name, value] of params.entries()) {
              if (!names.includes(name)) {
                filteredParams.append(name, value);
              }
            }

            const newQueryString = filteredParams.toString();
            return newQueryString ? `${base}?${newQueryString}` : base;
          } catch (e) {
            console.error(`Invalid URL or query string: ${url}`, e);
            return url;
          }
        }
      }
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
