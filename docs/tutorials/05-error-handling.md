# Error Handling in VCL

This tutorial covers how to handle errors in VCL, including creating custom error pages, handling backend failures, and implementing graceful degradation.

## Error Types

In VCL, errors can occur in several ways:

1. **Client Errors**: Errors caused by the client, such as invalid requests or authentication failures (4xx status codes)
2. **Backend Errors**: Errors returned by the backend server (5xx status codes)
3. **VCL Errors**: Errors triggered by the `error` statement in VCL
4. **Timeout Errors**: Errors caused by backend timeouts

## The Error Flow

Fastly.JS executes the `vcl_error` subroutine when the `error` statement is used in VCL, or when the backend request itself fails (connection error or timeout). This is where you can customize the error response; the default behavior is to return a generic error page with the appropriate status code.

Note that a 5xx status returned by the backend does not trigger `vcl_error` on its own: such responses flow through `vcl_fetch` and `vcl_deliver` like any other.

## Triggering Errors

You can trigger an error using the `error` statement:

```vcl
acl internal {
  "192.168.0.0"/24;
}

sub vcl_recv {
  # Block access to admin area for clients outside the internal ACL
  if (req.url ~ "^/admin/" && client.ip !~ internal) {
    error 403 "Forbidden";
  }
  
  # Return a custom 404 for missing files
  if (req.url ~ "^/images/" && req.url !~ "\.(jpg|jpeg|png|gif)$") {
    error 404 "File not found";
  }
}
```

(Client IPs are matched against a named ACL; both `~` and `!~` work, alone or combined with other conditions.)

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

There is no retry action in `vcl_fetch`, but you can `restart` from there: the request re-runs from `vcl_recv`, where a different backend can be selected. Guard the restart with `req.restarts` so it can only fire once:

```vcl
sub vcl_fetch {
  # Retry once against the fallback on a server error
  if (beresp.status >= 500 && beresp.status < 600 && req.restarts == 0) {
    set req.http.X-Use-Fallback = "1";
    restart;
  }
  return(deliver);
}
```

(The bundled proxy in `index.ts` picks origins itself and ignores `req.backend`, and it additionally retries 5xx responses once against its fallback director on its own.)

You can also reshape a failed response in `vcl_fetch` before it reaches the client:

```vcl
sub vcl_fetch {
  # Present backend failures as a consistent 503, and don't cache them
  if (beresp.status >= 500 && beresp.status < 600) {
    set beresp.status = 503;
    set beresp.http.Retry-After = "30";
    return(pass);
  }
}
```

## Graceful Degradation

Graceful degradation allows you to serve a degraded but functional version of your site when the backend is unavailable.

### Serving Stale Content

You can keep serving stale content after the TTL expires by setting a long grace period:

```vcl
sub vcl_fetch {
  # Set a long grace period
  set beresp.grace = 24h;
}
```

Stale serving is built into the pipeline: within the grace window an expired object is delivered automatically with `X-Cache: HIT-STALE`, and the following request fetches a fresh copy from the backend. No `vcl_hit` logic is needed. (Note that `obj.ttl` is not populated from the cache entry in `vcl_hit`, so Varnish-style revalidation checks against it will not behave as expected.)

### Serving a Static Fallback

The `synthetic` statement is only valid inside `vcl_error`, so a response body cannot be replaced from `vcl_fetch`. You can, however, serve a static fallback page when the backend cannot be reached at all: connection failures and timeouts run `vcl_error`, with `obj.status` set to 502 for connection errors and 504 for timeouts:

```vcl
sub vcl_error {
  # Serve a static fallback page when the backend is unreachable
  if (obj.status == 502 || obj.status == 503 || obj.status == 504) {
    # Set the content type
    set obj.http.Content-Type = "text/html; charset=utf-8";
    
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
    
    return(deliver);
  }
}
```

## Redirects

You can use the error mechanism to issue redirects. Trigger a 301 with the `error` statement, then attach the `Location` header in `vcl_error`:

```vcl
sub vcl_recv {
  # Redirect plain HTTP to HTTPS
  if (req.http.x-forwarded-proto == "http") {
    error 301 "Moved Permanently";
  }
}

sub vcl_error {
  # Redirect to HTTPS
  if (obj.status == 301) {
    set obj.http.Location = "https://" + req.http.host + req.url;
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

You can use error handling to implement rate limiting with the `ratelimit` functions. Declare a rate counter and a penalty box, then check the rate in `vcl_recv`:

```vcl
penaltybox rl_pb {}
ratecounter rl_counter {}

sub vcl_recv {
  # Reject clients that are already in the penalty box
  if (ratelimit.penaltybox_has(rl_pb, client.ip)) {
    error 429 "Too Many Requests";
  }

  # Allow up to 100 requests per 60-second window, each request counting for 1;
  # offenders go into the penalty box for 60 seconds
  if (ratelimit.check_rate(client.ip, rl_counter, 100, 60, 1, rl_pb, 60s)) {
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
