# HTTP Functions

This file demonstrates comprehensive examples of HTTP Functions in VCL.
These functions help manipulate HTTP requests and responses, including
header operations and status code handling.

## header.get

Retrieves the value of an HTTP header.

### Syntax

```vcl
STRING header.get(ID where, STRING header_name)
```

### Parameters

- `where`: The variable collection to read from, as a bare identifier: `req`, `bereq`, `resp` or `beresp`
- `header_name`: The name of the header field to get

The main benefit over reading `req.http.name` directly is that `header_name` can be a runtime expression, and can include a `:` suffix to address a field inside a comma-separated header (such as a cookie).

### Return Value

The value of the specified header, or a not set value if the header doesn't exist

### Examples

#### Basic header retrieval

```vcl
declare local var.user_agent STRING;
declare local var.content_type STRING;
declare local var.accept_encoding STRING;

# Get the User-Agent header
set var.user_agent = header.get(req, "User-Agent");

# Get the Content-Type header
set var.content_type = header.get(req, "Content-Type");

# Get the Accept-Encoding header
set var.accept_encoding = header.get(req, "Accept-Encoding");

# Log the headers for debugging
log "User-Agent: " + var.user_agent;
log "Content-Type: " + var.content_type;
log "Accept-Encoding: " + var.accept_encoding;
```

#### Dynamic header names

```vcl
declare local var.tenant STRING;
declare local var.tenant_config STRING;

# The header name can be computed at runtime
set var.tenant = req.http.X-Tenant;
set var.tenant_config = header.get(req, "X-Config-" + var.tenant);
```

#### Extracting specific cookie values

```vcl
declare local var.all_cookies STRING;
declare local var.session_cookie STRING;

# Get all cookies
set var.all_cookies = header.get(req, "Cookie");

# Extract a specific cookie value
set var.session_cookie = header.get(req, "Cookie:session_id");

# Log the result
log "All Cookies: " + var.all_cookies;
log "Session Cookie: " + var.session_cookie;
```

#### Conditional logic based on header presence

```vcl
if (header.get(req, "X-Requested-With") == "XMLHttpRequest") {
  # This is an AJAX request
  set req.http.X-Request-Type = "AJAX";
} else {
  # This is a regular request
  set req.http.X-Request-Type = "Regular";
}
```

#### Error handling for missing headers

```vcl
declare local var.authorization STRING;

# Get the Authorization header
set var.authorization = header.get(req, "Authorization");

# Check if the header exists
if (var.authorization == "") {
  # Header is missing
  log "Authorization header is missing";
  # Potentially return an error or set a default
  # error 401 "Authorization required";
} else {
  # Header exists
  log "Authorization header is present";
}
```

## header.set

Sets the value of an HTTP header.

### Syntax

```vcl
header.set(ID where, STRING header_name, STRING value)
```

### Parameters

- `where`: The variable collection to modify, as a bare identifier: `req`, `bereq`, `resp` or `beresp`
- `header_name`: The name of the header field to set
- `value`: The value to set for the header field

### Return Value

None

### Examples

#### Basic header setting

```vcl
# Set a custom header
header.set(req, "X-Custom-Header", "Custom Value");

# Set the Host header
header.set(req, "Host", "example.com");
```

#### Setting headers based on conditions

```vcl
if (req.url ~ "^/api/") {
  # Set API-specific headers
  header.set(req, "X-API-Version", "1.0");
  header.set(req, "Accept", "application/json");
} else if (req.url ~ "^/admin/") {
  # Set admin-specific headers
  header.set(req, "X-Admin-Access", "true");
}
```

#### Setting security headers

This example demonstrates how to set security-related headers:

```vcl
# Set Content-Security-Policy
header.set(resp, "Content-Security-Policy", 
  "default-src 'self'; script-src 'self' https://trusted-cdn.com; style-src 'self' https://trusted-cdn.com; img-src 'self' data:;");

# Set X-XSS-Protection
header.set(resp, "X-XSS-Protection", "1; mode=block");

# Set X-Content-Type-Options
header.set(resp, "X-Content-Type-Options", "nosniff");

# Set X-Frame-Options
header.set(resp, "X-Frame-Options", "SAMEORIGIN");
```

#### Setting cache control headers

This example demonstrates how to set cache control headers:

```vcl
# Set Cache-Control header
header.set(resp, "Cache-Control", "public, max-age=86400");

# Set Expires header
header.set(resp, "Expires", time.add(now, 86400s));

# Set an ETag derived from the URL
header.set(resp, "ETag", digest.hash_md5(req.url));
```

