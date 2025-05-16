# VCL Runtime API

The VCL Runtime provides the execution environment for compiled VCL code. It includes the context objects, standard library functions, and the execution flow control. This document provides a reference for the VCL Runtime API in Fastly.JS.

## Overview

The VCL Runtime consists of several components:

1. **VCL Context**: The execution context for VCL code
2. **Standard Library**: Built-in functions available to VCL code
3. **Execution Engine**: Controls the flow of execution through VCL subroutines

## Importing the Runtime

```typescript
import { 
  createVCLContext, 
  executeVCL, 
  executeSubroutine 
} from '../src/vcl-runtime';
```

## Basic Usage

```typescript
import { loadVCL, createVCLContext, executeVCL } from '../src/vcl';

// Load VCL code
const subroutines = loadVCL('./path/to/file.vcl');

// Create a VCL context
const context = createVCLContext();

// Set request properties
context.req.method = 'GET';
context.req.url = '/api/users';
context.req.http = {
  'Host': 'example.com',
  'User-Agent': 'Mozilla/5.0'
};

// Execute the VCL code
const result = executeVCL(context, subroutines);

// Check the response
console.log(result.resp.status);  // HTTP status code
console.log(result.resp.http);    // Response headers
console.log(result.resp.body);    // Response body
```

## Runtime API

### createVCLContext(): VCLContext

Creates a new VCL execution context.

**Returns:**
- `VCLContext`: A new VCL context object

**Example:**
```typescript
const context = createVCLContext();
```

### executeVCL(context: VCLContext, subroutines: VCLSubroutines): VCLContext

Executes VCL code with the given context and subroutines.

**Parameters:**
- `context` (VCLContext): The VCL context
- `subroutines` (VCLSubroutines): The compiled VCL subroutines

**Returns:**
- `VCLContext`: The updated VCL context after execution

**Example:**
```typescript
const result = executeVCL(context, subroutines);
```

### executeSubroutine(context: VCLContext, subroutines: VCLSubroutines, name: string): string

Executes a specific VCL subroutine.

**Parameters:**
- `context` (VCLContext): The VCL context
- `subroutines` (VCLSubroutines): The compiled VCL subroutines
- `name` (string): The name of the subroutine to execute

**Returns:**
- `string`: The return value of the subroutine

**Example:**
```typescript
const result = executeSubroutine(context, subroutines, 'vcl_recv');
```

## VCLContext Interface

The `VCLContext` interface represents the execution context for VCL code:

```typescript
interface VCLContext {
  req: {
    method: string;
    url: string;
    http: Record<string, string>;
    backend: string;
    [key: string]: any;
  };
  bereq: {
    method: string;
    url: string;
    http: Record<string, string>;
    [key: string]: any;
  };
  beresp: {
    status: number;
    http: Record<string, string>;
    body: string;
    [key: string]: any;
  };
  resp: {
    status: number;
    http: Record<string, string>;
    body: string;
    [key: string]: any;
  };
  obj: {
    status: number;
    http: Record<string, string>;
    response: string;
    [key: string]: any;
  };
  client: {
    ip: string;
    geo: {
      country_code: string;
      continent_code: string;
      [key: string]: any;
    };
    [key: string]: any;
  };
  server: {
    ip: string;
    [key: string]: any;
  };
  std: {
    [key: string]: any;
  };
  [key: string]: any;
}
```

## Execution Flow

The VCL Runtime follows the Fastly execution flow:

1. **vcl_recv**: Called when a request is received
2. **vcl_hash**: Called to create a hash key for the object
3. **vcl_hit**: Called when a cache hit occurs
4. **vcl_miss**: Called when a cache miss occurs
5. **vcl_pass**: Called when the request should bypass the cache
6. **vcl_fetch**: Called after a request has been sent to the backend
7. **vcl_error**: Called when an error occurs
8. **vcl_deliver**: Called before delivering the response to the client
9. **vcl_log**: Called after the response has been delivered

The flow can be controlled by the return values of each subroutine:

