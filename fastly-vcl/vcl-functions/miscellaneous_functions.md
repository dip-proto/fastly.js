# Miscellaneous Functions

This file demonstrates comprehensive examples of Miscellaneous Functions in VCL.
These functions don't fit neatly into other categories but provide important
functionality for various use cases.

## goto

Jumps to a specific label in the current subroutine. Only forward jumps are allowed: the label must appear after the goto statement, so loops cannot be built with goto.

### Syntax

```vcl
goto label_name;
```

### Parameters

- `label_name`: The name of the label to jump to (must be declared later in the same subroutine)

### Return Value

None

### Examples

#### Basic goto usage

```vcl
if (req.http.Host == "admin.example.com") {
  # Jump to the admin processing section
  goto admin_processing;
}

# Regular request processing
set req.http.X-Request-Type = "regular";

# Skip the admin processing section
goto request_end;

# Admin processing section
admin_processing:
  set req.http.X-Request-Type = "admin";
  set req.http.X-Admin-Access = "true";

# End of request processing
request_end:
  set req.http.X-Processing-Complete = "true";
```

#### Error handling with goto

```vcl
if (req.method != "GET" && req.method != "HEAD" && req.method != "POST") {
  # Jump to the error handling section
  goto method_error;
}

# Process the request normally
set req.http.X-Method-Allowed = "true";

# Skip the error handling section
goto method_end;

# Error handling section
method_error:
  set req.http.X-Method-Allowed = "false";
  error 405 "Method not allowed";

# End of method checking
method_end:
  set req.http.X-Method-Check-Complete = "true";
```

#### Conditional processing with goto

```vcl
if (req.url.path ~ "^/api/v1/") {
  # Jump to API v1 processing
  goto api_v1;
} else if (req.url.path ~ "^/api/v2/") {
  # Jump to API v2 processing
  goto api_v2;
} else {
  # Jump to regular processing
  goto regular_processing;
}

# API v1 processing
api_v1:
  set req.http.X-API-Version = "v1";
  set req.backend = F_api_v1_backend;
  goto processing_end;

# API v2 processing
api_v2:
  set req.http.X-API-Version = "v2";
  set req.backend = F_api_v2_backend;
  goto processing_end;

# Regular processing
regular_processing:
  set req.http.X-API-Version = "none";
  set req.backend = F_default_backend;

# End of processing
processing_end:
  set req.http.X-Processing-Path-Complete = "true";
```

Note: Backward jumps are a compile error. VCL intentionally has no loops; if repetition is needed, use `restart` (which re-runs the whole request, bounded by the restart limit).

#### Complex flow control with goto

```vcl
if (req.http.Cookie:logged_in == "true") {
  # Jump to logged-in user processing
  goto logged_in_user;
} else {
  # Jump to anonymous user processing
  goto anonymous_user;
}

# Logged-in user processing
logged_in_user:
  set req.http.X-User-Type = "logged_in";
  
  if (req.http.Cookie:user_role == "admin") {
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
```

## synthetic

Sets the response body for synthetic responses (a statement, usable in `vcl_error`). A companion statement, `synthetic.base64`, takes a base64-encoded string and decodes it into the response body, which is useful for binary content.

### Syntax

```vcl
synthetic response_body;
synthetic.base64 base64_encoded_body;
```

### Parameters

- `response_body`: The content to use as the response body

### Return Value

None

### Examples

#### Basic synthetic response

```vcl
if (obj.status == 404) {
  # Set a custom 404 page
  set obj.status = 404;
  set obj.response = "Not Found";
  set obj.http.Content-Type = "text/html; charset=utf-8";
  
  synthetic {"<!DOCTYPE html>
<html>
<head>
  <title>Page Not Found</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; }
    h1 { color: #333; }
  </style>
</head>
<body>
  <h1>Page Not Found</h1>
  <p>The page you are looking for could not be found.</p>
  <p><a href="/">Return to the homepage</a></p>
</body>
</html>"};
  
  return(deliver);
}
```

#### Maintenance page

```vcl
if (obj.status == 503) {
  # Set a maintenance page
  set obj.status = 503;
  set obj.response = "Service Unavailable";
  set obj.http.Content-Type = "text/html; charset=utf-8";
  set obj.http.Retry-After = "300";
  
  synthetic {"<!DOCTYPE html>
<html>
<head>
  <title>Maintenance in Progress</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; }
    h1 { color: #333; }
    .maintenance { color: #e74c3c; }
  </style>
</head>
<body>
  <h1>Maintenance in Progress</h1>
  <p class="maintenance">We're currently performing scheduled maintenance.</p>
  <p>Please check back in a few minutes.</p>
</body>
</html>"};
  
  return(deliver);
}
```

