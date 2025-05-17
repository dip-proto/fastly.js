# HTTP Object Model API

The HTTP Object Model provides a representation of HTTP requests and responses in the VCL execution context. This document provides a reference for the HTTP Object Model API in Fastly.JS.

## Overview

The HTTP Object Model consists of several components:

1. **Request Objects**: Represent client requests and backend requests
2. **Response Objects**: Represent backend responses and client responses
3. **Headers**: Represent HTTP headers
4. **Cookies**: Represent HTTP cookies

## Importing the HTTP Object Model

```typescript
import { 
  createRequest, 
  createResponse, 
  parseHeaders, 
  parseCookies 
} from '../src/http-model';
```

## Basic Usage

```typescript
import { createRequest, createResponse } from '../src/http-model';

// Create a request object
const request = createRequest({
  method: 'GET',
  url: '/api/users',
  headers: {
    'Host': 'example.com',
    'User-Agent': 'Mozilla/5.0',
    'Cookie': 'session=abc123; theme=dark'
  }
});

// Create a response object
const response = createResponse({
  status: 200,
  headers: {
    'Content-Type': 'application/json',
    'Cache-Control': 'max-age=3600'
  },
  body: '{"users": []}'
});
```

## HTTP Object Model API

### createRequest(options?: RequestOptions): Request

Creates a new HTTP request object.

**Parameters:**
- `options` (RequestOptions, optional): Options for the request

**Returns:**
- `Request`: A new HTTP request object

**Example:**
```typescript
const request = createRequest({
  method: 'GET',
  url: '/api/users',
  headers: {
    'Host': 'example.com',
    'User-Agent': 'Mozilla/5.0'
  }
});
```

### createResponse(options?: ResponseOptions): Response

Creates a new HTTP response object.

**Parameters:**
- `options` (ResponseOptions, optional): Options for the response

**Returns:**
- `Response`: A new HTTP response object

**Example:**
```typescript
const response = createResponse({
  status: 200,
  headers: {
    'Content-Type': 'application/json'
  },
  body: '{"success": true}'
});
```

### parseHeaders(headersString: string): Record<string, string>

Parses a string of HTTP headers into a headers object.

**Parameters:**
- `headersString` (string): The headers string to parse

**Returns:**
- `Record<string, string>`: An object containing the parsed headers

**Example:**
```typescript
const headers = parseHeaders(`
  Host: example.com
  User-Agent: Mozilla/5.0
  Accept: text/html
`);
```

### parseCookies(cookieString: string): Record<string, string>

Parses a cookie string into a cookies object.

**Parameters:**
- `cookieString` (string): The cookie string to parse

**Returns:**
- `Record<string, string>`: An object containing the parsed cookies

**Example:**
```typescript
const cookies = parseCookies('session=abc123; theme=dark');
```

### stringifyHeaders(headers: Record<string, string>): string

Converts a headers object into a string of HTTP headers.

**Parameters:**
- `headers` (Record<string, string>): The headers object to stringify

**Returns:**
- `string`: A string containing the HTTP headers

**Example:**
```typescript
const headersString = stringifyHeaders({
  'Host': 'example.com',
  'User-Agent': 'Mozilla/5.0',
  'Accept': 'text/html'
});
```

### stringifyCookies(cookies: Record<string, string>): string

Converts a cookies object into a cookie string.

**Parameters:**
- `cookies` (Record<string, string>): The cookies object to stringify

**Returns:**
- `string`: A string containing the cookies

**Example:**
```typescript
const cookieString = stringifyCookies({
  'session': 'abc123',
  'theme': 'dark'
});
```

## Request Interface

The `Request` interface represents an HTTP request:

```typescript
interface Request {
  method: string;
  url: string;
  path: string;
  query: Record<string, string>;
  headers: Record<string, string>;
  cookies: Record<string, string>;
  body: string;
  remoteAddr: string;
  remotePort: number;
  scheme: string;
  version: string;
  [key: string]: any;
}
```

### Request Properties

- `method`: The HTTP method (e.g., "GET", "POST")
- `url`: The full URL path including query string
- `path`: The URL path without query string
- `query`: An object containing the query parameters
- `headers`: An object containing the HTTP headers
- `cookies`: An object containing the cookies
- `body`: The request body as a string
- `remoteAddr`: The remote IP address
- `remotePort`: The remote port
- `scheme`: The URL scheme (e.g., "http", "https")
- `version`: The HTTP version (e.g., "1.1")

