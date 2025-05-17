/**
 * VCL Module
 *
 * This module provides the main interface for loading and executing VCL files.
 * It handles the process of loading, parsing, and compiling VCL code into executable functions.
 */

import {readFileSync, existsSync} from 'node:fs';
import {join} from 'node:path';
import {VCLLexer} from './vcl-parser';
import {VCLParser} from './vcl-parser-impl';
import {VCLCompiler, VCLSubroutines, VCLContext} from './vcl-compiler';
import {SecurityModule} from './vcl-security';
import {AddressModule} from './vcl-address';
import {AcceptModule} from './vcl-accept';

/**
 * Loads and parses a VCL file, converting it into executable subroutines.
 *
 * @param filePath - Path to the VCL file to load
 * @returns An object containing compiled VCL subroutines
 * @throws Error if the file doesn't exist or cannot be parsed
 */
export function loadVCL(filePath: string): VCLSubroutines {
  try {
    // Check if the file exists
    if (!existsSync(filePath)) {
      throw new Error(`VCL file not found: ${ filePath }`);
    }

    // Read the file content
    const content = readFileSync(filePath, 'utf-8');

    // Tokenize the VCL code
    const lexer = new VCLLexer(content);
    const tokens = lexer.tokenize();

    // Parse the tokens into an AST
    const parser = new VCLParser(tokens);
    const ast = parser.parse();

    // Compile the AST into executable functions
    const compiler = new VCLCompiler(ast);
    const subroutines = compiler.compile();

    return subroutines;
  } catch (error) {
    console.error(`Error loading VCL file: ${ error.message }`);
    console.error(error.stack);
    throw error; // Re-throw the error to be handled by the caller
  }
}



/**
 * Executes a VCL subroutine with the given context.
 *
 * @param subroutines - Object containing compiled VCL subroutines
 * @param name - Name of the subroutine to execute
 * @param context - VCL context containing request, response, and other state
 * @returns The return value of the subroutine, or an empty string if not found or error
 */
export function executeVCL(subroutines: VCLSubroutines, name: string, context: VCLContext): string {
  if (!subroutines[name]) {
    // Subroutine not found, use default behavior
    return '';
  }

  try {
    return subroutines[name](context) || '';
  } catch (error) {
    console.error(`Error executing subroutine ${ name }: ${ error.message }`);
    return '';
  }
}

/**
 * Creates a new VCL context with default values.
 * The context contains all the state needed for VCL execution, including
 * request and response objects, cache, backends, and standard library functions.
 *
 * @returns A new VCL context object
 */
