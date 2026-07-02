# VCL Functions Reference

VCL (Varnish Configuration Language) functions provide a way to perform operations on data during the request-response lifecycle. This document provides a reference for the standard VCL functions supported by Fastly.JS.

## Overview

VCL functions are organized into several categories:

1. **String Functions**: Functions for working with strings
2. **Math and Randomness Functions**: Numeric parsing, math operations, random values
3. **Time Functions**: Functions for working with dates and times
4. **Digest and Cryptographic Functions**: Hashing, HMAC, base64, encryption
5. **Header Functions**: HTTP header and status manipulation
6. **Query String Functions**: Manipulating URL query strings
7. **Table Functions**: Looking up entries in `table` declarations
8. **Content Negotiation Functions**: `accept.*` lookups
9. **Address Functions**: IP address helpers
10. **Miscellaneous Functions**: Binary, UUID, UTF-8, logging
11. **Director Functions**: Backend selection
12. **Ratelimit Functions**: Rate limiting
13. **WAF Functions**: Web application firewall

Unknown function calls are a runtime error: they set `fastly.error` and abort the subroutine.

## String Functions

### std.strlen(string)

Returns the length of a string in bytes.

**Parameters:**
- `string`: The string to measure

**Returns:**
- The length of the string

**Example:**
```vcl
set req.http.X-Length = std.strlen(req.url);
```

### std.toupper(string)

Converts a string to uppercase.

**Parameters:**
- `string`: The string to convert

**Returns:**
- The uppercase string

**Example:**
```vcl
set req.http.X-Upper = std.toupper(req.http.host);
```

(Header lookups are case-sensitive and incoming header names are stored in
lowercase, which is why the examples read client headers like `req.http.host`
with lowercase names.)

### std.tolower(string)

Converts a string to lowercase.

**Parameters:**
- `string`: The string to convert

**Returns:**
- The lowercase string

**Example:**
```vcl
set req.http.X-Lower = std.tolower(req.http.host);
```

### std.substr(string, offset [, length])

Returns a substring. The `length` argument is optional; when omitted, the rest of the string is returned. Also callable as bare `substr()`.

**Parameters:**
- `string`: The string to extract from
- `offset`: The starting position
- `length`: The length of the substring (optional)

**Returns:**
- The extracted substring

**Example:**
```vcl
set req.http.X-Prefix = std.substr(req.url, 0, 5);
```

### std.strstr(haystack, needle)

Finds the first occurrence of a substring.

**Parameters:**
- `haystack`: The string to search in
- `needle`: The string to search for

**Returns:**
- The substring from the first occurrence of `needle` to the end of `haystack`, or a not-set string when `needle` does not occur

**Example:**
```vcl
set req.http.X-Domain = std.strstr(req.http.host, ".");
```

### regsub(string, pattern, replacement)

Replaces the first occurrence of a regular expression match. Also callable as `std.regsub()`.

**Parameters:**
- `string`: The string to modify
- `pattern`: The regular expression to match
- `replacement`: The replacement string

**Returns:**
- The modified string

**Example:**
```vcl
set req.url = regsub(req.url, "^/old/", "/new/");
```

### regsuball(string, pattern, replacement)

Replaces all occurrences of a regular expression match. Also callable as `std.regsuball()`.

**Parameters:**
- `string`: The string to modify
- `pattern`: The regular expression to match
- `replacement`: The replacement string

**Returns:**
- The modified string

**Example:**
```vcl
set req.url = regsuball(req.url, "//+", "/");
```

### std.prefixof(string, prefix)

Checks if a string starts with a prefix.

**Parameters:**
- `string`: The string to check
- `prefix`: The prefix to check for

**Returns:**
- `true` if the string starts with the prefix, `false` otherwise

**Example:**
```vcl
if (std.prefixof(req.url, "/api/")) {
  set req.http.X-API = "true";
}
```

### std.suffixof(string, suffix)

Checks if a string ends with a suffix.

**Parameters:**
- `string`: The string to check
- `suffix`: The suffix to check for

**Returns:**
- `true` if the string ends with the suffix, `false` otherwise

