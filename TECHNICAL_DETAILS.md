# VCL Proxy Technical Details

This document contains technical details and design decisions for implementing a Fastly VCL-compatible HTTP proxy using TypeScript and Bun.

## VCL Implementation Architecture

### 1. VCL Parser

The VCL parser will be responsible for loading and parsing the `filter.vcl` file. It will:

- Tokenize the VCL file into lexical tokens
- Parse the tokens into an Abstract Syntax Tree (AST)
- Validate the syntax and structure
- Convert the AST into executable code or an intermediate representation

**Key Components:**

- Lexer: Converts raw VCL text into tokens
- Parser: Converts tokens into an AST
- Validator: Checks for syntax errors and semantic issues
- Compiler/Interpreter: Converts the AST into executable code

### 2. VCL Runtime

The VCL runtime will execute the parsed VCL code within the context of HTTP requests and responses:

- Maintain the state of VCL variables during request processing
- Execute VCL subroutines at appropriate points in the request lifecycle
- Handle VCL return statements and control flow
- Provide access to built-in VCL functions

**Key Components:**

- Context: Stores the current state of VCL variables
- Executor: Runs VCL code within a given context
- Function Library: Implements built-in VCL functions
- Subroutine Manager: Manages and executes VCL subroutines

### 3. HTTP Object Model

The HTTP object model will represent HTTP requests and responses in a way that's compatible with VCL:

- Provide access to request and response headers
- Support manipulation of request and response properties
- Implement VCL-specific objects (`req`, `bereq`, `beresp`, `resp`, `obj`)
- Handle cookies, query parameters, and other HTTP components

**Key Components:**

- Request: Represents client and backend requests
- Response: Represents backend and client responses
- Headers: Provides access to HTTP headers
- Cookies: Handles cookie parsing and manipulation

### 4. Caching System

The caching system will implement Fastly-compatible caching behavior:

- Store and retrieve cached responses
- Respect TTL and grace periods
- Support cache invalidation
- Implement cache variation based on VCL hash

**Key Components:**

- Cache Store: Stores cached responses
- Cache Key Generator: Creates cache keys based on VCL hash
- TTL Manager: Handles expiration of cached items
- Vary Handler: Manages cache variations

## Request Flow Implementation

The proxy will implement the following request flow, mirroring Fastly's VCL execution:

1. **Client Request Reception**
   - Execute `vcl_recv`
   - Handle return values: `pass`, `lookup`, `error`, `hash`, `purge`

2. **Cache Lookup**
   - Generate cache key using `vcl_hash`
   - Check if the request is in cache
   - If found, execute `vcl_hit`
   - If not found, execute `vcl_miss`
   - If passing, execute `vcl_pass`

3. **Backend Request**
   - Send request to backend
   - Receive backend response
   - Execute `vcl_fetch`
   - Handle return values: `deliver`, `pass`, `error`, `restart`

4. **Response Delivery**
   - Execute `vcl_deliver`
   - Send response to client
   - Execute `vcl_log`

## VCL Function Implementation

The implementation will support the following categories of VCL functions:

1. **String Manipulation Functions**
   - Regular expression functions (`regsub`, `regsuball`)
   - String operations (`substr`, `std.strlen`, `std.tolower`, `std.toupper`)
   - String comparison (`std.strcasecmp`)
   - String search and replace (`std.strstr`, `std.prefixof`, `std.suffixof`, `std.replace`, `std.replaceall`)
   - String padding and repetition (`std.strpad`, `std.strrep`)

2. **Time Functions**
   - Current time (`now`)
   - Time arithmetic (`time.add`, `time.sub`)
   - Time comparison (`time.is_after`)
   - Time formatting (`strftime`)
   - Time parsing (`std.time`)
   - Time conversion (`time.hex_to_time`)

3. **Math Functions**
   - Basic arithmetic operations
   - Type conversion (`std.integer`, `std.real`)
   - Rounding functions (`math.round`, `math.floor`, `math.ceil`)
   - Advanced math (`math.pow`, `math.log`, `math.min`, `math.max`)