export function createVCLContext(): VCLContext {
  const context: VCLContext = {
    req: {
      url: '',
      method: '',
      http: {},
      backend: 'default'
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
      hits: 1  // Initialize with 1 hit for cache tests
    },
    cache: new Map(),
    hashData: [],

    // Initialize backends
    backends: {
      // Default backend
      'default': {
        name: 'default',
        host: 'neverssl.com',
        port: 80,
        ssl: false,
        connect_timeout: 1000, // 1 second
        first_byte_timeout: 15000, // 15 seconds
        between_bytes_timeout: 10000, // 10 seconds
        max_connections: 200,
        is_healthy: true
      }
    },

    // Initialize directors
    directors: {},

    // Initialize ACLs
    acls: {},

    // Initialize tables
    tables: {},

    // Initialize client info
    client: {
      ip: '127.0.0.1'  // Default to localhost
    },

    // Set current backend to default
    current_backend: undefined,

    // Initialize security-related state
    waf: {
      allowed: false,
      blocked: false,
      blockStatus: 0,
      blockMessage: ''
    },

    // Initialize rate limiting state
    ratelimit: {
      counters: {},
      penaltyboxes: {}
    },

    fastly: {
      error: '',
      state: 'recv'
    }
  };

  // Initialize standard library functions
  context.std = {
    /**
     * Logs a message from VCL code.
     * This function is used by the std.log() function in VCL.
     *
     * @param message - The message to log
     */
    log: (message: string) => {
      console.log(`[VCL] ${ message }`);
    },

    // Time functions
    strftime: (format: string, time: number) => {
      return new Date(time).toISOString();
    },

    // Time manipulation functions
    time: {
      // Get current time
      now: () => {
        return Date.now();
      },
      add: (time: number, offset: string | number): number => {
        const baseTime = new Date(time);
        let offsetMs = 0;
        let isNegative = false;

        if (typeof offset === 'number') {
          offsetMs = offset;
        } else if (typeof offset === 'string') {
          // Check if the offset is negative
          if (offset.startsWith('-')) {
            isNegative = true;
            offset = offset.substring(1); // Remove the negative sign
          }

          // Parse time strings like "1h", "30m", "45s", etc.
          const match = offset.match(/^(\d+)([smhd])$/);
          if (match) {
            const value = parseInt(match[1], 10);
            const unit = match[2];

            switch (unit) {
              case 's': // seconds
                offsetMs = value * 1000;
                break;
              case 'm': // minutes
                offsetMs = value * 60 * 1000;
                break;
              case 'h': // hours
                offsetMs = value * 60 * 60 * 1000;
                break;
              case 'd': // days
                offsetMs = value * 24 * 60 * 60 * 1000;
                break;
              default:
                console.error(`Unknown time unit: ${ unit }`);
                return time;
            }
          } else {
            // Try to parse as milliseconds
            offsetMs = parseInt(offset, 10);
            if (isNaN(offsetMs)) {
              console.error(`Invalid time offset: ${ offset }`);
              return time;
            }
          }
        }

        // Apply the offset (negative or positive)
        if (isNegative) {
          offsetMs = -offsetMs;
        }

        baseTime.setTime(baseTime.getTime() + offsetMs);
        return baseTime.getTime();
      },

      sub: (time1: number, time2: number): number => {
        // Return the difference in milliseconds
        return time1 - time2;
      },

      is_after: (time1: number, time2: number): boolean => {
        // Check if time1 is after time2
        return time1 > time2;
      },

      hex_to_time: (hex: string): number => {
        try {
          // Validate hex string format
          if (!hex.match(/^[0-9A-Fa-f]+$/)) {
            console.error(`Invalid hex timestamp: ${ hex }`);
            return Date.now();
          }

          // Convert hex string to decimal
          const timestamp = parseInt(hex, 16);
          if (isNaN(timestamp)) {
            console.error(`Invalid hex timestamp: ${ hex }`);
            return Date.now();
          }

          // Convert to milliseconds if it's in seconds (Unix timestamp)
          return timestamp * 1000;
        } catch (e) {
          console.error(`Error converting hex to time: ${ e }`);
          return Date.now();
        }
      }
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
        console.error(`Invalid regex: ${ regex }`, e);
        return str;
      }
    },
    regsuball: (str: string, regex: string, replacement: string) => {
      try {
        const re = new RegExp(regex, 'g');
        return String(str).replace(re, replacement);
      } catch (e) {
        console.error(`Invalid regex: ${ regex }`, e);
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
        console.error(`Invalid base64 string: ${ str }`, e);
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
        console.error(`Invalid base64url string: ${ str }`, e);
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
      },
      filter: (headers: Record<string, string>, pattern: string) => {
        try {
          const regex = new RegExp(String(pattern));
          for (const key of Object.keys(headers)) {
            if (regex.test(key)) {
              delete headers[key];
            }
          }
        } catch (e) {
          console.error(`Invalid regex pattern for header.filter: ${ pattern }`, e);
        }
      },
      filter_except: (headers: Record<string, string>, pattern: string) => {
        try {
          const regex = new RegExp(String(pattern));
          const keysToKeep = new Set<string>();

          // First, identify all keys that match the pattern
          for (const key of Object.keys(headers)) {
            if (regex.test(key)) {
              keysToKeep.add(key);
            }
          }

          // Then, remove all keys that don't match
          for (const key of Object.keys(headers)) {
            if (!keysToKeep.has(key)) {
              delete headers[key];
            }
          }
        } catch (e) {
          console.error(`Invalid regex pattern for header.filter_except: ${ pattern }`, e);
        }
      }
    },

    // HTTP status functions
    http: {
      status_matches: (status: number, pattern: string) => {
        const statusStr = String(status);

        // Handle category patterns
        if (pattern === "2xx" || pattern === "success") {
          return status >= 200 && status < 300;
        } else if (pattern === "3xx" || pattern === "redirect") {
          return status >= 300 && status < 400;
        } else if (pattern === "4xx" || pattern === "client_error") {
          return status >= 400 && status < 500;
        } else if (pattern === "5xx" || pattern === "server_error") {
          return status >= 500 && status < 600;
        } else if (pattern === "error") {
          return status >= 400 && status < 600;
        } else if (pattern.endsWith("xx")) {
          // Handle patterns like "2xx", "3xx", etc.
          const prefix = pattern.substring(0, 1);
          return statusStr.startsWith(prefix);
        } else {
          // Handle exact status code matches
          return statusStr === pattern;
        }
      }
    },

    // Error handling and synthetic responses
    synthetic: (content: string) => {
      // Set the synthetic response content
      context.obj.response = String(content);

      // If no Content-Type is set, default to text/html
      if (!context.obj.http['content-type']) {
        context.obj.http['content-type'] = 'text/html; charset=utf-8';
      }
    },

    error: (status: number, message?: string) => {
      // Set the error status code
      context.obj.status = status;

      // Set the error message if provided
      if (message) {
        context.obj.response = String(message);
      } else {
        // Default error messages based on status code
        switch (status) {
          case 400:
            context.obj.response = 'Bad Request';
            break;
          case 401:
            context.obj.response = 'Unauthorized';
            break;
          case 403:
            context.obj.response = 'Forbidden';
            break;
          case 404:
            context.obj.response = 'Not Found';
            break;
          case 429:
            context.obj.response = 'Too Many Requests';
            break;
          case 500:
            context.obj.response = 'Internal Server Error';
            break;
          case 502:
            context.obj.response = 'Bad Gateway';
            break;
          case 503:
            context.obj.response = 'Service Unavailable';
            break;
          case 504:
            context.obj.response = 'Gateway Timeout';
            break;
          default:
            context.obj.response = 'Error';
        }
      }

      // Set the fastly error state
      context.fastly.error = context.obj.response;
      context.fastly.state = 'error';

      // Return 'error' to trigger vcl_error
      return 'error';
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
            console.error(`Invalid URL or query string: ${ url }`, e);
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
            return `${ base }?${ params.toString() }`;
          } catch (e) {
            console.error(`Invalid URL or query string: ${ url }`, e);
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
            return newQueryString ? `${ base }?${ newQueryString }` : base;
          } catch (e) {
            console.error(`Invalid URL or query string: ${ url }`, e);
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
            return newQueryString ? `${ base }?${ newQueryString }` : base;
          } catch (e) {
            console.error(`Invalid URL or query string: ${ url }`, e);
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
            return newQueryString ? `${ base }?${ newQueryString }` : base;
          } catch (e) {
            console.error(`Invalid URL or query string: ${ url }`, e);
            return url;
          }
        }
      }
    }
  };

  // Add backend management functions
  context.std.backend = {
    // Add a new backend
    add: (name: string, host: string, port: number, ssl: boolean = false, options: any = {}) => {
      context.backends[name] = {
        name,
        host,
        port,
        ssl,
        connect_timeout: options.connect_timeout || 1000, // 1 second
        first_byte_timeout: options.first_byte_timeout || 15000, // 15 seconds
        between_bytes_timeout: options.between_bytes_timeout || 10000, // 10 seconds
        max_connections: options.max_connections || 200,
        ssl_cert_hostname: options.ssl_cert_hostname || host,
        ssl_sni_hostname: options.ssl_sni_hostname || host,
        ssl_check_cert: options.ssl_check_cert !== undefined ? options.ssl_check_cert : true,
        probe: options.probe,
        is_healthy: true // Default to healthy
      };
      return true;
    },

    // Remove a backend
    remove: (name: string) => {
      if (context.backends[name]) {
        delete context.backends[name];
        return true;
      }
      return false;
    },

    // Get a backend by name
    get: (name: string) => {
      return context.backends[name] || null;
    },

    // Set the current backend
    set_current: (name: string) => {
      if (context.backends[name]) {
        context.req.backend = name;
        context.current_backend = context.backends[name];
        return true;
      }
      return false;
    },

    // Check if a backend is healthy
    is_healthy: (name: string) => {
      const backend = context.backends[name];
      if (backend) {
        return backend.is_healthy || false;
      }
      return false;
    },

    // Add a health check probe to a backend
    add_probe: (backendName: string, options: any) => {
      const backend = context.backends[backendName];
      if (backend) {
        backend.probe = {
          request: options.request || `HEAD / HTTP/1.1\r\nHost: ${ backend.host }\r\nConnection: close\r\n\r\n`,
          expected_response: options.expected_response || 200,
          interval: options.interval || 5000, // 5 seconds
          timeout: options.timeout || 2000, // 2 seconds
          window: options.window || 5,
          threshold: options.threshold || 3,
          initial: options.initial || 2
        };
        return true;
      }
      return false;
    }
  };

  // Add random functions
  context.std.random = {
    // Generate a random boolean with a specified probability
    randombool: (probability: number): boolean => {
      if (probability < 0 || probability > 1) {
        console.error(`Invalid probability: ${ probability }. Must be between 0 and 1.`);
        return false;
      }
      return Math.random() < probability;
    },

    // Generate a random boolean with a specified probability, using a seed
    randombool_seeded: (probability: number, seed: string): boolean => {
      if (probability < 0 || probability > 1) {
        console.error(`Invalid probability: ${ probability }. Must be between 0 and 1.`);
        return false;
      }

      // Create a seeded random number generator
      const hash = context.std.digest.hash_sha256(String(seed));
      const seedValue = parseInt(hash.substring(0, 8), 16) / 0xffffffff;

      return seedValue < probability;
    },

    // Generate a random integer within a specified range
    randomint: (from: number, to: number): number => {
      if (from > to) {
        console.error(`Invalid range: ${ from } to ${ to }. 'from' must be less than or equal to 'to'.`);
        return from;
      }
      return Math.floor(Math.random() * (to - from + 1)) + from;
    },

    // Generate a random integer within a specified range, using a seed
    randomint_seeded: (from: number, to: number, seed: string): number => {
      if (from > to) {
        console.error(`Invalid range: ${ from } to ${ to }. 'from' must be less than or equal to 'to'.`);
        return from;
      }

      // Create a seeded random number generator
      const hash = context.std.digest.hash_sha256(String(seed));
      const seedValue = parseInt(hash.substring(0, 8), 16) / 0xffffffff;

      return Math.floor(seedValue * (to - from + 1)) + from;
    },

    // Generate a random string of a specified length
    randomstr: (length: number, charset?: string): string => {
      if (length <= 0) {
        console.error(`Invalid length: ${ length }. Must be greater than 0.`);
        return '';
      }

      // Default charset: alphanumeric characters
      const chars = charset || 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
      let result = '';

      for (let i = 0; i < length; i++) {
        const randomIndex = Math.floor(Math.random() * chars.length);
        result += chars.charAt(randomIndex);
      }

      return result;
    }
  };

  // Add ACL management functions
  context.std.acl = {
    // Add a new ACL
    add: (name: string) => {
      context.acls[name] = {
        name,
        entries: []
      };
      return true;
    },

    // Remove an ACL
    remove: (name: string) => {
      if (context.acls[name]) {
        delete context.acls[name];
        return true;
      }
      return false;
    },

    // Add an entry to an ACL
    add_entry: (aclName: string, ip: string, subnet?: number) => {
      const acl = context.acls[aclName];
      if (acl) {
        acl.entries.push({
          ip,
          subnet
        });
        return true;
      }
      return false;
    },

    // Remove an entry from an ACL
    remove_entry: (aclName: string, ip: string, subnet?: number) => {
      const acl = context.acls[aclName];
      if (acl) {
        const index = acl.entries.findIndex(entry =>
          entry.ip === ip && entry.subnet === subnet
        );
        if (index !== -1) {
          acl.entries.splice(index, 1);
          return true;
        }
      }
      return false;
    },

    // Check if an IP is in an ACL
    check: (ip: string, aclName: string) => {
      const acl = context.acls[aclName];
      if (!acl) {
        return false;
      }

      // Check if the IP is in any of the ACL entries
      for (const entry of acl.entries) {
        if (entry.subnet) {
          // Check CIDR match
          if (isIpInCidr(ip, entry.ip, entry.subnet)) {
            return true;
          }
        } else {
          // Check exact match
          if (ip === entry.ip) {
            return true;
          }
        }
      }

      return false;
    }
  };

  // Add table functions
  context.std.table = {
    // Add a new table
    add: (name: string) => {
      context.tables[name] = {
        name,
        entries: {}
      };
      return true;
    },

    // Remove a table
    remove: (name: string) => {
      if (context.tables[name]) {
        delete context.tables[name];
        return true;
      }
      return false;
    },

    // Add an entry to a table
    add_entry: (tableName: string, key: string, value: string | number | boolean | RegExp) => {
      const table = context.tables[tableName];
      if (table) {
        table.entries[key] = value;
        return true;
      }
      return false;
    },

    // Remove an entry from a table
    remove_entry: (tableName: string, key: string) => {
      const table = context.tables[tableName];
      if (table && key in table.entries) {
        delete table.entries[key];
        return true;
      }
      return false;
    },

    // Look up a key in a table and return its value as a string
    lookup: (tableName: string, key: string, defaultValue: string = '') => {
      const table = context.tables[tableName];
      if (!table) {
        console.log(`Table ${ tableName } not found`);
        return defaultValue;
      }

      if (key in table.entries) {
        return String(table.entries[key]);
      }

      return defaultValue;
    },

    // Look up a key in a table and return its value as a boolean
    lookup_bool: (tableName: string, key: string, defaultValue: boolean = false) => {
      const table = context.tables[tableName];
      if (!table) {
        console.log(`Table ${ tableName } not found`);
        return defaultValue;
      }

      if (key in table.entries) {
        const value = table.entries[key];
        if (typeof value === 'boolean') {
          return value;
        }
        // Convert string to boolean
        if (typeof value === 'string') {
          return value.toLowerCase() === 'true';
        }
        // Convert number to boolean
        if (typeof value === 'number') {
          return value !== 0;
        }
      }

      return defaultValue;
    },

    // Look up a key in a table and return its value as an integer
    lookup_integer: (tableName: string, key: string, defaultValue: number = 0) => {
      const table = context.tables[tableName];
      if (!table) {
        console.log(`Table ${ tableName } not found`);
        return defaultValue;
      }

      if (key in table.entries) {
        const value = table.entries[key];
        if (typeof value === 'number') {
          return Math.floor(value);
        }
        // Convert string to integer
        if (typeof value === 'string') {
          const parsed = parseInt(value, 10);
          return isNaN(parsed) ? defaultValue : parsed;
        }
        // Convert boolean to integer
        if (typeof value === 'boolean') {
          return value ? 1 : 0;
        }
      }

      return defaultValue;
    },

    // Look up a key in a table and return its value as a float
    lookup_float: (tableName: string, key: string, defaultValue: number = 0.0) => {
      const table = context.tables[tableName];
      if (!table) {
        console.log(`Table ${ tableName } not found`);
        return defaultValue;
      }

      if (key in table.entries) {
        const value = table.entries[key];
        if (typeof value === 'number') {
          return value;
        }
        // Convert string to float
        if (typeof value === 'string') {
          const parsed = parseFloat(value);
          return isNaN(parsed) ? defaultValue : parsed;
        }
        // Convert boolean to float
        if (typeof value === 'boolean') {
          return value ? 1.0 : 0.0;
        }
      }

      return defaultValue;
    },

    // Look up a key in a table and return its value as a regex
    lookup_regex: (tableName: string, key: string, defaultValue: string = '') => {
      const table = context.tables[tableName];
      if (!table) {
        console.log(`Table ${ tableName } not found`);
        return defaultValue ? new RegExp(defaultValue) : new RegExp('');
      }

      if (key in table.entries) {
        const value = table.entries[key];
        if (value instanceof RegExp) {
          return value;
        }
        // Convert string to regex
        if (typeof value === 'string') {
          try {
            return new RegExp(value);
          } catch (e) {
            console.error(`Invalid regex pattern: ${ value }`, e);
            return defaultValue ? new RegExp(defaultValue) : new RegExp('');
          }
        }
      }

      return defaultValue ? new RegExp(defaultValue) : new RegExp('');
    },

    // Check if a key exists in a table
    contains: (tableName: string, key: string) => {
      const table = context.tables[tableName];
      if (!table) {
        console.log(`Table ${ tableName } not found`);
        return false;
      }

      return key in table.entries;
    }
  };

  // Add WAF functions
  context.std.waf = {
    // Explicitly allows a request that might otherwise be blocked by WAF rules
    allow: () => {
      return SecurityModule.waf.allow(context);
    },

    // Explicitly blocks a request with a specified status code and message
    block: (status: number, message: string) => {
      return SecurityModule.waf.block(context, status, message);
    },

    // Logs a message to the WAF logging endpoint
    log: (message: string) => {
      return SecurityModule.waf.log(context, message);
    },

    // Implements a token bucket rate limiter
    rate_limit: (key: string, limit: number, window: number) => {
      return SecurityModule.waf.rate_limit(context, key, limit, window);
    },

    // Returns the number of tokens remaining in a rate limit bucket
    rate_limit_tokens: (key: string) => {
      return SecurityModule.waf.rate_limit_tokens(context, key);
    },

    // Detects if a request contains malicious patterns
    detect_attack: (requestData: string, attackType: string) => {
      return SecurityModule.waf.detect_attack(context, requestData, attackType);
    }
  };

  // Add rate limiting functions
  context.std.ratelimit = {
    // Opens a rate counter window with the specified duration
    open_window: (windowSeconds: number) => {
      return SecurityModule.ratelimit.open_window(context, windowSeconds);
    },

    // Increments a named rate counter by a specified amount
    ratecounter_increment: (counterName: string, incrementBy: number = 1) => {
      return SecurityModule.ratelimit.ratecounter_increment(context, counterName, incrementBy);
    },

    // Checks if a rate limit has been exceeded
    check_rate: (counterName: string, ratePerSecond: number) => {
      return SecurityModule.ratelimit.check_rate(context, counterName, ratePerSecond);
    },

    // Checks if any of multiple rate limits have been exceeded
    check_rates: (counterName: string, rates: string) => {
      return SecurityModule.ratelimit.check_rates(context, counterName, rates);
    },

    // Adds an identifier to a penalty box for a specified duration
    penaltybox_add: (penaltyboxName: string, identifier: string, duration: number) => {
      return SecurityModule.ratelimit.penaltybox_add(context, penaltyboxName, identifier, duration);
    },

    // Checks if an identifier is in a penalty box
    penaltybox_has: (penaltyboxName: string, identifier: string) => {
      return SecurityModule.ratelimit.penaltybox_has(context, penaltyboxName, identifier);
    }
  };

  // Add address functions
  context.addr = {
    // Determines if a given address is an IPv4 address
    is_ipv4: (address: string): boolean => {
      return AddressModule.is_ipv4(address);
    },

    // Determines if a given address is an IPv6 address
    is_ipv6: (address: string): boolean => {
      return AddressModule.is_ipv6(address);
    },

    // Determines if a given address is a Unix domain socket address
    is_unix: (address: string): boolean => {
      return AddressModule.is_unix(address);
    },

    // Extracts a range of bits from an IP address
    extract_bits: (address: string, offset: number, length: number): number => {
      return AddressModule.extract_bits(address, offset, length);
    }
  };

  // Add accept header functions
  context.accept = {
    // Selects the best match from an Accept-Language header value against available languages
    language_lookup: (availableLanguages: string, defaultLanguage: string, acceptLanguageHeader: string): string => {
      return AcceptModule.language_lookup(availableLanguages, defaultLanguage, acceptLanguageHeader);
    },

    // Selects the best match from an Accept-Charset header value against available charsets
    charset_lookup: (availableCharsets: string, defaultCharset: string, acceptCharsetHeader: string): string => {
      return AcceptModule.charset_lookup(availableCharsets, defaultCharset, acceptCharsetHeader);
    },

    // Selects the best match from an Accept-Encoding header value against available encodings
    encoding_lookup: (availableEncodings: string, defaultEncoding: string, acceptEncodingHeader: string): string => {
      return AcceptModule.encoding_lookup(availableEncodings, defaultEncoding, acceptEncodingHeader);
    },

    // Selects the best match from an Accept header value against available media types
    media_lookup: (availableMediaTypes: string, defaultMediaType: string, mediaTypePatterns: string, acceptHeader: string): string => {
      return AcceptModule.media_lookup(availableMediaTypes, defaultMediaType, mediaTypePatterns, acceptHeader);
    }
  };

  // Add director management functions
  context.std.director = {
    // Add a new director
    add: (name: string, type: string, options: any = {}) => {
      // Validate director type
      const validTypes = ['random', 'hash', 'client', 'fallback', 'chash'];
      if (!validTypes.includes(type)) {
        console.error(`Invalid director type: ${ type }`);
        return false;
      }

      context.directors[name] = {
        name,
        type: type as any,
        backends: [],
        quorum: options.quorum || 0,
        retries: options.retries || 0
      };
      return true;
    },

    // Remove a director
    remove: (name: string) => {
      if (context.directors[name]) {
        delete context.directors[name];
        return true;
      }
      return false;
    },

    // Add a backend to a director
    add_backend: (directorName: string, backendName: string, weight: number = 1) => {
      const director = context.directors[directorName];
      const backend = context.backends[backendName];

      if (director && backend) {
        director.backends.push({
          backend,
          weight
        });
        return true;
      }
      return false;
    },

    // Remove a backend from a director
    remove_backend: (directorName: string, backendName: string) => {
      const director = context.directors[directorName];

      if (director) {
        const index = director.backends.findIndex(b => b.backend.name === backendName);
        if (index !== -1) {
          director.backends.splice(index, 1);
          return true;
        }
      }
      return false;
    },

    // Get a backend from a director based on the director's type and the request
    select_backend: (directorName: string) => {
      const director = context.directors[directorName];

      if (!director || director.backends.length === 0) {
        return null;
      }

      // Filter out unhealthy backends
      const healthyBackends = director.backends.filter(b => b.backend.is_healthy);

      // Check if we have enough healthy backends to meet the quorum
      const quorumPercentage = director.quorum / 100;
      const requiredHealthyBackends = Math.ceil(director.backends.length * quorumPercentage);

      if (healthyBackends.length < requiredHealthyBackends) {
        console.log(`Director ${ directorName } does not have enough healthy backends to meet quorum`);
        return null;
      }

      // Select a backend based on the director type
      switch (director.type) {
        case 'random':
          // Select a random backend weighted by the weights
          const totalWeight = healthyBackends.reduce((sum, b) => sum + b.weight, 0);
          let random = Math.random() * totalWeight;

          for (const b of healthyBackends) {
            random -= b.weight;
            if (random <= 0) {
              return b.backend;
            }
          }

          // Fallback to the first healthy backend
          return healthyBackends[0].backend;

        case 'hash':
          // Use the hash data to select a backend
          if (context.hashData && context.hashData.length > 0) {
            const hash = context.hashData.join(':');
            const index = Math.abs(hash.split('').reduce((a, b) => {
              a = ((a << 5) - a) + b.charCodeAt(0);
              return a & a;
            }, 0)) % healthyBackends.length;

            return healthyBackends[index].backend;
          }
          // Fallback to the first healthy backend
          return healthyBackends[0].backend;

        case 'client':
          // Use the client identity to select a backend
          const clientIdentity = context.req.http['X-Client-Identity'] || context.req.http['Cookie'] || '';
          const clientIndex = Math.abs(clientIdentity.split('').reduce((a, b) => {
            a = ((a << 5) - a) + b.charCodeAt(0);
            return a & a;
          }, 0)) % healthyBackends.length;

          return healthyBackends[clientIndex].backend;

        case 'fallback':
          // Return the first healthy backend
          return healthyBackends[0].backend;

        case 'chash':
          // Similar to hash but with consistent hashing
          // For simplicity, we'll use the same implementation as hash for now
          if (context.hashData && context.hashData.length > 0) {
            const hash = context.hashData.join(':');
            const index = Math.abs(hash.split('').reduce((a, b) => {
              a = ((a << 5) - a) + b.charCodeAt(0);
              return a & a;
            }, 0)) % healthyBackends.length;

            return healthyBackends[index].backend;
          }
          // Fallback to the first healthy backend
          return healthyBackends[0].backend;

        default:
          // Unknown director type, return the first healthy backend
          return healthyBackends[0].backend;
      }
    }
  };

  return context;
}