#### Setting headers for backend requests

This example demonstrates how to set headers for backend requests (in `vcl_miss` or `vcl_pass`):

```vcl
# Set a custom header for the backend
header.set(bereq, "X-Forwarded-For", client.ip);

# Set the Host header for the backend
header.set(bereq, "Host", "backend.example.com");

# Set a custom header with the original client information
header.set(bereq, "X-Original-User-Agent", header.get(req, "User-Agent"));
```

## header.unset

Removes an HTTP header.

### Syntax

```vcl
header.unset(ID where, STRING header_name)
```

### Parameters

- `where`: The variable collection to modify, as a bare identifier: `req`, `bereq`, `resp` or `beresp`
- `header_name`: The name of the header field to remove

### Return Value

None

### Examples

#### Basic header removal

```vcl
# Remove the Cookie header
header.unset(req, "Cookie");

# Remove the User-Agent header
header.unset(req, "User-Agent");
```

#### Conditional header removal

This example demonstrates how to conditionally remove headers:

```vcl
# Remove the Referer header for privacy-sensitive paths
if (req.url ~ "^/private/") {
  header.unset(req, "Referer");
}

# Remove the Authorization header when proxying to certain backends
if (req.backend == F_public_backend) {
  header.unset(bereq, "Authorization");
}
```

#### Security-related header removal

This example demonstrates how to remove potentially sensitive headers:

```vcl
# Remove headers that might reveal server information
header.unset(resp, "Server");
header.unset(resp, "X-Powered-By");
header.unset(resp, "X-AspNet-Version");
header.unset(resp, "X-Runtime");
```

#### Cache optimization by removing unnecessary headers

This example demonstrates how to remove headers that might affect caching:

```vcl
# Remove headers that might prevent proper caching
header.unset(beresp, "Set-Cookie");
header.unset(beresp, "Pragma");
```

#### Cleaning up internal headers before sending response

This example demonstrates how to remove internal headers before sending the response:

```vcl
# Remove internal headers
header.unset(resp, "X-Internal-Debug");
header.unset(resp, "X-Cache-Status");
header.unset(resp, "X-Backend-Name");
```

## header.filter

Removes all HTTP headers with the given names. The function is variadic: several header names can be passed in a single call.

### Syntax

```vcl
header.filter(ID where, STRING header_name, ...)
```

### Parameters

- `where`: The variable collection to filter, as a bare identifier: `req`, `bereq`, `resp` or `beresp`
- `header_name`: One or more header names to remove (must be literal strings, matched by name, not by regular expression)

### Return Value

None

### Examples

#### Basic header filtering

```vcl
# Remove debugging and temporary headers in one call
header.filter(req, "X-Debug", "X-Temp");
```

#### Security-related header filtering

This example demonstrates how to filter potentially sensitive headers:

```vcl
# Remove headers that might contain sensitive information
header.filter(req, "X-Auth-Token", "X-API-Key");
```

#### Backend request optimization

This example demonstrates how to filter unnecessary headers for backend requests (in `vcl_miss` or `vcl_pass`):

```vcl
# Remove tracking and analytics headers when forwarding to the backend
header.filter(bereq, "X-Track-ID", "X-Analytics-Session");
```

#### Response header cleanup

This example demonstrates how to clean up response headers:

```vcl
# Remove internal and debug headers from the response
header.filter(resp, "X-Internal-Route", "X-Debug-Info");
```

#### Compliance and privacy

This example demonstrates how to filter headers for compliance reasons:

```vcl
# Remove headers that might contain PII (Personally Identifiable Information)
header.filter(req, "X-User-ID", "X-Account-ID", "X-Email");
```

## header.filter_except

Removes all HTTP headers except those with the given names. The function is variadic: several header names can be passed in a single call.

### Syntax

```vcl
header.filter_except(ID where, STRING header_name, ...)
```

### Parameters

- `where`: The variable collection to filter, as a bare identifier: `req`, `bereq`, `resp` or `beresp`
- `header_name`: One or more header names to keep (must be literal strings, matched by name, not by regular expression)

### Return Value

None

### Examples

#### Basic header filtering except

```vcl
# Keep only essential headers, remove everything else
header.filter_except(req, "Host", "User-Agent", "Accept", "Accept-Encoding", "Authorization");
```

#### API request optimization

This example demonstrates how to keep only API-relevant headers:

