# Fastly.JS

A reimplementation of the Fastly platform, in JavaScript.

## Project Overview

This project aims to provide a local development environment for testing and deploying Fastly VCL configurations without requiring the actual Fastly infrastructure. Fastly.JS allows you to run and test your VCL configurations locally, making it easier to develop, debug, and iterate on your Fastly configurations.

## Documentation

For comprehensive documentation, tutorials, and examples, please visit the [documentation](docs/README.md).

- [Getting Started Guide](docs/getting-started.md)
- [Tutorials](docs/README.md#tutorials)
- [Examples](docs/README.md#examples)
- [API Reference](docs/README.md#api-reference)
- [Troubleshooting](docs/troubleshooting.md)

## Features

- **Complete VCL Implementation**: Parse and execute Fastly VCL scripts with support for all standard subroutines
- **HTTP Request Pipeline**: Implements the full Fastly request flow (vcl_recv, vcl_hash, vcl_hit, vcl_miss, vcl_fetch, vcl_deliver, etc.)
- **Standard Library**: Comprehensive implementation of Fastly's VCL standard library functions
- **Edge Computing**: Execute logic at the edge, closer to users
- **Caching**: Advanced caching capabilities with fine-grained control
- **Backend Configuration**: Support for multiple backends, health checks, and load balancing
- **Error Handling**: Comprehensive error handling with custom error pages
- **Edge Side Includes (ESI)**: Dynamic content assembly at the edge with ESI tags
- **Random Functions**: Generate random values with deterministic seeded options
- **UUID Functions**: Generate and validate UUIDs (v3, v4, v5) with namespace support
- **WAF Functions**: Web Application Firewall with attack detection and rate limiting
- **Director Management**: Implement load balancing across multiple backends
- **Goto Statements**: Control flow with goto statements and labels

## Requirements

- [Bun](https://bun.sh) runtime (v1.0.0 or higher)
- Node.js 16+ (for some development tools)

## Installation

```bash
# Install dependencies
bun install
```

## Usage

### Basic Usage

Start the proxy server with one or more VCL configuration files:

```bash
bun run index.ts [path-to-vcl-file-1] [path-to-vcl-file-2] ...
```

If no VCL files are specified, it will use the default `filter.vcl` in the project root.

When multiple VCL files are provided, they are concatenated in the order they are specified, and the result is treated as a single VCL file. This allows you to split your VCL configuration into multiple files for better organization.

Then, open your browser and navigate to:

```text
http://127.0.0.1:8000
```

All requests will be processed according to your VCL configuration.

### Examples

#### Example 1: Basic Caching

Create a file named `basic-cache.vcl` with the following content:

```vcl
sub vcl_recv {
  # Pass dynamic content directly to the backend
  if (req.url ~ "^/api/" || req.url ~ "\?") {
    return(pass);
  }

  # Continue to cache lookup for static content
  return(lookup);
}

sub vcl_fetch {
  # Cache static assets for 1 hour
  if (req.url ~ "\.(jpg|jpeg|png|gif|ico|css|js)$") {
    set beresp.ttl = 1h;
  } else {
    # Cache other content for 5 minutes
    set beresp.ttl = 5m;
  }
  return(deliver);
}
```

Run the proxy with this configuration:

```bash
bun run index.ts basic-cache.vcl
```

#### Example 2: A/B Testing

Create a file named `ab-test.vcl` with the following content:

```vcl
sub vcl_recv {
  # Randomly assign users to A or B variant (50/50 split)
  if (!req.http.X-ABTest) {
    if (std.random.randombool(0.5)) {
      set req.http.X-ABTest = "A";
    } else {
      set req.http.X-ABTest = "B";
    }
  }

  # Add the variant to the cache key
  set req.http.Fastly-Cache-Key = req.http.X-ABTest;

  return(lookup);
}

sub vcl_deliver {
  # Add the variant to the response headers
  set resp.http.X-ABTest = req.http.X-ABTest;

  return(deliver);
}
```

Run the proxy with this configuration:

```bash
bun run index.ts ab-test.vcl
```

#### Example 3: Error Handling

Create a file named `error-handling.vcl` with the following content:

```vcl
sub vcl_recv {
  # Block access to admin area from non-internal IPs
  if (req.url ~ "^/admin/" && client.ip !~ "^(127\.0\.0\.1|192\.168\.)") {
    error 403 "Forbidden";
  }

  return(lookup);
}

sub vcl_error {
  # Custom error page
  if (obj.status == 403) {
    set obj.http.Content-Type = "text/html; charset=utf-8";
    synthetic {"
      <!DOCTYPE html>
      <html>
        <head>
          <title>Access Denied</title>
        </head>
        <body>
          <h1>Access Denied</h1>
          <p>You do not have permission to access this area.</p>
        </body>
      </html>
    "};
    return(deliver);
  }

  return(deliver);
}
```

Run the proxy with this configuration:

```bash
bun run index.ts error-handling.vcl
```

#### Example 4: WAF and Rate Limiting

Create a file named `waf-protection.vcl` with the following content:

```vcl
sub vcl_recv {
  # Block SQL injection attempts
  if (waf.detect_attack(req.url, "sql")) {
    waf.log("SQL injection attempt detected in URL: " + req.url);
    error 403 "Forbidden";
  }

  # Block XSS attempts
  if (waf.detect_attack(req.http.User-Agent, "xss")) {
    waf.log("XSS attempt detected in User-Agent: " + req.http.User-Agent);
    error 403 "Forbidden";
  }

  # Rate limit by client IP (10 requests per 5 seconds)
  if (!waf.rate_limit(client.ip, 10, 5)) {
    waf.log("Rate limit exceeded for IP: " + client.ip);
    error 429 "Too Many Requests";
  }

  return(lookup);
}

sub vcl_error {
  # Custom error page for rate limiting
  if (obj.status == 429) {
    set obj.http.Content-Type = "text/html; charset=utf-8";
    set obj.http.Retry-After = "5";
    synthetic {"
      <!DOCTYPE html>
      <html>
        <head>
          <title>Rate Limit Exceeded</title>
        </head>
        <body>
          <h1>Rate Limit Exceeded</h1>
          <p>You have made too many requests. Please try again in 5 seconds.</p>
        </body>
      </html>
    "};
    return(deliver);
  }

  return(deliver);
}
```

Run the proxy with this configuration:

```bash
bun run index.ts waf-protection.vcl
```

#### Example 5: Rate Limiting

Create a file named `rate-limiting.vcl` with the following content:

```vcl
sub vcl_recv {
  # Open a rate counter window with a 60-second duration
  set req.http.X-Window-ID = std.ratelimit.open_window(60);

  # Increment a counter for this client IP
  set req.http.X-Counter = std.ratelimit.ratecounter_increment(client.ip, 1);

  # Check if the client has exceeded 10 requests per 5 seconds
  if (std.ratelimit.check_rates(client.ip, "10:5,100:60,1000:3600")) {
    # Add the client to a penalty box for 60 seconds
    std.ratelimit.penaltybox_add("rate_violators", client.ip, 60);
    error 429 "Too Many Requests";
  }

  # Check if the client is in the penalty box
  if (std.ratelimit.penaltybox_has("rate_violators", client.ip)) {
    error 429 "Too Many Requests";
  }

  return(lookup);
}

sub vcl_error {
  # Custom error page for rate limiting
  if (obj.status == 429) {
    set obj.http.Content-Type = "text/html; charset=utf-8";
    set obj.http.Retry-After = "60";
    synthetic {"
      <!DOCTYPE html>
      <html>
        <head>
          <title>Rate Limit Exceeded</title>
        </head>
        <body>
          <h1>Rate Limit Exceeded</h1>
          <p>You have made too many requests. Please try again in 60 seconds.</p>
        </body>
      </html>
    "};
    return(deliver);
  }

  return(deliver);
}
```

Run the proxy with this configuration:

```bash
bun run index.ts rate-limiting.vcl
```

#### Example 6: Flow Control with Goto

Create a file named `goto-flow.vcl` with the following content:

```vcl
sub vcl_recv {
  if (req.http.Cookie ~ "logged_in=true") {
    # Jump to logged-in user processing
    goto logged_in_user;
  } else {
    # Jump to anonymous user processing
    goto anonymous_user;
  }

  # Logged-in user processing
  logged_in_user:
    set req.http.X-User-Type = "logged_in";

    if (req.http.Cookie ~ "user_role=admin") {
      # Jump to admin user processing
      goto admin_user;
    } else {
      # Jump to regular user processing
      goto regular_user;
    }

  # Anonymous user processing
  anonymous_user:
    set req.http.X-User-Type = "anonymous";
    goto user_end;

  # Admin user processing
  admin_user:
    set req.http.X-User-Role = "admin";
    goto user_end;

  # Regular user processing
  regular_user:
    set req.http.X-User-Role = "regular";

  # End of user processing
  user_end:
    set req.http.X-User-Processing-Complete = "true";

  return(lookup);
}

sub vcl_deliver {
  # Add user information to response headers
  if (req.http.X-User-Type) {
    set resp.http.X-User-Type = req.http.X-User-Type;
  }

  if (req.http.X-User-Role) {
    set resp.http.X-User-Role = req.http.X-User-Role;
  }

  return(deliver);
}
```

Run the proxy with this configuration:

```bash
bun run index.ts goto-flow.vcl
```

### Using with Custom Backends

You can configure multiple backends in your VCL file:

```vcl
backend api {
  .host = "api.example.com";
  .port = "443";
  .ssl = true;
}

backend static {
  .host = "static.example.com";
  .port = "443";
  .ssl = true;
}

sub vcl_recv {
  # Route requests to appropriate backends
  if (req.url ~ "^/api/") {
    set req.backend = api;
  } else if (req.url ~ "^/static/") {
    set req.backend = static;
  }

  return(lookup);
}
```

This configuration will route requests to different backends based on the URL path.

## Testing

Run the test suite to verify VCL functionality:

```bash
bun run test/run-tests.ts
```

This will execute all test suites, including:

- Basic VCL syntax tests
- Standard library function tests
- Caching behavior tests
- Backend error handling tests
- Random functions tests
- Accept header functions tests
- Address functions tests
- Binary data functions tests
- Digest functions tests
- Query string functions tests
- UUID functions tests
- WAF functions tests

## Project Structure

- `src/`: Core implementation files
  - `vcl.ts`: Main VCL interface for loading and executing VCL files
  - `vcl-parser.ts`: VCL lexer and parser
  - `vcl-compiler.ts`: Compiles VCL AST to executable functions
  - `vcl-types.ts`: TypeScript type definitions for VCL
- `test/`: Test suites and framework
- `fastly-vcl/`: Documentation and specifications for Fastly VCL
  - `vcl-functions/`: Detailed documentation for all VCL functions

## Configuration

You can modify the following constants in `index.ts` to change the proxy settings:

- `PROXY_HOST`: The host to listen on (default: "127.0.0.1")
- `PROXY_PORT`: The port to listen on (default: 8000)
- `VCL_FILE_PATH`: The path to the VCL file to load (default: "filter.vcl" or specified via command line)

## Development Status

See the `TODO.md` file for a detailed roadmap and current implementation status.