#### Rate limiting response

```vcl
if (obj.status == 429) {
  # Set a rate limiting page
  set obj.status = 429;
  set obj.response = "Too Many Requests";
  set obj.http.Content-Type = "text/html; charset=utf-8";
  set obj.http.Retry-After = "60";
  
  synthetic {"<!DOCTYPE html>
<html>
<head>
  <title>Rate Limit Exceeded</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; }
    h1 { color: #333; }
    .rate-limit { color: #e74c3c; }
  </style>
</head>
<body>
  <h1>Rate Limit Exceeded</h1>
  <p class="rate-limit">You have exceeded the request rate limit.</p>
  <p>Please try again in a minute.</p>
</body>
</html>"};
  
  return(deliver);
}
```

#### JSON error response

```vcl
if (req.http.Accept ~ "application/json" && obj.status >= 400) {
  # Set a JSON error response
  set obj.http.Content-Type = "application/json";
  
  declare local var.error_message STRING;
  
  if (obj.status == 404) {
    set var.error_message = "Resource not found";
  } else if (obj.status == 403) {
    set var.error_message = "Access forbidden";
  } else if (obj.status == 429) {
    set var.error_message = "Rate limit exceeded";
  } else {
    set var.error_message = "An error occurred";
  }
  
  synthetic {"{
  \"error\": {
    \"status\": "} + obj.status + {",
    \"message\": \""} + var.error_message + {"\"
  }
}"};
  
  return(deliver);
}
```

#### Dynamic error page with request information

```vcl
if (obj.status >= 400 && obj.status < 500) {
  # Set a dynamic error page
  set obj.http.Content-Type = "text/html; charset=utf-8";
  
  declare local var.error_title STRING;
  declare local var.error_message STRING;
  
  if (obj.status == 400) {
    set var.error_title = "Bad Request";
    set var.error_message = "The request could not be understood by the server.";
  } else if (obj.status == 401) {
    set var.error_title = "Unauthorized";
    set var.error_message = "Authentication is required to access this resource.";
  } else if (obj.status == 403) {
    set var.error_title = "Forbidden";
    set var.error_message = "You do not have permission to access this resource.";
  } else if (obj.status == 404) {
    set var.error_title = "Not Found";
    set var.error_message = "The requested resource could not be found.";
  } else if (obj.status == 429) {
    set var.error_title = "Too Many Requests";
    set var.error_message = "You have sent too many requests in a given amount of time.";
  } else {
    set var.error_title = "Client Error";
    set var.error_message = "An error occurred while processing your request.";
  }
  
  synthetic {"<!DOCTYPE html>
<html>
<head>
  <title>"} + var.error_title + {"</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; }
    h1 { color: #333; }
    .error { color: #e74c3c; }
    .details { background: #f9f9f9; padding: 10px; border-radius: 5px; margin-top: 20px; }
  </style>
</head>
<body>
  <h1>"} + var.error_title + {"</h1>
  <p class=\"error\">"} + var.error_message + {"</p>
  <div class=\"details\">
    <p><strong>Request Details:</strong></p>
    <ul>
      <li>URL: "} + req.url + {"</li>
      <li>Method: "} + req.method + {"</li>
      <li>Status: "} + obj.status + {"</li>
      <li>Time: "} + strftime("%Y-%m-%d %H:%M:%S", now) + {"</li>
    </ul>
  </div>
</body>
</html>"};
  
  return(deliver);
}
```

## return

Exits the current subroutine and returns control to the caller.

### Syntax

```vcl
return(action);

```

### Parameters

- `action`: The action to take (e.g., lookup, pass, pipe, deliver, etc.)

### Return Value

None

### Examples

#### Basic return usage

```vcl
if (req.method == "PURGE") {
  # Only allow PURGE requests from trusted IPs
  if (client.ip !~ trusted_ips) {
    error 405 "Method not allowed";
  }
  
  # Skip the rest of vcl_recv and go to vcl_hash
  return(lookup);
}
```

#### Bypassing the cache

```vcl
if (req.http.Cache-Control ~ "no-cache") {
  # Skip the cache and go directly to the backend
  return(pass);
}
```

#### Handling non-cacheable methods

```vcl
if (req.method !~ "^(GET|HEAD|FASTLYPURGE)$") {
  # Skip the cache for non-cacheable methods
  return(pass);
}
```

#### Handling websocket connections

```vcl
if (req.http.Upgrade ~ "(?i)websocket") {
  # Use pipe for websocket connections
  return(pipe);
}
```

#### Conditional return based on URL

