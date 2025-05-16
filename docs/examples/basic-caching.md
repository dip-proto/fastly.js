# Basic Caching Example

This example demonstrates how to implement basic caching in VCL, including different TTLs for different content types, cache variations, and debugging headers.

## Complete Example

```vcl
# Basic Caching Example

# Define the backend server
backend default {
  .host = "example.com";
  .port = "80";
}

# This subroutine is executed when a request is received
sub vcl_recv {
  # Log the incoming request
  std.log("Received request: " + req.method + " " + req.url);
  
  # Don't cache POST, PUT, DELETE, or PATCH requests
  if (req.method != "GET" && req.method != "HEAD") {
    return(pass);
  }
  
  # Don't cache requests with authentication
  if (req.http.Authorization) {
    return(pass);
  }
  
  # Don't cache requests with cookies
  if (req.http.Cookie) {
    return(pass);
  }
  
  # Pass API requests directly to the backend
  if (req.url ~ "^/api/") {
    return(pass);
  }
  
  # Pass requests with query parameters directly to the backend
  if (req.url ~ "\?") {
    return(pass);
  }
  
  # Continue to cache lookup for static content
  return(lookup);
}

# This subroutine is executed to create a hash key for the request
sub vcl_hash {
  # Hash based on URL and host
  hash_data(req.url);
  hash_data(req.http.host);
  
  # Vary cache based on User-Agent type (mobile vs. desktop)
  if (req.http.User-Agent ~ "Mobile|Android|iPhone|iPad") {
    hash_data("mobile");
  } else {
    hash_data("desktop");
  }
  
  return(hash);
}

# This subroutine is executed when the request is found in cache
sub vcl_hit {
  # Log cache hit
  std.log("Cache hit for: " + req.url);
  
  return(deliver);
}

# This subroutine is executed when the request is not found in cache
sub vcl_miss {
  # Log cache miss
  std.log("Cache miss for: " + req.url);
  
  return(fetch);
}

# This subroutine is executed when the request is passed to the backend
sub vcl_pass {
  # Log cache pass
  std.log("Cache pass for: " + req.url);
  
  return(fetch);
}

# This subroutine is executed when the response is received from the backend
sub vcl_fetch {
  # Log that we're in vcl_fetch
  std.log("Executing vcl_fetch for: " + req.url);
  
  # Don't cache error responses
  if (beresp.status >= 400) {
    set beresp.ttl = 0s;
    return(pass);
  }
  
  # Set different TTLs based on content type
  
  # Cache images for 1 day
  if (beresp.http.Content-Type ~ "image/") {
    set beresp.ttl = 1d;
    set beresp.grace = 12h;
    std.log("Caching image for 1 day: " + req.url);
  }
  
  # Cache CSS and JavaScript for 1 hour
  else if (req.url ~ "\.(css|js)$" || beresp.http.Content-Type ~ "text/css" || beresp.http.Content-Type ~ "application/javascript") {
    set beresp.ttl = 1h;
    set beresp.grace = 6h;
    std.log("Caching CSS/JS for 1 hour: " + req.url);
  }
  
  # Cache HTML for 5 minutes
  else if (beresp.http.Content-Type ~ "text/html") {
    set beresp.ttl = 5m;
    set beresp.grace = 1h;
    std.log("Caching HTML for 5 minutes: " + req.url);
  }
  
  # Cache everything else for 10 minutes
  else {
    set beresp.ttl = 10m;
    set beresp.grace = 1h;
    std.log("Caching other content for 10 minutes: " + req.url);
  }
  
  # Set stale-while-revalidate to 10 seconds
  set beresp.stale_while_revalidate = 10s;
  
  # Add debug headers
  set beresp.http.X-Cache-TTL = beresp.ttl;
  set beresp.http.X-Cache-Grace = beresp.grace;
  set beresp.http.X-Cache-SWR = beresp.stale_while_revalidate;
  
  return(deliver);
}

# This subroutine is executed before the response is delivered to the client
sub vcl_deliver {
  # Add cache status header
  if (obj.hits > 0) {
    set resp.http.X-Cache = "HIT";
    set resp.http.X-Cache-Hits = obj.hits;
  } else {
    set resp.http.X-Cache = "MISS";
  }
  
  # Add a custom header to indicate the proxy server
  set resp.http.X-Powered-By = "Fastly.JS";
  
  # Remove debug headers in production
  # Uncomment these lines in production
  # unset resp.http.X-Cache-TTL;
  # unset resp.http.X-Cache-Grace;
  # unset resp.http.X-Cache-SWR;
  
  return(deliver);
}

# This subroutine is executed after the response is delivered to the client
sub vcl_log {
  # Log the completed request
  std.log("Completed request: " + req.method + " " + req.url + " - Status: " + resp.status);
}
```

