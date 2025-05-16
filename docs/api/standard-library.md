# Standard Library API

The Standard Library provides a set of built-in functions and objects that can be used in VCL code. It implements the Fastly VCL standard library, allowing you to use the same functions locally as you would in production. This document provides a reference for the Standard Library API in Fastly.JS.

## Overview

The Standard Library consists of several modules:

1. **String Functions**: Functions for working with strings
2. **Math Functions**: Functions for mathematical operations
3. **Time Functions**: Functions for working with dates and times
4. **Digest Functions**: Functions for cryptographic operations
5. **Logging Functions**: Functions for logging messages
6. **Director Functions**: Functions for backend selection
7. **Geo Functions**: Functions for geolocation
8. **Ratelimit Functions**: Functions for rate limiting
9. **WAF Functions**: Functions for web application firewall

## Importing the Standard Library

```typescript
import { createStdModule } from './src/vcl-std';
import { createDigestModule } from './src/vcl-digest';
import { createTimeModule } from './src/vcl-time';
```

## Basic Usage

```typescript
import { createStdModule } from './src/vcl-std';
import { createDigestModule } from './src/vcl-digest';
import { createTimeModule } from './src/vcl-time';

// Create standard library module instances
const std = createStdModule();
const digest = createDigestModule();
const time = createTimeModule();

// Use standard library functions
const upperCase = std.toupper('hello');  // "HELLO"
const md5Hash = digest.hash_md5('hello');  // MD5 hash of "hello"
const currentTime = time.now();  // Current time as Date
```

## Standard Library API

### createStdModule(): StdModule

Creates a new standard library module instance with string and utility functions.

**Returns:**
- `StdModule`: A new standard library module instance

**Example:**
```typescript
const std = createStdModule();
const length = std.strlen('hello');  // 5
```

### createDigestModule(): DigestModule

Creates a new digest module instance with cryptographic functions.

**Returns:**
- `DigestModule`: A new digest module instance

**Example:**
```typescript
const digest = createDigestModule();
const hash = digest.hash_md5('hello');
```

### createTimeModule(): TimeModule

Creates a new time module instance with date/time functions.

**Returns:**
- `TimeModule`: A new time module instance

**Example:**
```typescript
const time = createTimeModule();
const now = time.now();  // Returns Date object
```

## String Functions

### std.strlen(string: string): number

Returns the length of a string.

**Parameters:**
- `string` (string): The string to measure

**Returns:**
- `number`: The length of the string

**Example:**
```typescript
const length = std.strlen('hello');  // 5
```

### std.toupper(string: string): string

Converts a string to uppercase.

**Parameters:**
- `string` (string): The string to convert

**Returns:**
- `string`: The uppercase string

**Example:**
```typescript
const upper = std.toupper('hello');  // "HELLO"
```

### std.tolower(string: string): string

Converts a string to lowercase.

**Parameters:**
- `string` (string): The string to convert

**Returns:**
- `string`: The lowercase string

**Example:**
```typescript
const lower = std.tolower('HELLO');  // "hello"
```

### std.substr(string: string, offset: number, length?: number): string

Returns a substring.

**Parameters:**
- `string` (string): The string to extract from
- `offset` (number): The starting position
- `length` (number, optional): The length of the substring

**Returns:**
- `string`: The extracted substring

**Example:**
```typescript
const sub = std.substr('hello world', 6, 5);  // "world"
```

### std.strstr(haystack: string, needle: string): string

Finds the first occurrence of a substring.

**Parameters:**
- `haystack` (string): The string to search in
- `needle` (string): The string to search for

**Returns:**
- `string`: The substring from the first occurrence of `needle` to the end of `haystack`

**Example:**
```typescript
const found = std.strstr('hello world', 'world');  // "world"
```

### std.regsuball(string: string, pattern: string, replacement: string): string

Replaces all occurrences of a pattern with a replacement.

**Parameters:**
- `string` (string): The string to modify
- `pattern` (string): The pattern to replace
- `replacement` (string): The replacement string