**Example:**
```vcl
if (std.suffixof(req.url, ".jpg")) {
  set req.http.X-Image = "true";
}
```

### Other string functions

The full Fastly string library is implemented. Briefly:

- `std.replace(s, target, replacement)`: replaces the first occurrence of a literal substring
- `std.replaceall(s, target, replacement)`: replaces all occurrences of a literal substring
- `std.replace_prefix(s, prefix, replacement)` / `std.replace_suffix(s, suffix, replacement)`
- `std.strrev(s)`: reverses a string
- `std.strrep(s, count)`: repeats a string
- `std.strpad(s, width, pad)`: pads a string to a width
- `std.strcasecmp(a, b)`: case-insensitive comparison
- `std.basename(path)` / `std.dirname(path)`
- `std.collect(req.http.Name [, separator])`: collapses duplicate header fragments into one value
- `std.count(req.http.Name)`: number of fragments in a header
- `subfield(header, name [, separator])`: extracts a subfield value (for example a cookie or `Cache-Control` directive)
- `urlencode(s)` / `urldecode(s)`
- `cstr_escape(s)`, `json.escape(s)`, `xml_escape(s)`
- `boltsort.sort(url)`: sorts query string parameters (equivalent to `querystring.sort`)
- `url.normalize(url)`: normalizes a URL
- `utf8.is_valid(s)`, `utf8.codepoint_count(s)`, `utf8.substr(s, offset, length)`, `utf8.strpad(s, width, pad)`: UTF-8 aware variants

## Math and Randomness Functions

### std.atoi(string)

Converts a string to an integer.

**Parameters:**
- `string`: The string to convert

**Returns:**
- The integer value. On a parse failure it returns `0` and sets `fastly.error` to `EPARSENUM`.

**Example:**
```vcl
set req.http.X-Page = std.atoi(req.http.X-Page-Param);
```

Related conversion functions: `std.atof(s)` (FLOAT, `NaN` plus `EPARSENUM` on failure), `std.strtol(s, base)`, `std.strtof(s, base)`, `std.itoa(n [, base])`, and `std.itoa_charset(n, charset)`.

### randombool(numerator, denominator)

Returns a random boolean that is true with probability `numerator / denominator`. A seeded variant `randombool_seeded(numerator, denominator, seed)` produces a deterministic result.

**Example:**
```vcl
if (randombool(1, 10)) {
  set req.http.X-Debug = "true";
}
```

Fastly.JS also accepts `std.random.randombool(probability)` with a single 0.0-1.0 probability argument as a local extension.

### randomint(from, to)

Returns a random integer between `from` and `to`. A seeded variant `randomint_seeded(from, to, seed)` is deterministic.

**Example:**
```vcl
set req.http.X-Random = randomint(1, 100);
```

`std.random.randomint(from, to)` also works as a local extension.

### randomstr(length [, characters])

Returns a random string of the given length, optionally drawn from a custom character set.

**Example:**
```vcl
set req.http.X-Token = randomstr(16);
```

### math.* namespace

The `math` namespace implements Fastly's math functions and constants:

- Rounding: `math.floor`, `math.ceil`, `math.round`, `math.trunc`, `math.roundeven`, `math.roundhalfup`, `math.roundhalfdown`
- Exponentials and logarithms: `math.exp`, `math.exp2`, `math.log`, `math.log2`, `math.log10`, `math.sqrt` (domain and range errors set `fastly.error` to `EDOM`/`ERANGE`)
- Trigonometry: `math.sin`, `math.cos`, `math.tan`, `math.asin`, `math.acos`, `math.atan`, `math.atan2`, and the hyperbolic variants (`math.sinh`, `math.cosh`, ...)
- Classification: `math.is_finite`, `math.is_infinite`, `math.is_nan`, `math.is_normal`, `math.is_subnormal`
- Constants: `math.PI`, `math.E`, `math.TAU`, `math.PHI`, `math.SQRT2`, `math.INTEGER_MAX`, `math.INTEGER_MIN`, `math.FLOAT_MAX`, `math.NAN`, `math.POS_INFINITY`, and the rest of Fastly's constant set