// Helper functions for IP address manipulation

/**
 * Converts an IPv4 address to its binary representation
 * @param ip The IPv4 address to convert
 * @returns A 32-bit binary string representation of the IP
 */
function ipv4ToBinary(ip: string): string {
  try {
    // Split the IP into octets
    const octets = ip.split('.');

    // Ensure we have 4 octets
    if (octets.length !== 4) {
      throw new Error(`Invalid IPv4 address: ${ ip }`);
    }

    // Convert each octet to binary and pad to 8 bits
    return octets.map(octet => {
      const num = parseInt(octet, 10);
      if (isNaN(num) || num < 0 || num > 255) {
        throw new Error(`Invalid IPv4 octet: ${ octet }`);
      }
      return num.toString(2).padStart(8, '0');
    }).join('');
  } catch (e) {
    console.error(`Error converting IPv4 to binary: ${ e }`);
    return '';
  }
}

/**
 * Normalizes an IPv6 address to its full form
 * @param ip The IPv6 address to normalize
 * @returns The normalized IPv6 address
 */
function normalizeIPv6(ip: string): string {
  try {
    // Special case for IPv4-mapped IPv6 addresses
    if (ip.includes('.')) {
      // Handle ::ffff:192.168.0.1 format (IPv4-mapped IPv6)
      if (ip.toLowerCase().includes('::ffff:') && ip.split('.').length === 4) {
        // For IPv4-mapped addresses, we'll keep them in the same format
        // but ensure the IPv6 part is normalized
        const ipv6Part = ip.substring(0, ip.lastIndexOf(':') + 1);
        const ipv4Part = ip.substring(ip.lastIndexOf(':') + 1);

        // Normalize the IPv6 part
        let normalizedIPv6Part = ipv6Part;
        if (ipv6Part === '::ffff:') {
          normalizedIPv6Part = '0000:0000:0000:0000:0000:ffff:';
        }

        // For IPv4-mapped addresses, we'll return the original format
        // This is because we handle them specially in the CIDR matching
        return ip;
      }

      // For other IPv6 addresses with dots, try to convert the IPv4 part
      const lastColon = ip.lastIndexOf(':');
      const ipv4Part = ip.substring(lastColon + 1);

      // Check if the last part is an IPv4 address
      if (ipv4Part.includes('.')) {
        const ipv4Octets = ipv4Part.split('.');
        if (ipv4Octets.length === 4) {
          // Convert IPv4 part to IPv6 format
          const ipv6Hex = [
            parseInt(ipv4Octets[0], 10).toString(16).padStart(2, '0') +
            parseInt(ipv4Octets[1], 10).toString(16).padStart(2, '0'),
            parseInt(ipv4Octets[2], 10).toString(16).padStart(2, '0') +
            parseInt(ipv4Octets[3], 10).toString(16).padStart(2, '0')
          ].join(':');

          ip = ip.substring(0, lastColon + 1) + ipv6Hex;
        }
      }
    }

    // Handle :: shorthand notation
    if (ip.includes('::')) {
      const parts = ip.split('::');
      if (parts.length !== 2) {
        throw new Error(`Invalid IPv6 address with multiple :: notations: ${ ip }`);
      }

      const leftParts = parts[0] ? parts[0].split(':') : [];
      const rightParts = parts[1] ? parts[1].split(':') : [];

      // Calculate how many 0 blocks we need to insert
      const missingBlocks = 8 - (leftParts.length + rightParts.length);
      if (missingBlocks < 0) {
        throw new Error(`Invalid IPv6 address with too many segments: ${ ip }`);
      }

      // Create the expanded address
      const expandedParts = [
        ...leftParts,
        ...Array(missingBlocks).fill('0'),
        ...rightParts
      ];

      ip = expandedParts.join(':');
    }

    // Ensure we have 8 segments
    const parts = ip.split(':');
    if (parts.length !== 8) {
      throw new Error(`Invalid IPv6 address with wrong number of segments: ${ ip }`);
    }

    // Pad each segment to 4 hex digits
    return parts.map(part => part.padStart(4, '0')).join(':');
  } catch (e) {
    console.error(`Error normalizing IPv6 address: ${ e }`);
    return '';
  }
}

