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

## How the standard library is exposed

You almost never need to construct standard library modules yourself. The runtime wires them onto every `VCLContext` returned by `createVCLContext()`, and VCL code calls them as `std.foo`, `digest.foo`, `time.foo`, and so on. From JavaScript:

```typescript
import { createVCLContext } from "../src/vcl";

const context = createVCLContext();

context.std!.toupper("hello");        // "HELLO"
context.std!.digest.hash_md5("hi");   // MD5 hash
context.time!.now();                  // current time as a Date
```

If you really do want to use a single module in isolation, the underlying factories live next to their implementations:

```typescript
import { createStdModule }    from "../src/vcl-std";
import { createTimeModule }   from "../src/vcl-time";
import { createMathModule }   from "../src/vcl-math";
import { createTableModule }  from "../src/vcl-table";
import { createHeaderModule } from "../src/vcl-header";
import { createDigestModule, CryptoModule } from "../src/vcl-digest";
```

`createDigestModule(platform?)` is the factory the runtime uses; `vcl-digest.ts` also exports `DigestModule`, a ready-made instance bound to the default platform, and `CryptoModule` as a plain object.

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

### std.strstr(haystack: string, needle: string): string | null

Finds the first occurrence of a substring.

**Parameters:**
- `haystack` (string): The string to search in
- `needle` (string): The string to search for

**Returns:**
- `string | null`: The substring from the first occurrence of `needle` to the end of `haystack`, or `null` when `needle` does not occur

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

Time handling is split across two places on the context. VCL's `time.*` builtins live on `context.time` (created by `createTimeModule` in `src/vcl-time.ts`); `context.std` only carries the string-conversion helpers `std.time` and `std.integer2time`. TIME values are `Date` instances (a `VCLTime` subclass), and RTIME durations are plain seconds.

### time.now(): Date

Returns the current time as a `Date` (using the platform clock).

**Example:**
```typescript
const now = context.time.now();
```

### time.add(time: Date, duration: number): Date / time.sub(time: Date, duration: number): Date

Shifts a TIME by an RTIME duration in seconds. To turn a VCL duration string like `"1h"` into seconds, use `context.parse_time_delta`:

```typescript
const future = context.time.add(context.time.now(), context.parse_time_delta("1h"));
```

### Other time helpers

`context.time` also exposes `is_after(t1, t2)`, `hex_to_time(divisor, hex)`, `units(unit, time)`, `runits(unit, rtime)`, and `interval_elapsed_ratio(now, start, end)`, mirroring Fastly's date-and-time builtins.

### std.time(spec: string, fallback): Date

Parses a time string into a TIME, returning `fallback` when it cannot be parsed. `std.integer2time(seconds)` converts Unix seconds to a TIME.

### strftime

Full `%`-format support lives on `context.strftime(format, time: Date)`, which is what VCL's `strftime()` uses:

```typescript
const formatted = context.strftime("%Y-%m-%d %H:%M:%S", context.time.now());
```

`context.std.strftime(format, time)` also exists but is a stub: it ignores the format and returns the ISO 8601 representation of `time` (a `Date` or epoch milliseconds).

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

### std.digest.base64(string: string): string

Encodes a string as base64. (`std.base64` is the same function — both names are wired up.)

**Parameters:**
- `string` (string): The string to encode

**Returns:**
- `string`: The base64-encoded string

**Example:**
```typescript
const encoded = std.digest.base64('hello');  // "aGVsbG8="
```

### Other digest helpers

`std.digest` also exposes `hash_sha224`, `hash_sha384`, `hash_sha512`, `hash_xxh32`, `hash_xxh64`, `hash_crc32`, `hash_crc32b`, the `hash_*_from_base64` variants, the `hmac_*` family (with `_base64` variants and `hmac_sha256_with_base64_key`), the TOTP helpers `time_hmac_md5` / `time_hmac_sha1` / `time_hmac_sha256` / `time_hmac_sha512`, `secure_is_equal`, the URL-safe `base64url` / `base64url_nopad` encoders and decoders, `awsv4_hmac`, `rsa_verify`, and `ecdsa_verify`. Encryption is on `std.crypto`: `encrypt_base64`, `decrypt_base64`, `encrypt_hex`, `decrypt_hex`.

## Logging Functions

### std.log(string: string): void

Logs a message.

**Parameters:**
- `string` (string): The message to log

**Example:**
```typescript
std.log('Hello, world!');
```

Messages go through the platform logger with a `[VCL]` prefix. There is no `std.syslog`.

## Director Functions

### std.director.add(name: string, type: string, options?): boolean

Adds a director.

**Parameters:**
- `name` (string): The name of the director
- `type` (string): One of `"random"`, `"hash"`, `"client"`, `"fallback"`, `"chash"`. Round-robin behaviour is achieved by giving every backend the same weight in a `random` director.
- `options` (object, optional): `{ quorum, retries }`. `quorum` is a percentage; if too few healthy backends remain, `select_backend` returns `null`.