**Returns:**
- `string`: The modified string

**Example:**
```typescript
const replaced = std.regsuball('hello world', 'o', 'x');  // "hellx wxrld"
```

## Math Functions

### std.random.randombool(probability: number): boolean

Returns a random boolean with the given probability.

**Parameters:**
- `probability` (number): The probability of returning true (0.0 to 1.0)

**Returns:**
- `boolean`: A random boolean

**Example:**
```typescript
const result = std.random.randombool(0.5);  // 50% chance of true
```

### std.random.randomint(min: number, max: number): number

Returns a random integer between min and max.

**Parameters:**
- `min` (number): The minimum value
- `max` (number): The maximum value

**Returns:**
- `number`: A random integer

**Example:**
```typescript
const result = std.random.randomint(1, 10);  // Random integer between 1 and 10
```

## Time Functions

### std.time.now(): number

Returns the current time as a Unix timestamp.

**Returns:**
- `number`: The current time

**Example:**
```typescript
const now = std.time.now();
```

### std.time.add(time: number, offset: string): number

Adds an offset to a time.

**Parameters:**
- `time` (number): The time to add to
- `offset` (string): The offset to add (e.g., "1h", "30m", "1d")

**Returns:**
- `number`: The new time

**Example:**
```typescript
const future = std.time.add(std.time.now(), "1h");  // 1 hour from now
```

### std.time.sub(time1: number, time2: number): number

Calculates the difference between two times.

**Parameters:**
- `time1` (number): The first time
- `time2` (number): The second time

**Returns:**
- `number`: The difference in seconds

**Example:**
```typescript
const diff = std.time.sub(std.time.now(), pastTime);  // Seconds since pastTime
```

### std.strftime(format: string, time?: number): string

Formats a time according to the format string.

**Parameters:**
- `format` (string): The format string
- `time` (number, optional): The time to format (default: current time)

**Returns:**
- `string`: The formatted time string

**Example:**
```typescript
const formatted = std.strftime("%Y-%m-%d %H:%M:%S", std.time.now());
```

## Digest Functions

### std.digest.hash_md5(string: string): string

Calculates the MD5 hash of a string.

**Parameters:**
- `string` (string): The string to hash

**Returns:**
- `string`: The MD5 hash

**Example:**
```typescript
const hash = std.digest.hash_md5('hello');
```

### std.digest.hash_sha1(string: string): string

Calculates the SHA-1 hash of a string.

**Parameters:**
- `string` (string): The string to hash

**Returns:**
- `string`: The SHA-1 hash

**Example:**
```typescript
const hash = std.digest.hash_sha1('hello');
```

### std.digest.hash_sha256(string: string): string

Calculates the SHA-256 hash of a string.

**Parameters:**
- `string` (string): The string to hash

**Returns:**
- `string`: The SHA-256 hash

**Example:**
```typescript
const hash = std.digest.hash_sha256('hello');
```

### std.digest.base64_decode(string: string): string

Decodes a base64-encoded string.

**Parameters:**
- `string` (string): The base64-encoded string

**Returns:**
- `string`: The decoded string

**Example:**
```typescript
const decoded = std.digest.base64_decode('aGVsbG8=');  // "hello"
```

### std.digest.base64_encode(string: string): string

Encodes a string as base64.

**Parameters:**
- `string` (string): The string to encode

**Returns:**
- `string`: The base64-encoded string

**Example:**
```typescript
const encoded = std.digest.base64_encode('hello');  // "aGVsbG8="
```

## Logging Functions

### std.log(string: string): void

Logs a message.

**Parameters:**
- `string` (string): The message to log

**Example:**
```typescript
std.log('Hello, world!');
```

### std.syslog(priority: number, string: string): void

Logs a message with the given priority.

**Parameters:**
- `priority` (number): The log priority (0-7)
- `string` (string): The message to log

**Example:**
```typescript
std.syslog(3, 'Error occurred');  // Error message
```

## Director Functions

