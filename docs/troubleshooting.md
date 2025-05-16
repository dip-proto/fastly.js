# Troubleshooting Guide

This guide provides solutions to common issues you might encounter when using Fastly.JS.

## VCL Parsing Issues

### Syntax Errors

**Problem**: The VCL parser reports a syntax error in your VCL file.

**Solution**:

1. Check the error message for the line number and column where the error occurred.
2. Verify that the syntax is correct according to the VCL specification.
3. Common syntax errors include:
   - Missing semicolons at the end of statements
   - Unbalanced braces or parentheses
   - Invalid operators or expressions
   - Typos in keywords or identifiers

**Example Error**:

```text
Error parsing VCL: Unexpected token at line 10, column 15
```

**Example Fix**:

```vcl
# Before (missing semicolon)
set req.http.X-Test = "value";

# After (fixed)
set req.http.X-Test = "value";
```

### Unsupported Features

**Problem**: The VCL parser reports an error for a feature that is supported by Fastly but not by Fastly.JS.

**Solution**:

1. Check the [TECHNICAL_DETAILS.md](../TECHNICAL_DETAILS.md) file for a list of supported and unsupported features.
2. If the feature is not supported, you may need to find an alternative approach or wait for a future release.
3. Consider contributing to the project by implementing the missing feature.

**Example Error**:

```text
Error: Unsupported feature: Custom VCL extensions
```

**Example Workaround**:

```vcl
# Before (using custom VCL extension)
custom_function(req.url);

# After (workaround without custom extension)
# Implement a different approach using standard VCL functions
```

## Runtime Issues

### Backend Connection Errors

**Problem**: Fastly.JS cannot connect to the backend server.

**Solution**:

1. Verify that the backend server is running and accessible.
2. Check the backend configuration in your VCL file:
   - Correct hostname or IP address
   - Correct port number
   - SSL/TLS settings
3. Check if the backend server requires authentication or has firewall restrictions.
4. Increase the connection timeout if the backend server is slow to respond.

**Example Error**:

```text
Error connecting to backend 'default': Connection refused
```

**Example Fix**:

```vcl
# Before (incorrect backend configuration)
backend default {
  .host = "example.com";
  .port = "8080";  # Incorrect port
}

# After (fixed)
backend default {
  .host = "example.com";
  .port = "80";  # Correct port
}
```

### Cache Issues

**Problem**: Content is not being cached as expected.

**Solution**:

1. Verify that the request is cacheable:
   - GET or HEAD method
   - No authentication headers
   - No cookies
   - No query parameters (unless explicitly included in the cache key)
2. Check the TTL settings in `vcl_fetch`:
   - Ensure that `beresp.ttl` is set to a positive value
   - Verify that `beresp.ttl` is not being overridden elsewhere
3. Check the cache key generation in `vcl_hash`:
   - Ensure that the cache key includes all relevant request attributes
   - Verify that the cache key is not too specific (which would result in cache misses)
4. Add debug headers to help diagnose the issue:
   - `X-Cache`: HIT or MISS
   - `X-Cache-TTL`: The TTL of the cached response
   - `X-Cache-Key`: The cache key used for the request

**Example Debug Headers**:

```vcl
sub vcl_deliver {
  # Add cache status header
  if (obj.hits > 0) {
    set resp.http.X-Cache = "HIT";
    set resp.http.X-Cache-Hits = obj.hits;
  } else {
    set resp.http.X-Cache = "MISS";
  }

  # Add TTL header
  set resp.http.X-Cache-TTL = beresp.ttl;

  # Add cache key components
  set resp.http.X-Cache-Key-URL = req.url;
  set resp.http.X-Cache-Key-Host = req.http.host;
}
```

### Performance Issues

**Problem**: Fastly.JS is slow to respond to requests.

**Solution**:

1. Check the backend response time:
   - Use the `X-Backend-Response-Time` header to measure backend response time
   - Optimize the backend server if it's slow to respond
2. Optimize caching:
   - Increase TTLs for frequently accessed content
   - Use stale-while-revalidate to serve stale content while fetching fresh content
   - Implement cache variations only when necessary
3. Optimize VCL code:
   - Simplify complex regular expressions
   - Minimize the use of expensive functions
   - Use table lookups instead of complex conditionals
