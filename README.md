# Fastly VCL Proxy

A TypeScript implementation of the Fastly edge computing platform with full VCL (Varnish Configuration Language) support, built with the Bun JavaScript runtime.

## Project Overview

This project aims to reimplement the Fastly CDN and edge computing platform with a focus on VCL compatibility. It provides a local development environment for testing and deploying Fastly VCL configurations without requiring the actual Fastly infrastructure.

### What is Fastly VCL?

Fastly VCL (Varnish Configuration Language) is a domain-specific language used to configure and customize how Fastly's edge cloud platform processes HTTP requests and responses. It's based on the open-source Varnish Cache language but includes Fastly-specific extensions and features that enhance its capabilities.

## Features

- **Complete VCL Implementation**: Parse and execute Fastly VCL scripts with support for all standard subroutines
- **HTTP Request Pipeline**: Implements the full Fastly request flow (vcl_recv, vcl_hash, vcl_hit, vcl_miss, vcl_fetch, vcl_deliver, etc.)
- **Standard Library**: Comprehensive implementation of Fastly's VCL standard library functions
- **Edge Computing**: Execute logic at the edge, closer to users
- **Caching**: Advanced caching capabilities with fine-grained control
- **Backend Configuration**: Support for multiple backends, health checks, and load balancing
- **Error Handling**: Comprehensive error handling with custom error pages
- **Random Functions**: Generate random values with deterministic seeded options
- **Director Management**: Implement load balancing across multiple backends

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

Start the proxy server with a VCL configuration file:

```bash
bun run index.ts [path-to-vcl-file]
```

If no VCL file is specified, it will use the default `filter.vcl` in the project root.

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

This project is actively under development. See the `TODO.md` file for a detailed roadmap and current implementation status.

## License

MIT

---

This project uses [Bun](https://bun.sh), a fast all-in-one JavaScript runtime.