```vcl
if (req.url ~ "^/api/") {
  # Keep only API-relevant headers
  header.filter_except(req, "Host", "Authorization", "Content-Type", "Accept", "X-API-Version");
}
```

#### Security hardening

This example demonstrates how to keep only necessary headers for security reasons:

```vcl
if (req.url ~ "^/admin/") {
  # Keep only essential headers for admin requests
  header.filter_except(req, "Host", "Authorization", "X-CSRF-Token");
}
```

#### Backend request optimization

This example demonstrates how to optimize backend requests (in `vcl_miss` or `vcl_pass`):

```vcl
# Keep only necessary headers for the backend
header.filter_except(bereq, "Host", "X-Forwarded-For", "Authorization", "Content-Type", "Accept");
```

#### Response header optimization

This example demonstrates how to optimize response headers:

```vcl
# Keep only necessary response headers
header.filter_except(resp, "Content-Type", "Content-Length", "Cache-Control", "ETag", "Expires", "Vary");
```

## http_status_matches

Checks if an HTTP status code matches a list of status codes.

### Syntax

```vcl
BOOL http_status_matches(INTEGER status, STRING fmt)
```

### Parameters

- `status`: The HTTP status code to check
- `fmt`: A comma-separated list of 3-digit status codes, optionally prefixed with `!` to negate the match (e.g. `"200,304"`, `"!404,410"`). Must be a literal string

### Return Value

- TRUE if the status code is in the list (or not in the list, when the list starts with `!`)
- FALSE otherwise

### Examples

#### Basic status code checking

```vcl
# Check for cacheable success responses
if (http_status_matches(resp.status, "200,203,204,206")) {
  set resp.http.X-Status-Category = "Success";
} else if (http_status_matches(resp.status, "301,302,303,307,308")) {
  set resp.http.X-Status-Category = "Redirect";
}
```

#### Specific error handling

This example demonstrates how to handle specific error codes:

```vcl
# Check for specific error codes
if (http_status_matches(resp.status, "404")) {
  # Handle 404 errors
  set resp.http.X-Error-Type = "Not Found";
  # Potentially modify the response or log the error
} else if (http_status_matches(resp.status, "403")) {
  # Handle 403 errors
  set resp.http.X-Error-Type = "Forbidden";
} else if (http_status_matches(resp.status, "500")) {
  # Handle 500 errors
  set resp.http.X-Error-Type = "Internal Server Error";
}
```

#### Negated matching

The list can be negated with a leading `!`:

```vcl
# Log everything that is not a plain success
if (http_status_matches(resp.status, "!200,204,304")) {
  log "Unusual status: " + resp.status + " for " + req.url;
}
```

#### Cache control based on status

This example demonstrates how to adjust cache settings based on status:

```vcl
# Don't cache error responses
if (http_status_matches(resp.status, "500,502,503,504")) {
  set resp.http.Cache-Control = "no-store, no-cache, must-revalidate, max-age=0";
}

# Cache successful responses
if (http_status_matches(resp.status, "200,203,204,206")) {
  set resp.http.Cache-Control = "public, max-age=3600";
}
```

## Integrated Example: Complete HTTP header management system

This example demonstrates how all HTTP functions can work together to create a comprehensive header management system.