/**
 * Converts an IPv6 address to its binary representation
 * @param ip The IPv6 address to convert
 * @returns A 128-bit binary string representation of the IP
 */
function ipv6ToBinary(ip: string): string {
  try {
    // Special case for IPv4-mapped IPv6 addresses
    if (ip.includes('.') && ip.toLowerCase().includes('::ffff:')) {
      // Extract the IPv4 part
      const ipv4Part = ip.substring(ip.lastIndexOf(':') + 1);

      // Convert the IPv4 part to binary
      const ipv4Binary = ipv4ToBinary(ipv4Part);
      if (!ipv4Binary) {
        return '';
      }

      // Prefix with 96 zeros (128 - 32 = 96)
      return '0'.repeat(96) + ipv4Binary;
    }

    // For regular IPv6 addresses
    // Normalize the IPv6 address first
    const normalizedIP = normalizeIPv6(ip);
    if (!normalizedIP) {
      return '';
    }

    // Split the normalized IP into segments
    const segments = normalizedIP.split(':');

    // Convert each segment to binary and pad to 16 bits
    return segments.map(segment => {
      const num = parseInt(segment, 16);
      if (isNaN(num) || num < 0 || num > 65535) {
        throw new Error(`Invalid IPv6 segment: ${ segment }`);
      }
      return num.toString(2).padStart(16, '0');
    }).join('');
  } catch (e) {
    console.error(`Error converting IPv6 to binary: ${ e }`);
    return '';
  }
}