## Explanation

This example implements a basic caching strategy with the following features:

### Request Handling (vcl_recv)

- Passes non-cacheable requests directly to the backend:
  - POST, PUT, DELETE, and PATCH requests
  - Requests with authentication
  - Requests with cookies
  - API requests
  - Requests with query parameters
- Continues to cache lookup for static content

### Cache Key Generation (vcl_hash)

- Creates a cache key based on the URL and host
- Varies the cache based on the User-Agent type (mobile vs. desktop)

### Backend Response Handling (vcl_fetch)

- Doesn't cache error responses (status >= 400)
- Sets different TTLs based on content type:
  - Images: 1 day with a 12-hour grace period
  - CSS and JavaScript: 1 hour with a 6-hour grace period
  - HTML: 5 minutes with a 1-hour grace period
  - Everything else: 10 minutes with a 1-hour grace period
- Sets stale-while-revalidate to 10 seconds
- Adds debug headers to show the TTL, grace period, and stale-while-revalidate period

### Response Delivery (vcl_deliver)

- Adds a cache status header (HIT or MISS)
- Adds a custom header to indicate the proxy server
- Includes commented-out lines to remove debug headers in production

### Logging (vcl_log)

- Logs the completed request with the status code

## Usage

To use this example, save it to a file named `basic-caching.vcl` and run Fastly.JS with the following command:

```bash
bun run index.ts basic-caching.vcl
```

Then, open your browser and navigate to:

```
http://127.0.0.1:8000
```

You should see the content from example.com, and the response headers should include:

- `X-Cache`: Indicates whether the response was cached (HIT or MISS)
- `X-Cache-Hits`: Indicates the number of cache hits (if the response was cached)
- `X-Powered-By`: Indicates the proxy server (Fastly.JS)
- `X-Cache-TTL`: Indicates the cache TTL for the response
- `X-Cache-Grace`: Indicates the grace period for the response
- `X-Cache-SWR`: Indicates the stale-while-revalidate period for the response

## Customization

You can customize this example by:

- Changing the backend server
- Adjusting the TTLs for different content types
- Modifying the cache variation logic
- Adding more debug headers
- Implementing more sophisticated caching rules

For example, to cache API responses for authenticated users, you could modify the `vcl_recv` subroutine:

```vcl
sub vcl_recv {
  # ... existing code ...
  
  # Cache API responses for authenticated users with a user-specific cache key
  if (req.url ~ "^/api/" && req.http.Authorization) {
    # Extract the user ID from the Authorization header
    set req.http.X-User-ID = regsub(req.http.Authorization, "Bearer ([^;]+).*", "\1");
    
    # Continue to cache lookup
    return(lookup);
  }
  
  # ... existing code ...
}

sub vcl_hash {
  # ... existing code ...
  
  # Include the user ID in the cache key for authenticated API requests
  if (req.http.X-User-ID) {
    hash_data(req.http.X-User-ID);
  }
  
  # ... existing code ...
}
```

This would cache API responses on a per-user basis, ensuring that each user sees their own data.
