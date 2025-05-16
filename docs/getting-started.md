# Getting Started with Fastly.JS

This guide will walk you through the process of installing and setting up Fastly.JS, and creating your first VCL configuration.

## Prerequisites

Before you begin, make sure you have the following installed:

- [Bun](https://bun.sh) runtime (v1.0.0 or higher)
- Node.js 16+ (for some development tools)
- Git (for cloning the repository)

## Installation

1. Clone the Fastly.JS repository:

```bash
git clone <repository-url>
cd fastly.js
```

2. Install dependencies:

```bash
bun install
```

## Basic Concepts

Before diving into VCL, let's understand some basic concepts:

### VCL (Varnish Configuration Language)

VCL is a domain-specific language used to configure Fastly's edge cloud platform. It's based on the open-source Varnish Cache language but includes Fastly-specific extensions and features.

### Request Flow

The VCL request flow consists of several stages:

1. **vcl_recv**: Executed when a request is received
2. **vcl_hash**: Executed to create a hash key for the request
3. **vcl_hit**: Executed when the request is found in cache
4. **vcl_miss**: Executed when the request is not found in cache
5. **vcl_pass**: Executed when the request is passed to the backend
6. **vcl_fetch**: Executed when the response is received from the backend
7. **vcl_deliver**: Executed before the response is delivered to the client
8. **vcl_error**: Executed when an error occurs
9. **vcl_log**: Executed after the response is delivered to the client

### Backends

Backends are the origin servers that Fastly.JS proxies requests to. You can define multiple backends in your VCL configuration.

### Caching

Caching is the process of storing responses from backends and serving them directly to clients without contacting the backend again. Fastly.JS supports TTL-based caching, grace periods, and stale-while-revalidate.

## Your First VCL Configuration

Let's create a simple VCL configuration that caches static content and passes dynamic content directly to the backend.

Create a file named `my-first-vcl.vcl` with the following content:

```vcl
# Define the backend server
backend default {
  .host = "example.com";
  .port = "80";
}

# This subroutine is executed when a request is received
sub vcl_recv {
  # Log the incoming request
  std.log("Received request: " + req.method + " " + req.url);

  # Pass dynamic content directly to the backend
  if (req.url ~ "^/api/" || req.url ~ "\?") {
    return(pass);
  }

  # Continue to cache lookup for static content
  return(lookup);
}

# This subroutine is executed when the response is received from the backend
sub vcl_fetch {
  # Cache static assets for 1 hour
  if (req.url ~ "\.(jpg|jpeg|png|gif|ico|css|js)$") {
    set beresp.ttl = 1h;
  } else {
    # Cache other content for 5 minutes
    set beresp.ttl = 5m;
  }

  # Add a custom header to indicate the cache TTL
  set beresp.http.X-Cache-TTL = beresp.ttl;

  return(deliver);
}

# This subroutine is executed before the response is delivered to the client
sub vcl_deliver {
  # Add a custom header to indicate whether the response was cached
  if (obj.hits > 0) {
    set resp.http.X-Cache = "HIT";
  } else {
    set resp.http.X-Cache = "MISS";
  }

  # Add a custom header to indicate the proxy server
  set resp.http.X-Powered-By = "Fastly.JS";

  return(deliver);
}
```

## Running Your VCL Configuration

To run your VCL configuration, use the following command:

```bash
bun run index.ts my-first-vcl.vcl
```

You can also specify multiple VCL files, which will be concatenated in the order they are specified:

```bash
bun run index.ts common-settings.vcl backends.vcl caching-rules.vcl
```

This will start the Fastly.JS proxy server with your VCL configuration. You should see output similar to the following:

```bash
Loading VCL files: my-first-vcl.vcl
Loaded VCL files: my-first-vcl.vcl (1234 bytes)
Parsed VCL files: 3 subroutines
Compiled VCL files: 3 subroutines
Setting up backends...
Backends configured: default
HTTP Proxy server running at http://127.0.0.1:8000
Default backend: example.com:80
Using VCL files: my-first-vcl.vcl
```

When using multiple VCL files, the output will show all the files that were loaded:

```bash
Loading VCL files: common-settings.vcl, backends.vcl, caching-rules.vcl
Loaded VCL files: common-settings.vcl, backends.vcl, caching-rules.vcl (3456 bytes)
Parsed VCL files: 5 subroutines
Compiled VCL files: 5 subroutines
Setting up backends...
Backends configured: default, api, static
HTTP Proxy server running at http://127.0.0.1:8000
Default backend: example.com:80
Using VCL files: common-settings.vcl, backends.vcl, caching-rules.vcl
```

## Testing Your VCL Configuration

Now that your proxy server is running, you can test it by sending requests to it. Open your browser and navigate to:

```text
http://127.0.0.1:8000
```

You should see the content from example.com, and the response headers should include the custom headers you added in your VCL configuration:

- `X-Cache`: Indicates whether the response was cached (HIT or MISS)
- `X-Powered-By`: Indicates the proxy server (Fastly.JS)
- `X-Cache-TTL`: Indicates the cache TTL for the response

You can also use curl to test your VCL configuration:

```bash
curl -v http://127.0.0.1:8000
```

## Next Steps

Now that you've created your first VCL configuration, you can explore more advanced features of Fastly.JS:

- Learn more about [VCL syntax and structure](./tutorials/01-basic-vcl-syntax.md)
- Explore [request and response handling](./tutorials/02-request-response-handling.md)
- Implement [caching strategies](./tutorials/03-caching-strategies.md)
- Configure [multiple backends](./tutorials/04-backend-configuration.md)
- Add [error handling](./tutorials/05-error-handling.md)
- Explore [advanced features](./tutorials/06-advanced-features.md)

You can also check out the [examples](./examples) directory for more VCL configuration examples.
