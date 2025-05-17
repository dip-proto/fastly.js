# VCL Functions Reference

VCL (Varnish Configuration Language) functions provide a way to perform operations on data during the request-response lifecycle. This document provides a reference for the standard VCL functions supported by Fastly.JS.

## Overview

VCL functions are organized into several categories:

1. **String Functions**: Functions for working with strings
2. **Math Functions**: Functions for mathematical operations
3. **Time Functions**: Functions for working with dates and times
4. **Digest Functions**: Functions for cryptographic operations
5. **HTTP Functions**: Functions for HTTP header and status manipulation
6. **Logging Functions**: Functions for logging messages
7. **Director Functions**: Functions for backend selection
8. **Geo Functions**: Functions for geolocation
9. **Ratelimit Functions**: Functions for rate limiting
10. **WAF Functions**: Functions for web application firewall

## String Functions

### std.strlen(string)

Returns the length of a string.

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
set req.http.X-Upper = std.toupper(req.http.Host);
```

### std.tolower(string)

Converts a string to lowercase.

**Parameters:**
- `string`: The string to convert

**Returns:**
- The lowercase string

**Example:**
```vcl
set req.http.X-Lower = std.tolower(req.http.Host);
```

### std.substr(string, offset, length)

Returns a substring.

**Parameters:**
- `string`: The string to extract from
- `offset`: The starting position
- `length`: The length of the substring

**Returns:**
- The extracted substring

**Example:**
```vcl
set req.http.X-Subdomain = std.substr(req.http.Host, 0, std.strstr(req.http.Host, "."));
```

### std.strstr(haystack, needle)

Finds the first occurrence of a substring.

**Parameters:**
- `haystack`: The string to search in
- `needle`: The string to search for

**Returns:**
- The substring from the first occurrence of `needle` to the end of `haystack`

**Example:**
```vcl
set req.http.X-Domain = std.strstr(req.http.Host, ".");
```

### std.regsuball(string, pattern, replacement)

Replaces all occurrences of a pattern with a replacement.

**Parameters:**
- `string`: The string to modify
- `pattern`: The pattern to replace
- `replacement`: The replacement string

**Returns:**
- The modified string

**Example:**
```vcl
set req.url = std.regsuball(req.url, "^/old/", "/new/");
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

## Math Functions

### std.atoi(string)

Converts a string to an integer.

**Parameters:**
- `string`: The string to convert

**Returns:**
- The integer value

**Example:**
```vcl
set req.http.X-Page = std.atoi(req.url.qs);
```

### std.random.randombool(probability)

Returns a random boolean with the given probability.

**Parameters:**
- `probability`: The probability of returning true (0.0 to 1.0)

**Returns:**
- A random boolean

**Example:**
```vcl
if (std.random.randombool(0.1)) {
  set req.http.X-Debug = "true";
}
```

### std.random.randomint(min, max)

Returns a random integer between min and max.

**Parameters:**
- `min`: The minimum value
- `max`: The maximum value

**Returns:**
- A random integer

**Example:**
```vcl
set req.http.X-Random = std.random.randomint(1, 100);
```

## Time Functions

### std.time.now()

Returns the current time as a Unix timestamp.

**Returns:**
- The current time

**Example:**
```vcl
set req.http.X-Time = std.time.now();
```

### std.time.add(time, offset)

Adds an offset to a time.

**Parameters:**
- `time`: The time to add to
- `offset`: The offset to add (e.g., "1h", "30m", "1d")

**Returns:**
- The new time

**Example:**
```vcl
set req.http.X-Expires = std.time.add(std.time.now(), "1h");
```

### std.time.sub(time1, time2)

Calculates the difference between two times.

**Parameters:**
- `time1`: The first time
- `time2`: The second time

**Returns:**
- The difference in seconds

**Example:**
```vcl
set req.http.X-Age = std.time.sub(std.time.now(), obj.time.start);
```

### std.strftime(format, time)

Formats a time according to the format string.

**Parameters:**
- `format`: The format string
- `time`: The time to format

**Returns:**
- The formatted time string

**Example:**
```vcl
set req.http.X-Date = std.strftime("%Y-%m-%d %H:%M:%S", std.time.now());
```