**Returns:**
- `boolean`: `true` on success, `false` if the type is unknown.

**Example:**
```typescript
std.director.add('my_director', 'random', { quorum: 50, retries: 3 });
```

### std.director.add_backend(director: string, backend: string, weight?: number): boolean

Adds a backend to a director. The backend must already exist in `context.backends`.

**Parameters:**
- `director` (string): The name of the director
- `backend` (string): The name of the backend
- `weight` (number, optional): The weight of the backend (default: 1)

**Returns:**
- `boolean`: `true` on success, `false` if the director or backend is unknown

**Example:**
```typescript
std.director.add_backend('my_director', 'my_backend', 2);
```

### std.director.select_backend(director: string): VCLBackend | null

Selects a backend from a director, honouring health state, quorum, and the director type.

**Parameters:**
- `director` (string): The name of the director

**Returns:**
- `VCLBackend | null`: The selected backend object (`name`, `host`, `port`, `ssl`, …), or `null` when the director is unknown, empty, or below quorum

**Example:**
```typescript
const backend = std.director.select_backend('my_director');
```

`std.director` also provides `remove(name)` and `remove_backend(director, backend)`.

## Geo Functions

Geolocation is **not backed by a database** in Fastly.JS. The `client` object only exposes `client.ip`, and there is no `std.geo.lookup` helper. VCL that reads `client.geo.*` (or the legacy `geoip.*` aliases) gets fallback values: string fields read `"unknown"`, numeric fields read `0`, and the coordinates default to Fastly's San Francisco headquarters (`37.779`, `-122.398`). Plug your own resolver in by populating `context.client.geo` with the properties you need from JavaScript before calling `executeVCL`.

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

### std.ratelimit.ratecounter_increment(counterName: string, entry: string, delta: number): number

Increments a named rate counter for a specific entry (typically a client identifier), mirroring Fastly's `ratelimit.ratecounter_increment(ID, STRING, INTEGER)`.

**Parameters:**
- `counterName` (string): The name of the rate counter
- `entry` (string): The entry being counted (e.g. a client IP)
- `delta` (number): The amount to increment by

**Returns:**
- `number`: The new count value

**Example:**
```typescript
const count = std.ratelimit.ratecounter_increment('my_counter', client_ip, 1);
```

### std.ratelimit.check_rate(entry, counterName, threshold, windowSeconds, delta, penaltyboxName, ttl): boolean

Increments a counter and checks it against a threshold, mirroring Fastly's seven-argument `ratelimit.check_rate`. When the threshold is exceeded, the entry is added to the penalty box for `ttl` seconds.

**Parameters:**
- `entry` (string): The entry being rate limited
- `counterName` (string): The rate counter to increment
- `threshold` (number): The maximum allowed count within the window
- `windowSeconds` (number): The window duration in seconds
- `delta` (number): The amount to increment by
- `penaltyboxName` (string): The penalty box to add the entry to on violation
- `ttl` (number): How long the entry stays penalized, in seconds

**Returns:**
- `boolean`: True if the rate limit has been exceeded

**Example:**
```typescript
const exceeded = std.ratelimit.check_rate(client_ip, 'my_counter', 100, 60, 1, 'my_penaltybox', 300);
```

### std.ratelimit.check_rates(entry, rc1, threshold1, window1, delta1, pb1, threshold2, window2, delta2, pb2, ttl): boolean

Checks two rate limits at once, mirroring Fastly's `ratelimit.check_rates`. Each limit has its own threshold, window, delta, and penalty box; the shared `ttl` applies to both.

**Returns:**
- `boolean`: True if either rate limit has been exceeded

**Example:**
```typescript
const exceeded = std.ratelimit.check_rates(
  client_ip,
  'rc', 10, 5, 1, 'pb_fast',
  1000, 3600, 1, 'pb_slow',
  300,
);
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

## WAF Functions

The WAF helpers live on `context.waf` (implemented in `src/vcl-waf.ts`), not under `std`:

- `waf.allow()` — logs that the request was explicitly allowed.
- `waf.block(status, message)` — logs and throws, aborting the subroutine; the compiled subroutine catches this and returns its per-phase error action (`"error"` from `vcl_recv`, for instance), which routes into `vcl_error`.
- `waf.log(message)` — appends to the in-memory WAF log.
- `waf.rate_limit(key, limit, windowSeconds)` — token-bucket check; returns `true` while requests are within budget.
- `waf.rate_limit_tokens(key)` — remaining tokens for a key.
- `waf.detect_attack(requestData, attackType)` — pattern check for `"sql"`, `"xss"`, `"path"`, `"command"`, `"lfi"`, `"rfi"`, or `"any"`.

## Conclusion

The Standard Library API provides a comprehensive set of functions for working with VCL code in Fastly.JS. It enables the development and testing of VCL configurations locally before deploying them to your production Fastly service.

For more information on the VCL functions, see the [VCL Functions Reference](../reference/vcl-functions.md).