```vcl
sub vcl_recv {
  # Step 1: Clean up incoming request headers
  
  # Remove unnecessary headers
  header.filter_except(req, "Host", "User-Agent", "Accept", "Accept-Encoding",
      "Accept-Language", "Authorization", "Content-Type", "Cookie", "X-Forwarded-For");
  
  # Step 2: Extract important information from headers
  declare local var.user_agent STRING;
  declare local var.auth_token STRING;
  declare local var.content_type STRING;
  
  set var.user_agent = header.get(req, "User-Agent");
  set var.auth_token = header.get(req, "Authorization");
  set var.content_type = header.get(req, "Content-Type");
  
  # Step 3: Set custom headers based on the request
  
  # Set a request ID for tracking
  header.set(req, "X-Request-ID", digest.hash_md5(now + req.url + client.ip));
  
  # Set device type based on User-Agent
  if (var.user_agent ~ "(?i)mobile|android|iphone|ipod|blackberry") {
    header.set(req, "X-Device-Type", "mobile");
  } else if (var.user_agent ~ "(?i)ipad|tablet") {
    header.set(req, "X-Device-Type", "tablet");
  } else {
    header.set(req, "X-Device-Type", "desktop");
  }
  
  # Step 4: Handle authentication
  if (var.auth_token == "") {
    # No authentication provided
    header.set(req, "X-Auth-Status", "none");
  } else if (var.auth_token ~ "^Bearer ") {
    # JWT token authentication
    header.set(req, "X-Auth-Status", "jwt");
    header.set(req, "X-Auth-Type", "bearer");
  } else if (var.auth_token ~ "^Basic ") {
    # Basic authentication
    header.set(req, "X-Auth-Status", "basic");
    header.set(req, "X-Auth-Type", "basic");
  } else {
    # Unknown authentication type
    header.set(req, "X-Auth-Status", "unknown");
  }
}

sub vcl_miss {
  # Step 5: Prepare backend request headers
  # (bereq only exists in backend-facing subroutines such as vcl_miss/vcl_pass)
  
  # Set headers for the backend
  header.set(bereq, "X-Forwarded-For", client.ip);
  header.set(bereq, "X-Original-URL", req.url);
  header.set(bereq, "X-Device-Type", header.get(req, "X-Device-Type"));
  
  # Remove sensitive headers from backend request
  header.filter(bereq, "Cookie", "X-Auth-Status", "X-Auth-Type");
}

sub vcl_deliver {
  # Step 6: Process response headers
  
  # Check response status
  if (http_status_matches(resp.status, "200,203,204,206")) {
    # Successful response
    header.set(resp, "X-Status-Category", "Success");
    
    # Set cache control headers for successful responses
    header.set(resp, "Cache-Control", "public, max-age=3600");
    header.set(resp, "Expires", time.add(now, 3600s));
    
  } else if (http_status_matches(resp.status, "301,302,303,307,308")) {
    # Redirect response
    header.set(resp, "X-Status-Category", "Redirect");
    
    # Set cache control headers for redirects
    header.set(resp, "Cache-Control", "public, max-age=300");
    header.set(resp, "Expires", time.add(now, 300s));
    
  } else if (http_status_matches(resp.status, "400,401,403,404,405,410,429")) {
    # Client error response
    header.set(resp, "X-Status-Category", "Client Error");
    
    # Don't cache client errors
    header.set(resp, "Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
    header.unset(resp, "Expires");
    
    # Add debugging information
    header.set(resp, "X-Error-Debug", "Request ID: " + header.get(req, "X-Request-ID"));
    
  } else if (http_status_matches(resp.status, "500,501,502,503,504")) {
    # Server error response
    header.set(resp, "X-Status-Category", "Server Error");
    
    # Don't cache server errors
    header.set(resp, "Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
    header.unset(resp, "Expires");
    
    # Add debugging information
    header.set(resp, "X-Error-Debug", "Request ID: " + header.get(req, "X-Request-ID") + ", Backend: " + req.backend);
  }
  
  # Step 7: Set security headers
  header.set(resp, "X-Content-Type-Options", "nosniff");
  header.set(resp, "X-XSS-Protection", "1; mode=block");
  header.set(resp, "X-Frame-Options", "SAMEORIGIN");
  
  # Step 8: Clean up internal headers, keeping only what clients need
  header.filter_except(resp, "Content-Type", "Content-Length", "Cache-Control",
      "ETag", "Expires", "Vary", "X-Content-Type-Options", "X-XSS-Protection",
      "X-Frame-Options", "X-Status-Category", "X-Error-Debug");
}
```

## Best Practices for HTTP Functions

1. Header Management:
   - Use header.filter_except to keep only necessary headers
   - Remove sensitive information from headers with header.filter
   - Set consistent security headers for all responses
   - Use descriptive names for custom headers (X-prefix for non-standard headers)

2. Status Code Handling:
   - Use http_status_matches to test against lists of status codes
   - Implement different caching strategies based on status codes
   - Add debugging information for error responses
   - Log errors appropriately based on status categories

3. Security Considerations:
   - Remove headers that reveal server information
   - Set security headers like X-Content-Type-Options, X-XSS-Protection, etc.
   - Filter out sensitive headers before forwarding to backends
   - Validate and sanitize header values before using them

4. Performance Optimization:
   - Remove unnecessary headers to reduce payload size
   - Set appropriate cache control headers based on content type and status
   - Use Vary header correctly to ensure proper caching
   - Only forward necessary headers to backends

5. Debugging and Monitoring:
   - Add request IDs for tracking requests across systems
   - Include useful debugging information in error responses
   - Log important header values for troubleshooting
   - Use custom headers to track request flow through your system