4. **Digest and Encoding Functions**
   - Hash functions (`digest.hash_md5`, `digest.hash_sha1`, `digest.hash_sha256`, `digest.hash_sha512`)
   - HMAC functions (`digest.hmac_md5`, `digest.hmac_sha1`, `digest.hmac_sha256`)
   - Base64 encoding/decoding (`digest.base64`, `digest.base64_decode`)
   - URL-safe Base64 (`digest.base64url`, `digest.base64url_decode`)
   - Secure comparison (`digest.secure_is_equal`)

5. **HTTP Functions**
   - Header manipulation (`header.get`, `header.set`, `header.unset`, `header.filter`, `header.filter_except`)
   - Status code handling (`http.status_matches`)
   - Cookie handling
   - Query string parsing

6. **Query String Functions**
   - Parameter extraction (`querystring.get`, `querystring.filter_except`, `querystring.filter`)
   - Query string manipulation (`querystring.set`, `querystring.remove`, `querystring.sort`)
   - Query string globbing (`querystring.globfilter`, `querystring.globfilter_except`)

7. **Random Functions**
   - Random number generation (`randomint`, `randombool`)
   - Random string generation
   - Random selection

8. **Table Functions**
   - Key-value lookups (`table.lookup`)
   - Table existence checks (`table.contains`)

9. **Fastly-specific Functions**
   - Edge dictionary operations
   - Segmented caching
   - ESI processing
   - Geolocation (`client.geo.*`)

### Function Implementation Strategy

For each function category, we'll implement:

1. **Function Interface**: TypeScript interfaces defining the function signatures
2. **Implementation**: Actual implementation of the function logic
3. **Context Integration**: Integration with the VCL context
4. **Error Handling**: Proper error handling for edge cases
5. **Testing**: Unit tests for each function

### Example Implementation: String Functions

```typescript
// Function interface
interface StringFunctions {
  tolower(str: string): string;
  toupper(str: string): string;
  strlen(str: string): number;
  strstr(haystack: string, needle: string): number;
  replace(str: string, search: string, replacement: string): string;
  replaceall(str: string, search: string, replacement: string): string;
  // Additional string functions...
}

// Implementation
class StandardStringFunctions implements StringFunctions {
  tolower(str: string): string {
    return str.toLowerCase();
  }

  toupper(str: string): string {
    return str.toUpperCase();
  }

  strlen(str: string): number {
    return str.length;
  }

  strstr(haystack: string, needle: string): number {
    return haystack.indexOf(needle);
  }

  replace(str: string, search: string, replacement: string): string {
    return str.replace(search, replacement);
  }

  replaceall(str: string, search: string, replacement: string): string {
    return str.split(search).join(replacement);
  }

  // Additional implementations...
}
```

### Example Implementation: Time Functions

```typescript
// Function interface
interface TimeFunctions {
  add(time: Date, offset: number): Date;
  sub(time1: Date, time2: Date): number;
  is_after(time1: Date, time2: Date): boolean;
  // Additional time functions...
}

// Implementation
class StandardTimeFunctions implements TimeFunctions {
  add(time: Date, offset: number): Date {
    const result = new Date(time);
    result.setTime(result.getTime() + offset);
    return result;
  }

  sub(time1: Date, time2: Date): number {
    return time1.getTime() - time2.getTime();
  }

  is_after(time1: Date, time2: Date): boolean {
    return time1.getTime() > time2.getTime();
  }

  // Additional implementations...
}
```

## Technical Challenges and Solutions

### 1. VCL Parsing

**Challenge:** VCL has a C-like syntax with domain-specific constructs.

**Solution:** Use a combination of lexer/parser libraries or implement a custom parser. Consider using a parser generator like Nearley or a handwritten recursive descent parser.

### 2. Execution Model

**Challenge:** VCL uses a specific execution model with subroutines and return statements that affect the request flow.

**Solution:** Implement a state machine that tracks the current stage of request processing and executes the appropriate subroutines based on return values.

### 3. Performance

**Challenge:** VCL execution needs to be fast to maintain proxy performance.

**Solution:**

- Compile VCL to an optimized intermediate representation
- Use efficient data structures for variable storage
- Implement caching of parsed VCL
- Optimize hot paths in the request flow

### 4. Compatibility

**Challenge:** Ensuring compatibility with Fastly VCL while implementing in TypeScript.

**Solution:**