```vcl
if (req.url ~ "^/api/") {
  # Process API requests differently
  set req.backend = F_api_backend;
  
  if (req.url ~ "^/api/v1/") {
    # Use a specific backend for API v1
    set req.backend = F_api_v1_backend;
  }
  
  # Skip the rest of vcl_recv
  return(lookup);
}
```

#### Setting cache TTL based on response

```vcl
if (beresp.status == 200) {
  # Cache successful responses for 1 hour
  set beresp.ttl = 1h;
  
  # Set a grace period of 24 hours
  set beresp.grace = 24h;
  
  # Deliver the response
  return(deliver);
}
```

#### Handling backend errors

```vcl
if (beresp.status >= 500) {
  # Don't cache server errors
  set beresp.ttl = 0s;
  
  # Use stale content if available
  if (stale.exists) {
    return(deliver_stale);
  }
  
  # Otherwise, pass the error to the client
  return(error);
}
```

#### Handling redirects

```vcl
if (beresp.status == 301 || beresp.status == 302) {
  # Cache redirects for 1 day
  set beresp.ttl = 1d;
  
  # Deliver the redirect
  return(deliver);
}
```

#### Handling not found responses

```vcl
if (beresp.status == 404) {
  # Cache not found responses for 5 minutes
  set beresp.ttl = 5m;
  
  # Deliver the not found response
  return(deliver);
}
```

#### Handling large files

```vcl
if (beresp.http.Content-Length ~ "^[0-9]{8,}") {
  # Don't cache files of 10MB or more
  set beresp.ttl = 0s;
  
  # Pass the response to the client
  return(pass);
}
```

## error

Generates a synthetic error response. This is a statement, not a function: the status and message are written without parentheses or commas.

### Syntax

```vcl
error status "message";
```

### Parameters

- `status`: The HTTP status code to return
- `message`: The response reason phrase (optional)

### Return Value

None

### Examples

#### Basic error usage

```vcl
if (req.method == "PURGE" && client.ip !~ trusted_ips) {
  # Return a 403 Forbidden error
  error 403 "Forbidden";
}
```

#### Custom error for invalid parameters

```vcl
if (req.url.qs ~ "(?i)id=0") {
  # Return a 400 Bad Request error
  error 400 "Invalid ID parameter";
}
```

#### Maintenance mode

```vcl
declare local var.maintenance_mode BOOL;
set var.maintenance_mode = true;  # This would typically be set based on a configuration

if (var.maintenance_mode && req.url.path !~ "^/maintenance") {
  # Return a 503 Service Unavailable error
  error 503 "Maintenance in progress";
}
```

#### Rate limiting

```vcl
declare local var.rate_limited BOOL;
set var.rate_limited = false;  # This would typically be determined by rate limiting logic

if (var.rate_limited) {
  # Return a 429 Too Many Requests error
  error 429 "Rate limit exceeded";
}
```

#### Authentication required

```vcl
if (req.url.path ~ "^/private/" && !req.http.Cookie:session) {
  # Return a 401 Unauthorized error
  error 401 "Authentication required";
}
```

## restart

Restarts the request processing from the beginning.

### Syntax

```vcl
restart
```

### Parameters

None

### Return Value

None

### Examples

#### Basic restart usage

```vcl
# Limit the number of restarts to prevent infinite loops
if (req.restarts == 0 && resp.status == 404 && req.url.path !~ "\.html$") {
  # Add .html extension and restart
  set req.url = req.url.path + ".html";
  restart;
}
```

#### Restarting for authentication

```vcl
if (resp.status == 401 && req.restarts == 0 && !req.http.Authorization) {
  # Set the Authorization header from a cookie and restart
  if (req.http.Cookie:auth_token) {
    set req.http.Authorization = "Bearer " + req.http.Cookie:auth_token;
    restart;
  }
}
```

#### Restarting for URL normalization

```vcl
if (req.restarts == 0 && resp.status == 301 && resp.http.Location) {
  # Update the URL and restart
  set req.url = resp.http.Location;
  restart;
}
```

#### Restarting for A/B testing

```vcl
if (req.restarts == 0 && resp.status == 404 && req.url.path ~ "^/feature/") {
  # Try the alternative URL
  set req.url = regsub(req.url.path, "^/feature/", "/beta-feature/");
  restart;
}
```

#### Restarting for failover

```vcl
if (req.restarts < 3 && resp.status >= 500) {
  # Try a different backend
  if (req.restarts == 0) {
    set req.backend = F_backup1_backend;
  } else if (req.restarts == 1) {
    set req.backend = F_backup2_backend;
  } else {
    set req.backend = F_backup3_backend;
  }
  
  # Restart the request
  restart;
}
```

