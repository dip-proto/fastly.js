# VCL Subroutines Reference

VCL (Varnish Configuration Language) subroutines define the behavior of your Fastly service at different stages of the request-response lifecycle. This document provides a reference for the standard VCL subroutines supported by Fastly.JS.

## Overview

VCL subroutines are executed in a specific order during the request-response lifecycle:

1. `vcl_recv`: Called when a request is received
2. `vcl_hash`: Called to create a hash key for the object
3. `vcl_hit`: Called when a cache hit occurs
4. `vcl_miss`: Called when a cache miss occurs
5. `vcl_pass`: Called when the request should bypass the cache
6. `vcl_fetch`: Called after a request has been sent to the backend
7. `vcl_error`: Called when an error occurs
8. `vcl_deliver`: Called before delivering the response to the client
9. `vcl_log`: Called after the response has been delivered

Each subroutine can return a specific action that determines the next step in the request-response lifecycle.

## Subroutine Syntax

```vcl
sub subroutine_name {
  # VCL code
  return(action);
}
```

## vcl_recv

The `vcl_recv` subroutine is called when a request is received, before any content is cached or retrieved.

### Purpose

- Determine whether to serve the request from cache or pass it to the backend
- Modify the request before it's processed
- Implement access control and security measures
- Set up backend selection

### Available Actions

- `lookup`: Look up the object in the cache (default)
- `pass`: Pass the request to the backend, bypassing the cache
- `pipe`: Switch to pipe mode for the request
- `error`: Return an error response
- `hash`: Proceed to the `vcl_hash` subroutine

### Example

```vcl
sub vcl_recv {
  # Set the default backend
  set req.backend = default;
  
  # Pass non-GET/HEAD requests
  if (req.method != "GET" && req.method != "HEAD") {
    return(pass);
  }
  
  # Pass requests with cookies
  if (req.http.Cookie) {
    return(pass);
  }
  
  # Look up the object in the cache
  return(lookup);
}
```

## vcl_hash

The `vcl_hash` subroutine is called to create a hash key for the object.

### Purpose

- Define what makes a unique cache object
- Include or exclude request properties from the cache key

### Available Actions

- `hash`: Proceed with the hash calculation (default)

### Example

```vcl
sub vcl_hash {
  # Include the host and URL in the hash
  hash_data(req.url);
  hash_data(req.http.host);
  
  # Include the Accept header for content negotiation
  if (req.http.Accept) {
    hash_data(req.http.Accept);
  }
  
  return(hash);
}
```

## vcl_hit

The `vcl_hit` subroutine is called when a cache hit occurs.

### Purpose

- Determine whether to serve the cached object or pass the request
- Implement cache invalidation logic
- Add custom headers to cached responses

### Available Actions

- `deliver`: Deliver the cached object (default)
- `pass`: Pass the request to the backend, bypassing the cache
- `restart`: Restart the request processing
- `error`: Return an error response

### Example

```vcl
sub vcl_hit {
  # Serve stale content if the backend is down
  if (obj.ttl <= 0s && obj.grace > 0s) {
    return(deliver);
  }
  
  # Pass requests with specific headers
  if (req.http.Cache-Control ~ "no-cache") {
    return(pass);
  }
  
  # Deliver the cached object
  return(deliver);
}
```

## vcl_miss

The `vcl_miss` subroutine is called when a cache miss occurs.

### Purpose

- Determine whether to fetch the object from the backend
- Modify the request before sending it to the backend
- Implement backend selection logic

### Available Actions

- `fetch`: Fetch the object from the backend (default)
- `pass`: Pass the request to the backend, bypassing the cache
- `restart`: Restart the request processing
- `error`: Return an error response

### Example

```vcl
sub vcl_miss {
  # Set the backend based on the request
  if (req.url ~ "^/api/") {
    set req.backend = api_backend;
  } else if (req.url ~ "\.(jpg|jpeg|png|gif)$") {
    set req.backend = image_backend;
  }
  
  # Fetch the object from the backend
  return(fetch);
}
```

## vcl_pass

The `vcl_pass` subroutine is called when the request should bypass the cache.

### Purpose

- Modify the request before sending it to the backend
- Implement backend selection logic for non-cached requests

### Available Actions