- Thoroughly test against real Fastly VCL examples
- Implement a comprehensive test suite
- Focus on the most commonly used VCL features first
- Document any differences or limitations

## Implementation Phases

The implementation will be divided into phases to allow for incremental development and testing:

1. **Phase 1: Basic VCL Parsing and Execution** ✅
   - Parse simple VCL files ✅
   - Execute basic VCL subroutines ✅
   - Support core VCL syntax ✅

   **Completed**: We have implemented a basic VCL parser that can parse the syntax in our filter.vcl file. The parser handles subroutines, if statements, return statements, set statements, unset statements, synthetic statements, and more. We've also implemented a basic compiler that can execute the parsed VCL code.

2. **Phase 2: HTTP Integration** ✅
   - Integrate with the HTTP proxy ✅
   - Implement request/response object model ✅
   - Support basic request flow ✅

   **Completed**: We have integrated the VCL execution with the HTTP proxy. The proxy now executes the appropriate VCL subroutines at each stage of the request/response cycle. We've implemented the request/response object model with VCL-compatible variables (`req`, `bereq`, `beresp`, `resp`, `obj`) and proper access to headers and other properties.

3. **Phase 3: Caching** ✅
   - Implement basic caching ✅
   - Support TTL and grace periods ✅
   - Implement cache variation ✅

   **Completed**: We have implemented a basic in-memory caching system that supports TTL, grace periods, and stale-while-revalidate. The proxy can now cache responses and serve them from cache when appropriate. Cache entries are automatically invalidated when they expire or when they are explicitly purged.

4. **Phase 4: VCL Standard Library** ✅
   - Implement string manipulation functions ✅
   - Implement time and date functions ✅
   - Implement math functions ✅
   - Implement cryptographic functions ✅
   - Implement HTTP and query string functions ✅

   **Completed**: We have implemented all of the VCL standard library functions, including string manipulation, time functions, math, cryptographic, HTTP, and query string functions. The functions are available in the runtime and the VCL parser has been updated to correctly handle function calls. All tests are now passing, including the error handling tests.

5. **Phase 5: Backend Configuration** ✅
   - Implement support for multiple backend definitions ✅
   - Implement backend health checks ✅
   - Implement backend selection based on VCL logic ✅

   **Completed**: We have implemented the backend configuration features of VCL, including support for multiple backends, health checks, and backend selection logic. The implementation includes:

   - Support for defining multiple backends with different hosts, ports, and SSL settings
   - Backend health check probes with customizable parameters
   - Directors for load balancing across multiple backends
   - Support for different director types (random, hash, client, fallback)
   - Backend selection based on URL path and other request attributes

6. **Phase 6: Error Handling and Synthetic Responses** ✅
   - Implement the `error` statement ✅
   - Support synthetic responses ✅
   - Handle backend failures gracefully ✅
   - Implement custom error pages ✅
   - Add support for error logging and monitoring ✅

   **Completed**: We have implemented comprehensive error handling and synthetic responses. The implementation includes:

   - Support for the `error` function to trigger error handling
   - Support for the `synthetic` function to create custom responses
   - Graceful handling of backend failures with fallback mechanisms
   - Custom error pages for different error types
   - Detailed error logging and monitoring
   - Automatic retries with fallback backends

7. **Phase 7: Advanced Features**
   - Support more complex VCL functions
   - Implement advanced caching strategies
   - Add security features

Each phase will include comprehensive testing to ensure correctness and performance.

## Recent Improvements and Fixes

### VCL Parser Enhancements

- Fixed issues with the VCL parser to correctly handle function calls
- Improved error handling in the parser to provide better error messages
- Enhanced the parser to handle different VCL syntax variations (e.g., with or without parentheses in return statements)

### Test Framework Improvements

- Fixed file path handling in the test framework to correctly load VCL files from different locations
- Added better error reporting when loading and parsing VCL files
- Implemented a more robust test framework that can handle different VCL syntax variations

### Error Handling Improvements

- Implemented comprehensive error handling in the VCL runtime
- Added support for custom error pages and error handling logic
- Improved error reporting and logging

### All Tests Passing

- All 14 tests are now passing, including the error handling tests
- The implementation now correctly handles all the test cases defined in the test suite
- The VCL parser and executor are working correctly with the test suite