## HTTP Functions

### header.get(headers, name)

Gets the value of a header.

**Parameters:**
- `headers`: The headers object (e.g., `req.http.*`)
- `name`: The name of the header to get

**Returns:**
- The value of the header, or an empty string if not found

**Example:**
```vcl
set req.http.X-Original-UA = header.get(req.http.*, "User-Agent");
```

### header.set(headers, name, value)

Sets the value of a header.

**Parameters:**
- `headers`: The headers object (e.g., `req.http.*`)
- `name`: The name of the header to set
- `value`: The value to set

**Returns:**
- The modified headers object

**Example:**
```vcl
set req.http.* = header.set(req.http.*, "X-Custom-Header", "New Value");
```

### header.unset(headers, name)

Removes a header.

**Parameters:**
- `headers`: The headers object (e.g., `req.http.*`)
- `name`: The name of the header to remove

**Returns:**
- The modified headers object

**Example:**
```vcl
set req.http.* = header.unset(req.http.*, "X-To-Remove");
```

### header.filter(headers, pattern)

Keeps only headers that match a pattern.

**Parameters:**
- `headers`: The headers object (e.g., `req.http.*`)
- `pattern`: The regex pattern to match header names against

**Returns:**
- The filtered headers object

**Example:**
```vcl
set req.http.* = header.filter(req.http.*, "^X-");
```

### header.filter_except(headers, pattern)

Removes headers that match a pattern.

**Parameters:**
- `headers`: The headers object (e.g., `req.http.*`)
- `pattern`: The regex pattern to match header names against

**Returns:**
- The filtered headers object

**Example:**
```vcl
set req.http.* = header.filter_except(req.http.*, "^X-");
```

### http.status_matches(status, pattern)

Checks if a status code matches a pattern.

**Parameters:**
- `status`: The HTTP status code to check
- `pattern`: The pattern to match against (e.g., "2xx", "30[1-3]", "4xx,5xx")

**Returns:**
- `true` if the status code matches the pattern, `false` otherwise

**Example:**
```vcl
if (http.status_matches(resp.status, "5xx")) {
  set resp.http.X-Error = "Server Error";
}
```

## Digest Functions

### digest.hash_md5(string)

Calculates the MD5 hash of a string.

**Parameters:**
- `string`: The string to hash

**Returns:**
- The MD5 hash

**Example:**
```vcl
set req.http.X-MD5 = digest.hash_md5(req.url);
```

### digest.hash_sha1(string)

Calculates the SHA-1 hash of a string.

**Parameters:**
- `string`: The string to hash

**Returns:**
- The SHA-1 hash

**Example:**
```vcl
set req.http.X-SHA1 = digest.hash_sha1(req.url);
```

### digest.hash_sha256(string)

Calculates the SHA-256 hash of a string.

**Parameters:**
- `string`: The string to hash

**Returns:**
- The SHA-256 hash

**Example:**
```vcl
set req.http.X-SHA256 = digest.hash_sha256(req.url);
```

### digest.base64_decode(string)

Decodes a base64-encoded string.

**Parameters:**
- `string`: The base64-encoded string

**Returns:**
- The decoded string

**Example:**
```vcl
set req.http.X-Decoded = digest.base64_decode(req.http.X-Encoded);
```

### digest.base64_encode(string)

Encodes a string as base64.

**Parameters:**
- `string`: The string to encode

**Returns:**
- The base64-encoded string

**Example:**
```vcl
set req.http.X-Encoded = digest.base64_encode(req.url);
```

## Logging Functions

### std.log(string)

Logs a message.

**Parameters:**
- `string`: The message to log

**Example:**
```vcl
std.log("Request received: " + req.url);
```

### std.syslog(priority, string)

Logs a message with the given priority.

**Parameters:**
- `priority`: The log priority (0-7)
- `string`: The message to log

**Example:**
```vcl
std.syslog(3, "Error processing request: " + req.url);
```

## Director Functions

### std.director.add(name, type)

Adds a director.

**Parameters:**
- `name`: The name of the director
- `type`: The type of the director (e.g., "random", "round-robin", "hash", "client")