- `pass`: Pass the request to the backend (default)
- `restart`: Restart the request processing
- `error`: Return an error response

### Example

```vcl
sub vcl_pass {
  # Set the backend based on the request
  if (req.url ~ "^/api/") {
    set req.backend = api_backend;
  } else if (req.url ~ "\.(jpg|jpeg|png|gif)$") {
    set req.backend = image_backend;
  }
  
  # Pass the request to the backend
  return(pass);
}
```

## vcl_fetch

The `vcl_fetch` subroutine is called after a request has been sent to the backend.

### Purpose

- Determine whether to cache the backend response
- Modify the response before caching it
- Set the TTL for the cached object
- Implement error handling for backend responses

### Available Actions

- `deliver`: Cache the response and deliver it (default)
- `pass`: Pass the response without caching it
- `restart`: Restart the request processing
- `error`: Return an error response

### Example

```vcl
sub vcl_fetch {
  # Don't cache 5xx responses
  if (beresp.status >= 500 && beresp.status < 600) {
    return(pass);
  }
  
  # Set the TTL based on the Cache-Control header
  if (beresp.http.Cache-Control ~ "max-age=(\d+)") {
    set beresp.ttl = std.atoi(re.group.1) + 0s;
  } else {
    set beresp.ttl = 3600s;
  }
  
  # Set the grace period
  set beresp.grace = 24h;
  
  # Cache the response
  return(deliver);
}
```

## vcl_error

The `vcl_error` subroutine is called when an error occurs.

### Purpose

- Create custom error pages
- Implement error handling logic
- Redirect users on error

### Available Actions

- `deliver`: Deliver the error response (default)
- `restart`: Restart the request processing

### Example

```vcl
sub vcl_error {
  # Set the response content type
  set obj.http.Content-Type = "text/html; charset=utf-8";
  
  # Create a custom error page
  synthetic {"
    <!DOCTYPE html>
    <html>
      <head>
        <title>Error " + obj.status + "</title>
      </head>
      <body>
        <h1>Error " + obj.status + "</h1>
        <p>" + obj.response + "</p>
      </body>
    </html>
  "};
  
  # Deliver the error response
  return(deliver);
}
```

## vcl_deliver

The `vcl_deliver` subroutine is called before delivering the response to the client.

### Purpose

- Modify the response before sending it to the client
- Add custom headers to the response
- Implement response transformation logic

### Available Actions

- `deliver`: Deliver the response to the client (default)
- `restart`: Restart the request processing

### Example

```vcl
sub vcl_deliver {
  # Add custom headers
  set resp.http.X-Served-By = "Fastly.JS";
  
  # Add cache status header
  if (obj.hits > 0) {
    set resp.http.X-Cache = "HIT";
    set resp.http.X-Cache-Hits = obj.hits;
  } else {
    set resp.http.X-Cache = "MISS";
  }
  
  # Remove internal headers
  unset resp.http.X-Backend;
  unset resp.http.X-Backend-URL;
  
  # Deliver the response
  return(deliver);
}
```

## vcl_log

The `vcl_log` subroutine is called after the response has been delivered.

### Purpose

- Log information about the request and response
- Collect metrics and analytics data
- Implement post-delivery processing

### Available Actions

- `deliver`: Complete the request processing (default)

### Example

```vcl
sub vcl_log {
  # Log request and response information
  std.log("Request: " + req.method + " " + req.url);
  std.log("Response: " + resp.status + " " + resp.http.Content-Type);
  
  # Log cache status
  if (obj.hits > 0) {
    std.log("Cache: HIT (" + obj.hits + " hits)");
  } else {
    std.log("Cache: MISS");
  }
  
  return(deliver);
}
```

## Custom Subroutines

In addition to the standard subroutines, you can define custom subroutines to organize your VCL code:

```vcl
sub check_auth {
  if (!req.http.Authorization) {
    error 401 "Unauthorized";
  }
}

sub vcl_recv {
  # Call the custom subroutine
  call check_auth;
  
  return(lookup);
}
```

## Conclusion

VCL subroutines provide a powerful way to control the behavior of your Fastly service at different stages of the request-response lifecycle. By understanding and using these subroutines effectively, you can implement complex caching strategies, security measures, and content transformation logic.

For more information on VCL variables, see the [VCL Variables Reference](./vcl-variables.md).