- `lookup`: Proceed to cache lookup
- `pass`: Bypass the cache
- `pipe`: Switch to pipe mode
- `error`: Generate an error
- `hash`: Proceed to hash calculation
- `miss`: Proceed as if cache miss occurred
- `hit`: Proceed as if cache hit occurred
- `deliver`: Deliver the response
- `fetch`: Fetch from backend
- `restart`: Restart the request processing

## Standard Library

The VCL Runtime provides a standard library of functions that can be used in VCL code:

### String Functions

- `std.strlen(string)`: Returns the length of a string
- `std.toupper(string)`: Converts a string to uppercase
- `std.tolower(string)`: Converts a string to lowercase
- `std.substr(string, offset, length)`: Returns a substring
- `std.strstr(haystack, needle)`: Finds the first occurrence of a substring
- `std.regsuball(string, regex, replacement)`: Replaces all occurrences of a regex pattern

### Math Functions

- `std.random.randombool(probability)`: Returns a random boolean with the given probability
- `std.random.randomint(min, max)`: Returns a random integer between min and max

### Time Functions

- `std.time.now()`: Returns the current time
- `std.time.add(time, offset)`: Adds an offset to a time
- `std.time.sub(time1, time2)`: Calculates the difference between two times
- `std.strftime(format, time)`: Formats a time according to the format string

### Digest Functions

- `digest.hash_md5(string)`: Calculates the MD5 hash of a string
- `digest.hash_sha1(string)`: Calculates the SHA-1 hash of a string
- `digest.hash_sha256(string)`: Calculates the SHA-256 hash of a string
- `digest.base64_decode(string)`: Decodes a base64-encoded string
- `digest.base64_encode(string)`: Encodes a string as base64

### Logging Functions

- `std.log(string)`: Logs a message
- `std.syslog(priority, string)`: Logs a message with the given priority

## Error Handling

The VCL Runtime provides error handling through the `vcl_error` subroutine and the `error` statement:

```vcl
sub vcl_recv {
  if (req.url ~ "^/forbidden") {
    error 403 "Forbidden";
  }
  return(lookup);
}

sub vcl_error {
  set obj.http.Content-Type = "text/html; charset=utf-8";
  synthetic {"
    <html>
      <head>
        <title>Error</title>
      </head>
      <body>
        <h1>Error " + obj.status + "</h1>
        <p>" + obj.response + "</p>
      </body>
    </html>
  "};
  return(deliver);
}
```

## Advanced Usage

### Custom Context Properties

```typescript
import { createVCLContext } from '../src/vcl-runtime';

// Create a context with custom properties
const context = createVCLContext();
context.custom = {
  userId: '123',
  features: {
    featureA: true,
    featureB: false
  }
};

// Access custom properties in VCL
// sub vcl_recv {
//   if (custom.features.featureA) {
//     set req.http.X-Feature-A = "enabled";
//   }
//   return(lookup);
// }
```

### Extending the Standard Library

```typescript
import { createVCLContext, extendStandardLibrary } from '../src/vcl-runtime';

// Extend the standard library with custom functions
extendStandardLibrary('custom', {
  myFunction: (arg1, arg2) => {
    // Implementation
    return result;
  }
});

// Create a context with the extended standard library
const context = createVCLContext();

// Use the custom function in VCL
// sub vcl_recv {
//   set req.http.X-Result = std.custom.myFunction(req.url, "test");
//   return(lookup);
// }
```

### Custom Backend Handling

```typescript
import { createVCLContext, executeVCL } from '../src/vcl-runtime';

// Create a context with custom backend handling
const context = createVCLContext();
context.backends = {
  default: {
    host: 'example.com',
    port: 80
  },
  api: {
    host: 'api.example.com',
    port: 443
  }
};

// Custom backend request handler
context.sendBackendRequest = async (backend, request) => {
  // Implementation
  return response;
};

// Execute VCL with custom backend handling
const result = executeVCL(context, subroutines);
```

## Conclusion

The VCL Runtime API provides a powerful way to execute VCL code in a JavaScript/TypeScript environment. It's the heart of Fastly.JS's ability to simulate the Fastly edge computing platform locally.

For more information on the HTTP Object Model, see the [HTTP Object Model API Reference](./http-object-model.md).