`std.min`, `std.max`, `std.floor`, `std.ceiling`, and `std.round` are also available.

## Time Functions

The current time is available through the `now` variable (and `now.sec` for the epoch seconds as a string); there is no `std.time.now()` function.

### time.add(time, offset) / time.sub(time, offset)

Adds or subtracts a relative time (RTIME) from a TIME value, returning a new TIME. Note that `time.sub` subtracts a duration from a time; it does not compute the difference between two times.

**Parameters:**
- `time`: The TIME value to adjust
- `offset`: The RTIME offset (e.g., `1h`, `30m`, `1d`)

**Returns:**
- The new time

**Example:**
```vcl
set req.http.X-Expires = time.add(now, 1h);
```

### std.time(string, fallback)

Parses a string into a TIME value, returning `fallback` when the string cannot be parsed.

**Example:**
```vcl
set req.http.X-Since = std.time(req.http.if-modified-since, now);
```

### std.integer2time(integer)

Converts Unix epoch seconds to a TIME value.

**Example:**
```vcl
set req.http.X-Time = std.integer2time(1719900000);
```

### strftime(format, time)

Formats a time according to the format string. The format must be written as a long string (`{"..."}`) because `%` sequences are treated as percent escapes inside quoted strings.

**Parameters:**
- `format`: The strftime format string
- `time`: The time to format

**Returns:**
- The formatted time string

**Example:**
```vcl
set req.http.X-Date = strftime({"%Y-%m-%d %H:%M:%S"}, now);
```

### Other time functions

- `time.is_after(t1, t2)`: true when `t1` is later than `t2`
- `time.hex_to_time(divisor, hex)`: parses a hexadecimal epoch value
- `time.units(unit, time)` / `time.runits(unit, rtime)`: renders a TIME/RTIME in `s`, `ms`, `us`, or `ns` units (invalid units yield a not-set string and set `fastly.error` to `EINVAL`)
- `time.interval_elapsed_ratio(now, start, end)`: elapsed fraction of an interval
- `parse_time_delta(string)`: parses a duration string like `"2h"` into seconds

## Header Functions

### header.get(where, name)

Gets the value of a header. `where` is one of the HTTP variable objects: `req`, `bereq`, `beresp`, `resp`, or `obj`.

**Parameters:**
- `where`: The request or response the header lives on (e.g., `req`)
- `name`: The name of the header to get

**Returns:**
- The value of the header, or a not-set string if absent

**Example:**
```vcl
set req.http.X-Original-UA = header.get(req, "User-Agent");
```

### header.set(where, name, value)

Sets the value of a header in place. There is no return value.

**Example:**
```vcl
header.set(req, "X-Custom-Header", "New Value");
```

### header.unset(where, name)

Removes a header. Unlike the `unset` statement, the header afterwards reads back as a set-but-empty string.

**Example:**
```vcl
header.unset(req, "X-To-Remove");
```

### header.filter(where, name, ...)

Removes the named headers, keeping all others. The arguments are header names, not patterns.

**Example:**
```vcl
header.filter(req, "Cookie", "Authorization");
```

### header.filter_except(where, name, ...)

Keeps only the named headers, removing all others.

**Example:**
```vcl
header.filter_except(req, "Host", "User-Agent");
```

### http_status_matches(status, pattern [, pattern ...])

Checks if a status code matches a pattern. Patterns may be exact codes (`"404"`), `Nxx`/`NNx` wildcards (`"5xx"`, `"30x"`), or ranges (`"400-499"`).

**Parameters:**
- `status`: The HTTP status code to check
- `pattern`: One or more patterns to match against

**Returns:**
- `true` if the status code matches any pattern, `false` otherwise

**Example:**
```vcl
if (http_status_matches(resp.status, "5xx")) {
  set resp.http.X-Error = "Server Error";
}
```

### setcookie.get_value_by_name(where, name) / setcookie.delete_by_name(where, name)

Reads or removes a cookie from the `Set-Cookie` header of `beresp` or `resp`.

