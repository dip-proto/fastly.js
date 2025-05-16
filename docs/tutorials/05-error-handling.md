# Error Handling in VCL

This tutorial covers how to handle errors in VCL, including creating custom error pages, handling backend failures, and implementing graceful degradation.

## Error Types

In VCL, errors can occur in several ways:

1. **Client Errors**: Errors caused by the client, such as invalid requests or authentication failures (4xx status codes)
2. **Backend Errors**: Errors returned by the backend server (5xx status codes)
3. **VCL Errors**: Errors triggered by the `error` statement in VCL
4. **Timeout Errors**: Errors caused by backend timeouts

## The Error Flow

When an error occurs, Fastly.JS executes the `vcl_error` subroutine, which allows you to customize the error response. The default behavior is to return a generic error page with the appropriate status code.

## Triggering Errors

You can trigger an error using the `error` statement:

```vcl
sub vcl_recv {
  # Block access to admin area
  if (req.url ~ "^/admin/" && client.ip !~ "192.168.0.0/24") {
    error 403 "Forbidden";
  }
  
  # Return a custom 404 for missing files
  if (req.url ~ "^/images/" && req.url !~ "\.(jpg|jpeg|png|gif)$") {
    error 404 "File not found";
  }
}
```

The `error` statement takes two parameters:
1. The HTTP status code
2. A message (optional)

## Handling Errors

You can handle errors in the `vcl_error` subroutine:

```vcl
sub vcl_error {
  # Set the response status
  set obj.status = obj.status;
  set obj.response = obj.response;
  
  # Set the content type
  set obj.http.Content-Type = "text/html; charset=utf-8";
  
  # Create a custom error page
  synthetic {"
    <!DOCTYPE html>
    <html>
      <head>
        <title>"} + obj.status + " " + obj.response + {"</title>
      </head>
      <body>
        <h1>"} + obj.status + " " + obj.response + {"</h1>
        <p>Sorry, an error occurred.</p>
      </body>
    </html>
  "};
  
  return(deliver);
}
```

## Custom Error Pages

You can create custom error pages for different status codes:

```vcl
sub vcl_error {
  # Set the content type
  set obj.http.Content-Type = "text/html; charset=utf-8";
  
  # 403 Forbidden
  if (obj.status == 403) {
    synthetic {"
      <!DOCTYPE html>
      <html>
        <head>
          <title>Access Denied</title>
        </head>
        <body>
          <h1>Access Denied</h1>
          <p>You do not have permission to access this resource.</p>
        </body>
      </html>
    "};
    return(deliver);
  }
  
  # 404 Not Found
  if (obj.status == 404) {
    synthetic {"
      <!DOCTYPE html>
      <html>
        <head>
          <title>Page Not Found</title>
        </head>
        <body>
          <h1>Page Not Found</h1>
          <p>The requested page could not be found.</p>
        </body>
      </html>
    "};
    return(deliver);
  }
  
  # 500 Internal Server Error
  if (obj.status == 500) {
    synthetic {"
      <!DOCTYPE html>
      <html>
        <head>
          <title>Server Error</title>
        </head>
        <body>
          <h1>Server Error</h1>
          <p>The server encountered an error and could not complete your request.</p>
        </body>
      </html>
    "};
    return(deliver);
  }
  
  # Default error page
  synthetic {"
    <!DOCTYPE html>
    <html>
      <head>
        <title>"} + obj.status + " " + obj.response + {"</title>
      </head>
      <body>
        <h1>"} + obj.status + " " + obj.response + {"</h1>
        <p>Sorry, an error occurred.</p>
      </body>
    </html>
  "};
  
  return(deliver);
}
```

## Handling Backend Failures

You can handle backend failures in `vcl_fetch`:

```vcl
sub vcl_fetch {
  # If the backend returns a 5xx status, try a different backend
  if (beresp.status >= 500 && beresp.status < 600) {
    # If we have a fallback backend, try it
    if (req.backend != fallback_backend) {
      set req.backend = fallback_backend;
      return(retry);
    }
  }
}
```

## Graceful Degradation

Graceful degradation allows you to serve a degraded but functional version of your site when the backend is unavailable.

### Serving Stale Content

You can serve stale content when the backend is unavailable:

```vcl
sub vcl_fetch {
  # Set a long grace period
  set beresp.grace = 24h;
}

sub vcl_hit {
  # If the object is stale, try to revalidate it
  if (obj.ttl <= 0s) {
    # If the backend is healthy, fetch a fresh copy
    if (std.backend.is_healthy(req.backend)) {
      return(fetch);
    }
    # Otherwise, serve the stale copy
    else {
      return(deliver);
    }
  }
}
```

### Serving a Static Fallback

You can serve a static fallback page when the backend is unavailable:

```vcl
sub vcl_fetch {
  # If the backend returns a 5xx status, serve a static fallback
  if (beresp.status >= 500 && beresp.status < 600) {
    # Set the content type
    set beresp.http.Content-Type = "text/html; charset=utf-8";
    
    # Create a static fallback page
    synthetic {"
      <!DOCTYPE html>
      <html>
        <head>
          <title>Service Unavailable</title>
        </head>
        <body>
          <h1>Service Unavailable</h1>
          <p>The service is temporarily unavailable. Please try again later.</p>
        </body>
      </html>
    "};
    
    # Set the status to 503 Service Unavailable
    set beresp.status = 503;
    
    return(deliver);
  }
}
```

## Redirects

You can use redirects to handle certain error conditions:

```vcl
sub vcl_error {
  # Redirect to HTTPS
  if (obj.status == 301 && obj.response == "Redirect to HTTPS") {
    set obj.http.Location = "https://" + req.http.host + req.url;
    set obj.status = 301;
    set obj.response = "Moved Permanently";
    set obj.http.Content-Type = "text/html; charset=utf-8";
    synthetic {"
      <!DOCTYPE html>
      <html>
        <head>
          <title>Moved Permanently</title>
        </head>
        <body>
          <h1>Moved Permanently</h1>
          <p>The document has moved <a href="https://"} + req.http.host + req.url + {"">here</a>.</p>
        </body>
      </html>
    "};
    return(deliver);
  }
}
```

## Error Logging

You can log errors for debugging and monitoring:

```vcl
sub vcl_error {
  # Log the error
  std.log("Error: " + obj.status + " " + obj.response + " for " + req.method + " " + req.url);
  
  # Continue with normal error handling
  # ...
}
```

## Rate Limiting

You can use error handling to implement rate limiting:

```vcl
sub vcl_recv {
  # Check if the client has exceeded the rate limit
  if (std.rate_limit(client.ip, 100, 60s)) {
    error 429 "Too Many Requests";
  }
}

sub vcl_error {
  # Handle rate limiting errors
  if (obj.status == 429) {
    set obj.http.Content-Type = "text/html; charset=utf-8";
    set obj.http.Retry-After = "60";
    synthetic {"
      <!DOCTYPE html>
      <html>
        <head>
          <title>Too Many Requests</title>
        </head>
        <body>
          <h1>Too Many Requests</h1>
          <p>You have exceeded the rate limit. Please try again later.</p>
        </body>
      </html>
    "};
    return(deliver);
  }
}
```

## Next Steps

Now that you understand error handling in VCL, you can move on to the next tutorial: [Advanced Features](./06-advanced-features.md).