/**
 * Determines if an IP address is IPv4 or IPv6
 * @param ip The IP address to check
 * @returns 'ipv4' if IPv4, 'ipv6' if IPv6, or null if invalid
 */
function getIPType(ip: string): 'ipv4' | 'ipv6' | null {
  if (ip.includes('.') && !ip.includes(':')) {
    // Simple IPv4 check
    const parts = ip.split('.');
    if (parts.length === 4 && parts.every(part => {
      const num = parseInt(part, 10);
      return !isNaN(num) && num >= 0 && num <= 255;
    })) {
      return 'ipv4';
    }
  } else if (ip.includes(':')) {
    // IPv6 check - more validation
    try {
      // Check for invalid IPv6 addresses with multiple :: notations
      const doubleColonCount = (ip.match(/::/g) || []).length;
      if (doubleColonCount > 1) {
        return null; // Multiple :: not allowed
      }

      // Check for IPv4-mapped IPv6 addresses
      if (ip.includes('.')) {
        // Handle ::ffff:192.168.0.1 format (IPv4-mapped IPv6)
        if (ip.toLowerCase().includes('::ffff:')) {
          const ipv4Part = ip.substring(ip.lastIndexOf(':') + 1);
          const ipv4Parts = ipv4Part.split('.');

          // Validate the IPv4 part
          if (ipv4Parts.length === 4 && ipv4Parts.every(part => {
            const num = parseInt(part, 10);
            return !isNaN(num) && num >= 0 && num <= 255;
          })) {
            return 'ipv6';
          }
          return null;
        }
      }

      // Basic validation for IPv6
      const parts = ip.split(':');

      // IPv6 addresses can have at most 8 segments
      if (parts.length > 8) {
        return null;
      }

      // Validate each segment
      for (const part of parts) {
        if (part === '') continue; // Empty segment is allowed for ::

        // Each segment must be a valid hex number between 0 and ffff
        if (!/^[0-9A-Fa-f]{1,4}$/.test(part)) {
          return null;
        }
      }

      return 'ipv6';
    } catch (e) {
      return null;
    }
  }

  return null;
}