**Example:**
```vcl
set resp.http.X-Session = setcookie.get_value_by_name(resp, "session");
```

## Query String Functions

The `querystring` namespace operates on URL strings and returns modified URLs (except `querystring.get`, which returns a value):

- `querystring.get(url, name)`: value of the first matching parameter, or not set
- `querystring.set(url, name, value)` / `querystring.add(url, name, value)`
- `querystring.remove(url)`: strips the entire query string
- `querystring.clean(url)`: removes parameters with an empty name
- `querystring.filter(url, names)` / `querystring.filter_except(url, names)`: removes/keeps the named parameters; multiple names are joined with `querystring.filtersep()`
- `querystring.globfilter(url, glob)` / `querystring.globfilter_except(url, glob)`
- `querystring.regfilter(url, regex)` / `querystring.regfilter_except(url, regex)`
- `querystring.sort(url)`: sorts parameters by name

**Example:**
```vcl
set req.url = querystring.filter(req.url,
  "utm_source" + querystring.filtersep() + "utm_medium");
```

## Table Functions

Tables are declared with `table` blocks and read with the `table.*` functions. The first argument is the table name as a bare identifier.

- `table.lookup(table, key [, default])`: returns the entry, the default, or a not-set string when there is no default
- `table.lookup_bool`, `table.lookup_integer`, `table.lookup_float`, `table.lookup_ip`, `table.lookup_rtime`: typed lookups with typed defaults
- `table.lookup_acl`, `table.lookup_backend`, `table.lookup_regex`
- `table.contains(table, key)`: true when the key exists

**Example:**
```vcl
table redirects {
  "/old": "/new",
}

sub vcl_recv {
  if (table.contains(redirects, req.url.path)) {
    set req.url = table.lookup(redirects, req.url.path);
  }
}
```

## Content Negotiation Functions

- `accept.language_lookup(lookup_list, default, accept_header)`: best language match against a colon-separated list
- `accept.charset_lookup(lookup_list, default, accept_header)`
- `accept.encoding_lookup(lookup_list, default, accept_header)`
- `accept.media_lookup(media_list, default, patterns, accept_header)`
- `accept.language_filter_basic(lookup_list, default, accept_header, limit)`

**Example:**
```vcl
set req.http.X-Lang = accept.language_lookup("en:de:fr", "en", req.http.accept-language);
```

## Address Functions

- `addr.is_ipv4(addr)` / `addr.is_ipv6(addr)`: address family checks
- `addr.extract_bits(addr, offset, length)`: extracts bits from an address
- `std.ip(string, fallback)`: parses a string as an IP, returning the fallback on failure
- `std.str2ip(string, fallback)`, `std.anystr2ip(string, fallback)`, `std.ip2str(ip)`

**Example:**
```vcl
if (addr.is_ipv6(client.ip)) {
  set req.http.X-IPv6 = "true";
}
```

## Digest and Cryptographic Functions

### Hashes

`digest.hash_md5`, `digest.hash_sha1`, `digest.hash_sha224`, `digest.hash_sha256`, `digest.hash_sha384`, `digest.hash_sha512`, `digest.hash_crc32`, `digest.hash_crc32b`, `digest.hash_xxh32`, and `digest.hash_xxh64` each take a string and return the hex digest. The `*_from_base64` variants (`digest.hash_sha256_from_base64`, ...) hash the decoded bytes of a base64 input.

**Example:**
```vcl
set req.http.X-SHA256 = digest.hash_sha256(req.url);
```

### HMAC

- `digest.hmac_md5(key, input)`, `digest.hmac_sha1`, `digest.hmac_sha256`, `digest.hmac_sha512`: return the MAC as `0x`-prefixed hex
- `digest.hmac_md5_base64` and friends: return the MAC base64-encoded
- `digest.hmac_sha256_with_base64_key(base64_key, input)`
- `digest.time_hmac_md5(key, interval, offset)` and the sha1/sha256/sha512 variants: TOTP-style time-based MACs
- `digest.secure_is_equal(a, b)`: constant-time string comparison
- `digest.awsv4_hmac(key, date, region, service, string)`: AWS signature v4 signing key MAC
- `digest.rsa_verify(hash_method, public_key, payload, signature [, base64_method])` and `digest.ecdsa_verify(...)`: signature verification