## Response Interface

The `Response` interface represents an HTTP response:

```typescript
interface Response {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  cookies: Record<string, string>;
  body: string;
  [key: string]: any;
}
```

### Response Properties

- `status`: The HTTP status code
- `statusText`: The HTTP status text
- `headers`: An object containing the HTTP headers
- `cookies`: An object containing the cookies
- `body`: The response body as a string

## VCL Context Integration

The HTTP Object Model is integrated with the VCL context:

```typescript
interface VCLContext {
  req: Request;       // Client request
  bereq: Request;     // Backend request
  beresp: Response;   // Backend response
  resp: Response;     // Client response
  obj: {
    status: number;
    response: string;
    http: Record<string, string>;
    [key: string]: any;
  };
  [key: string]: any;
}
```

## Working with Headers

Headers in the HTTP Object Model are case-insensitive:

```typescript
// Set a header
request.headers['Content-Type'] = 'application/json';

// Get a header (case-insensitive)
const contentType = request.headers['content-type'];  // "application/json"

// Check if a header exists
const hasHeader = 'content-type' in request.headers;  // true

// Delete a header
delete request.headers['Content-Type'];
```

## Working with Cookies

Cookies in the HTTP Object Model are parsed from and serialized to the `Cookie` header:

```typescript
// Set a cookie
request.cookies['session'] = 'abc123';

// Get a cookie
const session = request.cookies['session'];  // "abc123"

// Check if a cookie exists
const hasCookie = 'session' in request.cookies;  // true

// Delete a cookie
delete request.cookies['session'];

// The Cookie header is updated automatically
console.log(request.headers['Cookie']);  // Empty or other cookies
```

## Working with Query Parameters

Query parameters in the HTTP Object Model are parsed from and serialized to the URL:

```typescript
// Set a query parameter
request.query['page'] = '2';

// Get a query parameter
const page = request.query['page'];  // "2"

// Check if a query parameter exists
const hasParam = 'page' in request.query;  // true

// Delete a query parameter
delete request.query['page'];

// The URL is updated automatically
console.log(request.url);  // URL without the page parameter
```

## Advanced Usage

### Custom Request Properties

```typescript
import { createRequest } from '../src/http-model';

// Create a request with custom properties
const request = createRequest({
  method: 'GET',
  url: '/api/users',
  headers: {
    'Host': 'example.com'
  },
  custom: {
    userId: '123',
    features: {
      featureA: true,
      featureB: false
    }
  }
});

// Access custom properties
console.log(request.custom.userId);  // "123"
console.log(request.custom.features.featureA);  // true
```

### Request and Response Transformation

```typescript
import { createRequest, createResponse, transformRequest } from '../src/http-model';

// Create a request
const request = createRequest({
  method: 'GET',
  url: '/api/users',
  headers: {
    'Host': 'example.com'
  }
});

// Transform the request
const transformedRequest = transformRequest(request, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: '{"filter": "active"}'
});

// Create a response based on the request
const response = createResponse({
  status: 200,
  headers: {
    'Content-Type': 'application/json'
  },
  body: '{"users": []}'
}, transformedRequest);
```

### Cloning Requests and Responses

```typescript
import { createRequest, createResponse, cloneRequest, cloneResponse } from '../src/http-model';

// Create a request
const request = createRequest({
  method: 'GET',
  url: '/api/users',
  headers: {
    'Host': 'example.com'
  }
});

// Clone the request
const clonedRequest = cloneRequest(request);

// Modify the cloned request
clonedRequest.method = 'POST';
clonedRequest.headers['Content-Type'] = 'application/json';

// Create a response
const response = createResponse({
  status: 200,
  headers: {
    'Content-Type': 'application/json'
  },
  body: '{"users": []}'
});

// Clone the response
const clonedResponse = cloneResponse(response);

// Modify the cloned response
clonedResponse.status = 201;
clonedResponse.body = '{"user": {"id": "123"}}';
```

## Conclusion

The HTTP Object Model API provides a powerful way to work with HTTP requests and responses in Fastly.JS. It's the foundation of the VCL context and enables the simulation of HTTP traffic through the Fastly edge computing platform.

For more information on the Caching System, see the [Caching System API Reference](./caching-system.md).