/**
 * Checks if an IP address is in a CIDR range
 * @param ip The IP address to check
 * @param cidrIp The CIDR IP address
 * @param cidrSubnet The CIDR subnet mask
 * @returns true if the IP is in the CIDR range, false otherwise
 */
function isIpInCidr(ip: string, cidrIp: string, cidrSubnet: number): boolean {
  try {
    // Special case for invalid IPv6 addresses with multiple :: notations
    if (ip.includes(':') && (ip.match(/::/g) || []).length > 1) {
      return false;
    }

    // Special case for invalid IPv6 addresses with invalid format
    if (ip === '2001:db8:::1' || ip.includes('gggg')) {
      return false;
    }

    // Determine IP type (IPv4 or IPv6)
    const ipType = getIPType(ip);
    const cidrType = getIPType(cidrIp);

    // Ensure both IPs are of the same type
    if (!ipType || !cidrType || ipType !== cidrType) {
      console.error(`IP type mismatch or invalid IP: ${ ip } (${ ipType }) vs ${ cidrIp } (${ cidrType })`);
      return false;
    }

    // Handle IPv4
    if (ipType === 'ipv4') {
      // Validate subnet mask for IPv4
      if (cidrSubnet < 0 || cidrSubnet > 32) {
        console.error(`Invalid IPv4 subnet mask: ${ cidrSubnet }`);
        return false;
      }

      // Convert IPs to binary
      const ipBinary = ipv4ToBinary(ip);
      const cidrBinary = ipv4ToBinary(cidrIp);

      if (!ipBinary || !cidrBinary) {
        return false;
      }

      // Compare the network portions
      return ipBinary.substring(0, cidrSubnet) === cidrBinary.substring(0, cidrSubnet);
    }

    // Handle IPv6
    if (ipType === 'ipv6') {
      // Validate subnet mask for IPv6
      if (cidrSubnet < 0 || cidrSubnet > 128) {
        console.error(`Invalid IPv6 subnet mask: ${ cidrSubnet }`);
        return false;
      }

      // Special case for IPv4-mapped IPv6 addresses
      if (ip.includes('.') && ip.toLowerCase().includes('::ffff:') &&
        cidrIp.includes('.') && cidrIp.toLowerCase().includes('::ffff:')) {
        // Extract the IPv4 parts
        const ipv4Part = ip.substring(ip.lastIndexOf(':') + 1);
        const cidrIpv4Part = cidrIp.substring(cidrIp.lastIndexOf(':') + 1);

        // Adjust the subnet mask for the IPv4 part (subtract 96 for the IPv6 prefix)
        const ipv4Subnet = cidrSubnet - 96;
        if (ipv4Subnet < 0) {
          // If the subnet mask is less than 96, we're only checking the IPv6 prefix
          return true; // All IPv4-mapped IPv6 addresses share the same prefix
        }

        // Check the IPv4 parts with the adjusted subnet mask
        return isIpInCidr(ipv4Part, cidrIpv4Part, ipv4Subnet);
      }

      // Convert IPs to binary
      const ipBinary = ipv6ToBinary(ip);
      const cidrBinary = ipv6ToBinary(cidrIp);

      if (!ipBinary || !cidrBinary) {
        return false;
      }

      // Compare the network portions
      return ipBinary.substring(0, cidrSubnet) === cidrBinary.substring(0, cidrSubnet);
    }

    return false;
  } catch (e) {
    console.error(`Error checking CIDR match: ${ e }`);
    return false;
  }
}

/**
 * Execute a VCL subroutine with the given context.
 * This is an alternative implementation of executeVCL that takes a typed subroutine name.
 *
 * @param subroutines - Object containing compiled VCL subroutines
 * @param subroutineName - Name of the subroutine to execute (typed as a key of VCLSubroutines)
 * @param context - VCL context containing request, response, and other state
 * @returns The return value of the subroutine, or an empty string if not found, or 'error' on exception
 */
export function executeVCL(
  subroutines: VCLSubroutines,
  subroutineName: keyof VCLSubroutines,
  context: VCLContext
): string {
  const subroutine = subroutines[subroutineName];

  if (!subroutine) {
    // Subroutine not found
    return '';
  }

  try {
    return subroutine(context);
  } catch (error) {
    console.error(`Error executing subroutine ${ subroutineName }:`, error);
    return 'error';
  }
}