### Base64

- `digest.base64(string)`: encodes a string as base64 (there is no `digest.base64_encode`)
- `digest.base64_decode(string)`: decodes base64
- `digest.base64url(string)` / `digest.base64url_decode(string)`
- `digest.base64url_nopad(string)` / `digest.base64url_nopad_decode(string)`

**Example:**
```vcl
set req.http.X-Encoded = digest.base64(req.url);
```

### Symmetric encryption

`crypto.encrypt_base64(cipher, mode, padding, key, iv, plaintext)`, `crypto.decrypt_base64(...)`, `crypto.encrypt_hex(...)`, and `crypto.decrypt_hex(...)` implement Fastly's AES encryption helpers.

### Binary and UUID helpers

- `bin.base64_to_hex(string)` / `bin.hex_to_base64(string)`: conversion between encodings (invalid input yields not set and `fastly.error = "EINVAL"`)
- `uuid.version3(namespace, name)`, `uuid.version4()`, `uuid.version5(namespace, name)`, `uuid.version7()`: UUID generation
- `uuid.is_valid(s)`, `uuid.is_version3(s)`, `uuid.is_version4(s)`, `uuid.is_version5(s)`, `uuid.is_version7(s)`
- `uuid.dns()`, `uuid.url()`, `uuid.oid()`, `uuid.x500()`: well-known namespace UUIDs

## Logging Functions

### std.log(string)

Logs a message. (There is no `std.syslog` in Fastly VCL or in Fastly.JS.)

**Parameters:**
- `string`: The message to log

**Example:**
```vcl
std.log("Request received: " + req.url);
```

## Director Functions

Directors are normally declared with `director` blocks and assigned to `req.backend` directly:

```vcl
backend b1 { .host = "127.0.0.1"; .port = "8080"; }
backend b2 { .host = "127.0.0.1"; .port = "8081"; }

director my_director random {
  { .backend = b1; .weight = 2; }
  { .backend = b2; .weight = 1; }
}

sub vcl_recv {
  set req.backend = my_director;
}
```

Supported director types are `random`, `hash`, `client`, `fallback`, and `chash`. Round-robin and weighted balancing are achieved with the `random` type by tuning each backend's weight; there is no separate `round-robin` or `weighted` director type.

A runtime API mirrors the declarations:

### std.director.add(name, type)

Adds a director at runtime.

**Example:**
```vcl
std.director.add("my_director", "random");
```

### std.director.add_backend(director, backend, weight)

Adds a backend to a director.

**Example:**
```vcl
std.director.add_backend("my_director", "my_backend", 2);
```

### std.director.select_backend(director)

Selects a backend from a director, honoring the director type, backend health, and quorum. Returns the backend object, or nothing when the quorum is not met.

## Geo Functions

Geolocation data is exposed through the `client.geo.*` variables (with a `geoip.*` legacy alias), not through functions. Without a geolocation database, string fields read `"unknown"` and the coordinates default to Fastly's San Francisco headquarters; populate `context.client.geo` from JavaScript to supply real data. See the [VCL Variables Reference](./vcl-variables.md) for details.

## Ratelimit Functions

These functions live in the `ratelimit` namespace (a `std.ratelimit.*` alias also works). Rate counter and penalty box arguments are bare identifiers, following Fastly's `ID` parameter convention.

### ratelimit.ratecounter_increment(ratecounter, entry, delta)

Increments a rate counter for an entry.

**Parameters:**
- `ratecounter`: The rate counter (ID)
- `entry`: The client entry being counted (e.g., `client.ip`)
- `delta`: The amount to increment by

**Returns:**
- The new count value

**Example:**
```vcl
set req.http.X-Count = ratelimit.ratecounter_increment(rc, client.ip, 1);
```

### ratelimit.check_rate(entry, ratecounter, threshold, window, delta, penaltybox, ttl)