4. Monitor memory usage:
   - Fastly.JS uses an in-memory cache, which can consume a lot of memory
   - Consider limiting the cache size or implementing cache eviction policies

**Example Performance Optimization**:

```vcl
# Before (inefficient regex)
if (req.url ~ "^/products/([0-9]+)/([a-zA-Z0-9-]+)") {
  # ...
}

# After (more efficient)
if (req.url ~ "^/products/\d+/[a-zA-Z0-9-]+") {
  # ...
}
```

## Common Error Messages

### "Error loading VCL file"

**Problem**: Fastly.JS cannot load the specified VCL file.

**Solution**:

1. Verify that the file exists at the specified path.
2. Check file permissions to ensure that Fastly.JS can read the file.
3. Verify that the file is a valid VCL file.

### "Error parsing VCL"

**Problem**: Fastly.JS cannot parse the VCL file due to syntax errors.

**Solution**:

1. Check the error message for the line number and column where the error occurred.
2. Fix the syntax error according to the VCL specification.
3. Use a VCL linter or validator to check for syntax errors before running Fastly.JS.

### "Unknown subroutine"

**Problem**: Fastly.JS cannot find a subroutine that is referenced in the VCL file.

**Solution**:

1. Verify that the subroutine is defined in the VCL file.
2. Check for typos in the subroutine name.
3. Ensure that the subroutine is defined before it is referenced.

### "Invalid return value"

**Problem**: A subroutine returns an invalid value for its context.

**Solution**:

1. Check the valid return values for the subroutine:
   - `vcl_recv`: `lookup`, `pass`, `pipe`, `error`, `hash`, `purge`
   - `vcl_hash`: `hash`
   - `vcl_hit`: `deliver`, `pass`, `restart`, `error`
   - `vcl_miss`: `fetch`, `pass`, `error`
   - `vcl_pass`: `fetch`, `error`
   - `vcl_fetch`: `deliver`, `pass`, `error`, `restart`
   - `vcl_deliver`: `deliver`, `restart`, `error`
   - `vcl_error`: `deliver`, `restart`
   - `vcl_log`: No return value required
2. Correct the return value to a valid one for the subroutine.

## Debugging Techniques

### Logging

Use the `std.log` function to log information at different stages of the request flow:

```vcl
sub vcl_recv {
  std.log("Received request: " + req.method + " " + req.url);
}

sub vcl_fetch {
  std.log("Backend response: " + beresp.status);
}

sub vcl_deliver {
  std.log("Delivered response: " + resp.status);
}
```

### Debug Headers

Add debug headers to the response to help diagnose issues:

```vcl
sub vcl_deliver {
  # Add request information
  set resp.http.X-Request-Method = req.method;
  set resp.http.X-Request-URL = req.url;
  set resp.http.X-Request-Host = req.http.host;

  # Add cache information
  set resp.http.X-Cache = obj.hits > 0 ? "HIT" : "MISS";
  set resp.http.X-Cache-Hits = obj.hits;

  # Add backend information
  set resp.http.X-Backend = req.backend;

  # Add timing information (if available)
  # Note: time.elapsed may not be implemented in all versions
  # Use std.time.now() and calculate differences manually if needed
  set resp.http.X-Response-Time = std.time.now();
}
```

### Verbose Mode

Run Fastly.JS in verbose mode to get more detailed output:

```bash
bun run index.ts --verbose my-vcl-file.vcl
```

### Using Multiple VCL Files

If you're having issues with a complex VCL configuration, try splitting it into multiple files for better organization:

```bash
bun run index.ts common.vcl backends.vcl caching.vcl custom-logic.vcl
```

This can help isolate issues and make your configuration more maintainable.

## Getting Help

If you're still having issues after trying the solutions in this guide, you can:

1. Check the project's GitHub Issues for similar problems and solutions.
2. Create a new issue with a detailed description of the problem, including:
   - The VCL file that's causing the issue
   - The error message or unexpected behavior
   - Steps to reproduce the issue
   - Any debugging information you've gathered

## Contributing

If you find a bug or have a feature request, please consider contributing to the project:

1. Fork the repository
2. Create a new branch for your changes
3. Make your changes and add tests
4. Submit a pull request

See the [Contributing Guide](../CONTRIBUTING.md) for more information.