## setcookie.get_value_by_name

Reads the value of a specific cookie from Set-Cookie headers in a response.

### Syntax

```vcl
STRING setcookie.get_value_by_name(ID where, STRING cookie_name)
```

### Parameters

- `where`: The response to read from, as a bare identifier: `resp` or `beresp`
- `cookie_name`: The name of the cookie

### Return Value

The value of the named cookie, or not set if no Set-Cookie header matches

### Examples

```vcl
declare local var.session STRING;

# Read the "session" cookie set by the backend
set var.session = setcookie.get_value_by_name(beresp, "session");
```

## setcookie.delete_by_name

Removes the Set-Cookie header for a specific cookie from a response.

### Syntax

```vcl
BOOL setcookie.delete_by_name(ID where, STRING cookie_name)
```

### Parameters

- `where`: The response to modify, as a bare identifier: `resp` or `beresp`
- `cookie_name`: The name of the cookie to remove

### Return Value

TRUE if a matching Set-Cookie header was removed, FALSE otherwise

### Examples

```vcl
# Strip a tracking cookie from cached responses
if (setcookie.delete_by_name(beresp, "tracking_id")) {
  set beresp.http.X-Cookie-Stripped = "true";
}
```

## resp.tarpit

Deliberately slows down delivery of the response, sending it to the client in small chunks separated by pauses. Useful for slowing down abusive clients. Only available in `vcl_deliver`.

### Syntax

```vcl
resp.tarpit(INTEGER interval_s, INTEGER chunk_size_bytes)
```

### Parameters

- `interval_s`: The pause between chunks, in seconds
- `chunk_size_bytes`: The number of bytes to send per chunk

### Return Value

None

### Examples

```vcl
sub vcl_deliver {
  if (req.http.X-Suspected-Bot == "true") {
    # Trickle the response out 128 bytes every 2 seconds
    resp.tarpit(2, 128);
  }
}
```

## Integrated Example: Complete Flow Control System

This example demonstrates how multiple miscellaneous functions can work together to create a comprehensive flow control system.