**Example:**
```vcl
std.director.add("my_director", "random");
```

### std.director.add_backend(director, backend, weight)

Adds a backend to a director.

**Parameters:**
- `director`: The name of the director
- `backend`: The name of the backend
- `weight`: The weight of the backend

**Example:**
```vcl
std.director.add_backend("my_director", "my_backend", 2);
```

### std.director.select_backend(director)

Selects a backend from a director.

**Parameters:**
- `director`: The name of the director

**Returns:**
- The selected backend

**Example:**
```vcl
set req.backend = std.director.select_backend("my_director").name;
```

## Geo Functions

### std.geo.lookup(ip)

Looks up geolocation data for an IP address.

**Parameters:**
- `ip`: The IP address to look up

**Returns:**
- The geolocation data

**Example:**
```vcl
set req.http.X-Country = std.geo.lookup(client.ip).country_code;
```

## Ratelimit Functions

### std.ratelimit.open_window(windowSeconds)

Opens a rate counter window with the specified duration.

**Parameters:**
- `windowSeconds`: The window duration in seconds

**Returns:**
- A unique identifier for the window

**Example:**
```vcl
set req.http.X-Window-ID = std.ratelimit.open_window(60);
```

### std.ratelimit.ratecounter_increment(counterName, incrementBy)

Increments a named rate counter.

**Parameters:**
- `counterName`: The name of the counter
- `incrementBy`: The amount to increment by (default: 1)

**Returns:**
- The new count value

**Example:**
```vcl
set req.http.X-Count = std.ratelimit.ratecounter_increment(client.ip, 1);
```

### std.ratelimit.check_rate(counterName, ratePerSecond)

Checks if a rate limit has been exceeded.

**Parameters:**
- `counterName`: The name of the counter
- `ratePerSecond`: The maximum allowed rate

**Returns:**
- `true` if the rate limit has been exceeded, `false` otherwise

**Example:**
```vcl
if (std.ratelimit.check_rate(client.ip, 10)) {
  error 429 "Too Many Requests";
}
```

### std.ratelimit.check_rates(counterName, rates)

Checks if any of multiple rate limits have been exceeded.

**Parameters:**
- `counterName`: The name of the counter
- `rates`: A comma-separated list of rates in the format "count:seconds"

**Returns:**
- `true` if any rate limit has been exceeded, `false` otherwise

**Example:**
```vcl
if (std.ratelimit.check_rates(client.ip, "10:5,100:60,1000:3600")) {
  error 429 "Too Many Requests";
}
```

### std.ratelimit.penaltybox_add(penaltyboxName, identifier, duration)

Adds an identifier to a penalty box for a specified duration.

**Parameters:**
- `penaltyboxName`: The name of the penalty box
- `identifier`: The identifier to add
- `duration`: The duration in seconds

**Example:**
```vcl
std.ratelimit.penaltybox_add("rate_violators", client.ip, 60);
```

### std.ratelimit.penaltybox_has(penaltyboxName, identifier)

Checks if an identifier is in a penalty box.

**Parameters:**
- `penaltyboxName`: The name of the penalty box
- `identifier`: The identifier to check

**Returns:**
- `true` if the identifier is in the penalty box, `false` otherwise

**Example:**
```vcl
if (std.ratelimit.penaltybox_has("rate_violators", client.ip)) {
  error 429 "Too Many Requests";
}
```

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
if (req.http.User-Agent ~ "BadBot") {
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
- `true` if the rate limit has been exceeded, `false` otherwise

**Example:**
```vcl
if (waf.rate_limit(client.ip, 10, 60)) {
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
- `type`: The type of attack to detect (e.g., "sql", "xss", "path")

**Returns:**
- `true` if an attack is detected, `false` otherwise

**Example:**
```vcl
if (waf.detect_attack(req.url.qs, "sql")) {
  waf.block(403, "SQL Injection Attempt");
}
```

## Conclusion

VCL functions provide a powerful way to manipulate data and control behavior during the request-response lifecycle. By understanding and using these functions effectively, you can implement complex caching strategies, security measures, and content transformation logic.

For more information on VCL statements, see the [VCL Statements Reference](./vcl-statements.md).
