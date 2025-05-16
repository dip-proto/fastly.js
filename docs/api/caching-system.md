# Caching System API

The Caching System provides a way to store and retrieve HTTP responses in Fastly.JS. It simulates Fastly's caching behavior, allowing you to test and develop caching strategies locally. This document provides a reference for the Caching System API in Fastly.JS.

## Overview

The Caching System consists of several components:

1. **Cache Store**: Stores and retrieves cached objects
2. **Cache Key Generator**: Creates cache keys based on request properties
3. **TTL Manager**: Manages the time-to-live for cached objects
4. **Vary Handler**: Handles content negotiation with the `Vary` header

## Importing the Caching System

```typescript
import { 
  createCache, 
  generateCacheKey, 
  getCachedResponse 
} from '../src/cache-system';
```

## Basic Usage

```typescript
import { createCache, generateCacheKey, getCachedResponse } from '../src/cache-system';
import { createRequest, createResponse } from '../src/http-model';

// Create a cache
const cache = createCache();

// Create a request
const request = createRequest({
  method: 'GET',
  url: '/api/users',
  headers: {
    'Host': 'example.com',
    'Accept': 'application/json'
  }
});

// Generate a cache key for the request
const cacheKey = generateCacheKey(request);

// Create a response
const response = createResponse({
  status: 200,
  headers: {
    'Content-Type': 'application/json',
    'Cache-Control': 'max-age=3600'
  },
  body: '{"users": []}'
});

// Store the response in the cache
cache.set(cacheKey, response);

// Retrieve the response from the cache
const cachedResponse = cache.get(cacheKey);

// Or use the helper function
const cachedResponse2 = getCachedResponse(cache, request);
```

## Caching System API

### createCache(options?: CacheOptions): Cache

Creates a new cache.

**Parameters:**
- `options` (CacheOptions, optional): Options for the cache

**Returns:**
- `Cache`: A new cache object

**Example:**
```typescript
const cache = createCache({
  maxSize: 1000,
  defaultTTL: 3600
});
```

### generateCacheKey(request: Request, options?: CacheKeyOptions): string

Generates a cache key for a request.

**Parameters:**
- `request` (Request): The request to generate a key for
- `options` (CacheKeyOptions, optional): Options for key generation

**Returns:**
- `string`: The generated cache key

**Example:**
```typescript
const cacheKey = generateCacheKey(request, {
  includeHeaders: ['Host', 'Accept'],
  includeQueryParams: ['page', 'limit']
});
```

### getCachedResponse(cache: Cache, request: Request): Response | null

Retrieves a cached response for a request.

**Parameters:**
- `cache` (Cache): The cache to retrieve from
- `request` (Request): The request to retrieve a response for

**Returns:**
- `Response | null`: The cached response, or null if not found

**Example:**
```typescript
const cachedResponse = getCachedResponse(cache, request);
```

### parseCacheControl(header: string): CacheControl

Parses a Cache-Control header into an object.

**Parameters:**
- `header` (string): The Cache-Control header to parse

**Returns:**
- `CacheControl`: An object containing the parsed directives

**Example:**
```typescript
const cacheControl = parseCacheControl('max-age=3600, public');
```

### calculateTTL(response: Response): number

Calculates the time-to-live for a response based on its headers.

**Parameters:**
- `response` (Response): The response to calculate TTL for

**Returns:**
- `number`: The TTL in seconds

**Example:**
```typescript
const ttl = calculateTTL(response);
```

## Cache Interface

The `Cache` interface represents a cache store:

```typescript
interface Cache {
  get(key: string): Response | null;
  set(key: string, value: Response, ttl?: number): void;
  has(key: string): boolean;
  delete(key: string): boolean;
  clear(): void;
  size(): number;
  keys(): string[];
  purge(pattern: string | RegExp): number;
}
```

### Cache Methods

- `get(key)`: Retrieves a cached response by key
- `set(key, value, ttl)`: Stores a response in the cache with an optional TTL
- `has(key)`: Checks if a key exists in the cache
- `delete(key)`: Removes a key from the cache
- `clear()`: Removes all entries from the cache
- `size()`: Returns the number of entries in the cache
- `keys()`: Returns an array of all keys in the cache
- `purge(pattern)`: Removes entries matching a pattern from the cache

## CacheOptions Interface

The `CacheOptions` interface represents options for creating a cache:

```typescript
interface CacheOptions {
  maxSize?: number;
  defaultTTL?: number;
  checkPeriod?: number;
  storage?: 'memory' | 'localStorage' | 'custom';
  customStorage?: {
    get(key: string): any;
    set(key: string, value: any): void;
    has(key: string): boolean;
    delete(key: string): boolean;
    clear(): void;
  };
}
```

### CacheOptions Properties

- `maxSize`: Maximum number of entries in the cache (default: unlimited)
- `defaultTTL`: Default time-to-live in seconds (default: 3600)
- `checkPeriod`: Period in milliseconds to check for expired entries (default: 60000)
- `storage`: Storage type to use (default: 'memory')
- `customStorage`: Custom storage implementation for the 'custom' storage type

## CacheKeyOptions Interface

The `CacheKeyOptions` interface represents options for generating cache keys:

```typescript
interface CacheKeyOptions {
  includeMethod?: boolean;
  includeHeaders?: string[];
  includeQueryParams?: string[];
  includeBody?: boolean;
  normalizeCase?: boolean;
  hashFunction?: (input: string) => string;
}
```

### CacheKeyOptions Properties

- `includeMethod`: Whether to include the HTTP method in the key (default: true)
- `includeHeaders`: Array of header names to include in the key (default: ['Host'])
- `includeQueryParams`: Array of query parameter names to include in the key (default: all)
- `includeBody`: Whether to include the request body in the key (default: false)
- `normalizeCase`: Whether to normalize the case of header and query parameter names (default: true)
- `hashFunction`: Function to hash the key (default: MD5)

## CacheControl Interface

The `CacheControl` interface represents parsed Cache-Control directives:

```typescript
interface CacheControl {
  maxAge?: number;
  sMaxAge?: number;
  noCache?: boolean;
  noStore?: boolean;
  noTransform?: boolean;
  public?: boolean;
  private?: boolean;
  mustRevalidate?: boolean;
  proxyRevalidate?: boolean;
  immutable?: boolean;
  staleWhileRevalidate?: number;
  staleIfError?: number;
}
```

## VCL Context Integration

The Caching System is integrated with the VCL context:

```typescript
interface VCLContext {
  // ... other properties ...
  cache: {
    store: Cache;
    key: string;
    hit: boolean;
    ttl: number;
    stale: boolean;
    [key: string]: any;
  };
}
```

## Caching Behavior

The Caching System simulates Fastly's caching behavior:

1. **Cache Key Generation**: The cache key is generated based on the request properties
2. **Cache Lookup**: The cache is checked for a matching response
3. **TTL Calculation**: The TTL is calculated based on the response headers
4. **Vary Handling**: Content negotiation is handled based on the `Vary` header
5. **Stale Handling**: Stale responses can be used in certain conditions

## Advanced Usage

### Custom Cache Key Generation

```typescript
import { createCache, generateCacheKey } from '../src/cache-system';

// Create a cache
const cache = createCache();

// Define a custom cache key function
function customCacheKey(request) {
  return `${request.method}:${request.path}:${request.headers['host']}`;
}

// Use the custom function
const cacheKey = customCacheKey(request);

// Or extend the default function
const cacheKey2 = generateCacheKey(request, {
  includeHeaders: ['Host', 'Accept', 'X-Custom-Header'],
  includeQueryParams: ['page', 'limit'],
  hashFunction: (input) => {
    // Custom hash function
    return customHash(input);
  }
});
```

### Custom TTL Calculation

```typescript
import { createCache, calculateTTL } from '../src/cache-system';

// Create a cache
const cache = createCache();

// Define a custom TTL function
function customTTL(response) {
  if (response.headers['X-Custom-TTL']) {
    return parseInt(response.headers['X-Custom-TTL'], 10);
  }
  return calculateTTL(response);
}

// Use the custom function
const ttl = customTTL(response);

// Store the response with the custom TTL
cache.set(cacheKey, response, ttl);
```

### Purging Cache Entries

```typescript
import { createCache } from '../src/cache-system';

// Create a cache
const cache = createCache();

// Store some responses
cache.set('key1', response1);
cache.set('key2', response2);
cache.set('key3', response3);

// Purge a specific entry
cache.delete('key1');

// Purge entries matching a pattern
const purgedCount = cache.purge(/^key/);
console.log(`Purged ${purgedCount} entries`);

// Clear the entire cache
cache.clear();
```

## Conclusion

The Caching System API provides a powerful way to simulate Fastly's caching behavior in Fastly.JS. It enables the development and testing of caching strategies locally before deploying them to your production Fastly service.

For more information on the Standard Library, see the [Standard Library API Reference](./standard-library.md).