```vcl
sub vcl_recv {
  # Step 1: Initial request processing
  # Check if this is a restarted request
  if (req.restarts > 0) {
    # This is a restarted request, skip to the appropriate processing
    if (req.http.X-Restart-Reason == "auth") {
      goto auth_restart;
    } else if (req.http.X-Restart-Reason == "failover") {
      goto failover_restart;
    } else if (req.http.X-Restart-Reason == "normalize") {
      goto normalize_restart;
    }
  }
  
  # Step 2: Check for maintenance mode
  declare local var.maintenance_mode BOOL;
  set var.maintenance_mode = false;  # This would typically be set based on a configuration
  
  if (var.maintenance_mode && req.url.path !~ "^/maintenance") {
    # Return a 503 Service Unavailable error
    error 503 "Maintenance in progress";
  }
  
  # Step 3: Check for rate limiting
  declare local var.rate_limited BOOL;
  set var.rate_limited = false;  # This would typically be determined by rate limiting logic
  
  if (var.rate_limited) {
    # Return a 429 Too Many Requests error
    error 429 "Rate limit exceeded";
  }
  
  # Step 4: URL normalization
  if (req.url.path ~ "/$") {
    # Add index.html to URLs ending with /
    set req.url = req.url.path + "index.html";
    set req.http.X-Restart-Reason = "normalize";
    restart;
  }
  
  # Skip to the end of processing
  goto recv_end;
  
  # Authentication restart processing
  auth_restart:
    set req.http.X-Auth-Restarted = "true";
    goto recv_end;
  
  # Failover restart processing
  failover_restart:
    set req.http.X-Failover-Restarted = "true";
    goto recv_end;
  
  # Normalize restart processing
  normalize_restart:
    set req.http.X-Normalize-Restarted = "true";
    goto recv_end;
  
  # End of vcl_recv processing
  recv_end:
    # Determine the appropriate action
    if (req.method != "GET" && req.method != "HEAD") {
      return(pass);
    } else {
      return(lookup);
    }
}

sub vcl_error {
  # Step 1: Handle specific error codes
  if (obj.status == 401) {
    # Authentication required
    set obj.http.WWW-Authenticate = "Basic realm=\"Restricted Area\"";
    set obj.http.Content-Type = "text/html; charset=utf-8";
    
    synthetic {"<!DOCTYPE html>
<html>
<head>
  <title>Authentication Required</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; }
    h1 { color: #333; }
    .error { color: #e74c3c; }
  </style>
</head>
<body>
  <h1>Authentication Required</h1>
  <p class="error">You must log in to access this resource.</p>
</body>
</html>"};
    
    return(deliver);
  } else if (obj.status == 403) {
    # Forbidden
    set obj.http.Content-Type = "text/html; charset=utf-8";
    
    synthetic {"<!DOCTYPE html>
<html>
<head>
  <title>Access Forbidden</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; }
    h1 { color: #333; }
    .error { color: #e74c3c; }
  </style>
</head>
<body>
  <h1>Access Forbidden</h1>
  <p class="error">You do not have permission to access this resource.</p>
</body>
</html>"};
    
    return(deliver);
  } else if (obj.status == 404) {
    # Not Found
    set obj.http.Content-Type = "text/html; charset=utf-8";
    
    synthetic {"<!DOCTYPE html>
<html>
<head>
  <title>Page Not Found</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; }
    h1 { color: #333; }
    .error { color: #e74c3c; }
  </style>
</head>
<body>
  <h1>Page Not Found</h1>
  <p class="error">The page you are looking for could not be found.</p>
  <p><a href="/">Return to the homepage</a></p>
</body>
</html>"};
    
    return(deliver);
  } else if (obj.status == 429) {
    # Too Many Requests
    set obj.http.Content-Type = "text/html; charset=utf-8";
    set obj.http.Retry-After = "60";
    
    synthetic {"<!DOCTYPE html>
<html>
<head>
  <title>Rate Limit Exceeded</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; }
    h1 { color: #333; }
    .error { color: #e74c3c; }
  </style>
</head>
<body>
  <h1>Rate Limit Exceeded</h1>
  <p class="error">You have exceeded the request rate limit.</p>
  <p>Please try again in a minute.</p>
</body>
</html>"};
    
    return(deliver);
  } else if (obj.status == 503) {
    # Service Unavailable
    set obj.http.Content-Type = "text/html; charset=utf-8";
    set obj.http.Retry-After = "300";
    
    synthetic {"<!DOCTYPE html>
<html>
<head>
  <title>Maintenance in Progress</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; }
    h1 { color: #333; }
    .error { color: #e74c3c; }
  </style>
</head>
<body>
  <h1>Maintenance in Progress</h1>
  <p class="error">We're currently performing scheduled maintenance.</p>
  <p>Please check back in a few minutes.</p>
</body>
</html>"};
    
    return(deliver);
  }
  
  # Step 2: Handle JSON requests
  if (req.http.Accept ~ "application/json") {
    # Return a JSON error response
    set obj.http.Content-Type = "application/json";
    
    synthetic {"{
  \"error\": {
    \"status\": "} + obj.status + {",
    \"message\": \""} + obj.response + {"\"
  }
}"};
    
    return(deliver);
  }
  
  # Step 3: Default error handling
  set obj.http.Content-Type = "text/html; charset=utf-8";
  
  synthetic {"<!DOCTYPE html>
<html>
<head>
  <title>Error "} + obj.status + {"</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; }
    h1 { color: #333; }
    .error { color: #e74c3c; }
    .details { background: #f9f9f9; padding: 10px; border-radius: 5px; margin-top: 20px; }
  </style>
</head>
<body>
  <h1>Error "} + obj.status + {"</h1>
  <p class=\"error\">"} + obj.response + {"</p>
  <div class=\"details\">
    <p><strong>Request Details:</strong></p>
    <ul>
      <li>URL: "} + req.url + {"</li>
      <li>Method: "} + req.method + {"</li>
      <li>Status: "} + obj.status + {"</li>
      <li>Time: "} + strftime("%Y-%m-%d %H:%M:%S", now) + {"</li>
    </ul>
  </div>
</body>
</html>"};
  
  return(deliver);
}
```

## Best Practices for Miscellaneous Functions

1. Flow Control:
   - Use goto sparingly and only when necessary
   - Use clear and descriptive label names
   - Avoid complex goto patterns that make code hard to follow

2. Synthetic Responses:
   - Set appropriate Content-Type headers
   - Keep synthetic responses concise and informative
   - Consider different formats (HTML, JSON) based on Accept headers

3. Return Statements:
   - Use the appropriate return action for each situation
   - Be aware of the implications of each return action
   - Document the expected flow after each return

4. Error Handling:
   - Use appropriate status codes for different error conditions
   - Provide clear error messages
   - Consider security implications when displaying error details

5. Restart Usage:
   - Limit the number of restarts to prevent infinite loops
   - Use req.restarts to track the number of restarts
   - Document the reason for each restart

6. General Best Practices:
   - Keep code organized and readable
   - Use comments to explain complex logic
   - Test thoroughly to ensure correct behavior