Increments a rate counter and checks it against a threshold. When the count within `window` seconds exceeds `threshold`, the entry is added to `penaltybox` for `ttl` and the function returns `true`.

Note the argument order: the threshold comes third and the increment delta fifth, which differs from Fastly's `(entry, rc, delta, window, limit, pb, ttl)` order.

**Example:**
```vcl
if (ratelimit.check_rate(client.ip, rc, 100, 60, 1, pb, 5m)) {
  error 429 "Too Many Requests";
}
```

### ratelimit.check_rates(entry, rc, threshold1, window1, delta1, penaltybox1, threshold2, window2, delta2, penaltybox2, ttl)

Checks an entry against two rate windows at once; returns `true` when either limit is exceeded (and adds the entry to the corresponding penalty box).

### ratelimit.penaltybox_add(penaltybox, entry, ttl)

Adds an entry to a penalty box for the given duration.

**Example:**
```vcl
ratelimit.penaltybox_add(rate_violators, client.ip, 60s);
```

### ratelimit.penaltybox_has(penaltybox, entry)

Checks if an entry is in a penalty box.

**Returns:**
- `true` if the entry is in the penalty box, `false` otherwise

**Example:**
```vcl
if (ratelimit.penaltybox_has(rate_violators, client.ip)) {
  error 429 "Too Many Requests";
}
```

### std.ratelimit.open_window(windowSeconds)

Fastly.JS extension: opens a rate counter window with the specified duration and returns a unique identifier for it.

## WAF Functions

### waf.allow()

Explicitly allows a request.

**Example:**
```vcl
if (client.ip ~ internal_ips) {
  waf.allow();
}
```

### waf.block(status, message)

Blocks a request with a status code and message.

**Parameters:**
- `status`: The HTTP status code
- `message`: The error message

**Example:**
```vcl
if (req.http.user-agent ~ "BadBot") {
  waf.block(403, "Forbidden");
}
```

### waf.log(message)

Logs a WAF message.

**Parameters:**
- `message`: The message to log

**Example:**
```vcl
waf.log("Suspicious request from " + client.ip);
```

### waf.rate_limit(identifier, limit, period)

Implements token bucket rate limiting.

**Parameters:**
- `identifier`: The identifier to rate limit
- `limit`: The maximum number of requests
- `period`: The time period in seconds

**Returns:**
- `true` if a token was available and consumed (the request is within the limit), `false` when the bucket is exhausted

**Example:**
```vcl
if (!waf.rate_limit(client.ip, 10, 60)) {
  error 429 "Too Many Requests";
}
```

### waf.rate_limit_tokens(identifier)

Checks the remaining tokens for an identifier.

**Parameters:**
- `identifier`: The identifier to check

**Returns:**
- The number of remaining tokens

**Example:**
```vcl
set req.http.X-Tokens = waf.rate_limit_tokens(client.ip);
```

### waf.detect_attack(string, type)

Detects attack patterns in a string.

**Parameters:**
- `string`: The string to check
- `type`: The type of attack to detect: `sql`, `xss`, `path`, `command`, `lfi`, `rfi`, or `any`

**Returns:**
- `true` if an attack is detected, `false` otherwise

**Example:**
```vcl
if (waf.detect_attack(req.url.qs, "sql")) {
  waf.block(403, "SQL Injection Attempt");
}
```

## Miscellaneous Functions

- `if(condition, true_value, false_value)`: ternary expression
- `early_hints(...)`, `h2.push(resource)`, `h2.disable_header_compression(...)`, `h3.alt_svc()`, and `resp.tarpit(...)` are accepted for compatibility but are no-ops locally
- `fastly.hash(key, seed, from, to)`: Fastly's consistent hash function
- `fastly.try_select_shield(...)`: accepted, always returns false locally

## Conclusion

VCL functions provide a powerful way to manipulate data and control behavior during the request-response lifecycle. By understanding and using these functions effectively, you can implement complex caching strategies, security measures, and content transformation logic.

For more information on VCL statements, see the [VCL Statements Reference](./vcl-statements.md).