### std.director.add(name: string, type: string): void

Adds a director.

**Parameters:**
- `name` (string): The name of the director
- `type` (string): The type of the director (e.g., "random", "round-robin", "hash", "client")

**Example:**
```typescript
std.director.add('my_director', 'random');
```

### std.director.add_backend(director: string, backend: string, weight?: number): void

Adds a backend to a director.

**Parameters:**
- `director` (string): The name of the director
- `backend` (string): The name of the backend
- `weight` (number, optional): The weight of the backend

**Example:**
```typescript
std.director.add_backend('my_director', 'my_backend', 2);
```

### std.director.select_backend(director: string): { name: string }

Selects a backend from a director.

**Parameters:**
- `director` (string): The name of the director

**Returns:**
- `{ name: string }`: The selected backend

**Example:**
```typescript
const backend = std.director.select_backend('my_director');
```

## Geo Functions

### std.geo.lookup(ip: string): GeoData

Looks up geolocation data for an IP address.

**Parameters:**
- `ip` (string): The IP address to look up

**Returns:**
- `GeoData`: The geolocation data

**Example:**
```typescript
const geo = std.geo.lookup('8.8.8.8');
```

## Ratelimit Functions

### std.ratelimit.open_window(windowSeconds: number): string

Opens a rate counter window with the specified duration.

**Parameters:**
- `windowSeconds` (number): The window duration in seconds

**Returns:**
- `string`: A unique identifier for the window

**Example:**
```typescript
const windowId = std.ratelimit.open_window(60);
```

### std.ratelimit.ratecounter_increment(counterName: string, incrementBy?: number): number

Increments a named rate counter.

**Parameters:**
- `counterName` (string): The name of the counter
- `incrementBy` (number, optional): The amount to increment by (default: 1)

**Returns:**
- `number`: The new count value

**Example:**
```typescript
const count = std.ratelimit.ratecounter_increment('my_counter', 1);
```

### std.ratelimit.check_rate(counterName: string, ratePerSecond: number): boolean

Checks if a rate limit has been exceeded.

**Parameters:**
- `counterName` (string): The name of the counter
- `ratePerSecond` (number): The maximum allowed rate

**Returns:**
- `boolean`: True if the rate limit has been exceeded

**Example:**
```typescript
const exceeded = std.ratelimit.check_rate('my_counter', 10);
```

### std.ratelimit.check_rates(counterName: string, rates: string): boolean

Checks if any of multiple rate limits have been exceeded.

**Parameters:**
- `counterName` (string): The name of the counter
- `rates` (string): A comma-separated list of rates in the format "count:seconds"

**Returns:**
- `boolean`: True if any rate limit has been exceeded

**Example:**
```typescript
const exceeded = std.ratelimit.check_rates('my_counter', '10:5,100:60,1000:3600');
```

### std.ratelimit.penaltybox_add(penaltyboxName: string, identifier: string, duration: number): void

Adds an identifier to a penalty box for a specified duration.

**Parameters:**
- `penaltyboxName` (string): The name of the penalty box
- `identifier` (string): The identifier to add
- `duration` (number): The duration in seconds

**Example:**
```typescript
std.ratelimit.penaltybox_add('my_penaltybox', 'client_ip', 60);
```

### std.ratelimit.penaltybox_has(penaltyboxName: string, identifier: string): boolean

Checks if an identifier is in a penalty box.

**Parameters:**
- `penaltyboxName` (string): The name of the penalty box
- `identifier` (string): The identifier to check

**Returns:**
- `boolean`: True if the identifier is in the penalty box

**Example:**
```typescript
const inPenaltyBox = std.ratelimit.penaltybox_has('my_penaltybox', 'client_ip');
```

## Conclusion

The Standard Library API provides a comprehensive set of functions for working with VCL code in Fastly.JS. It enables the development and testing of VCL configurations locally before deploying them to your production Fastly service.

For more information on the VCL functions, see the [VCL Functions Reference](../reference/vcl-functions.md).
