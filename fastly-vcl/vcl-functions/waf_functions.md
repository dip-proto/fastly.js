# WAF Functions

This file demonstrates comprehensive examples of WAF (Web Application Firewall) Functions in VCL.
These functions help implement security controls, rate limiting, and logging for protecting
web applications from various attacks and threats.

## waf.allow

Explicitly allows a request that might otherwise be blocked by WAF rules.

### Syntax

```vcl
waf.allow()
```

### Parameters

None

### Return Value

None

### Examples

#### Basic WAF allow

```vcl
# Allow requests from trusted IP addresses
if (client.ip ~ trusted_ips) {
  # Explicitly allow the request, bypassing WAF rules
  waf.allow();
  
  # Log the allowed request
  log "WAF: Request from trusted IP " + client.ip + " explicitly allowed";
}
```

#### Allowing internal API requests

```vcl
if (req.url.path ~ "^/internal-api/" && req.http.X-API-Key == "internal-key") {
  # Explicitly allow internal API requests with the correct key
  waf.allow();
  
  # Log the allowed internal API request
  log "WAF: Internal API request explicitly allowed";
}
```

#### Allowing specific user agents

```vcl
if (req.http.User-Agent ~ "^Monitoring-Bot/") {
  # Explicitly allow monitoring bot requests
  waf.allow();
  
  # Log the allowed monitoring bot request
  log "WAF: Monitoring bot request explicitly allowed";
}
```

#### Allowing specific paths

```vcl
if (req.url.path ~ "^/health-check$") {
  # Explicitly allow health check requests
  waf.allow();
  
  # Log the allowed health check request
  log "WAF: Health check request explicitly allowed";
}
```

#### Allowing authenticated users

```vcl
if (req.http.Cookie:session && req.http.Cookie:session ~ "authenticated=true") {
  # Explicitly allow authenticated user requests
  waf.allow();
  
  # Log the allowed authenticated user request
  log "WAF: Authenticated user request explicitly allowed";
}
```

## waf.block

Explicitly blocks a request.

### Syntax

```vcl
waf.block(INTEGER status, STRING message)
```

### Parameters

- `status`: The HTTP status code to return (e.g., 403)
- `message`: The message to include in the response

### Return Value

None

### Examples

#### Basic WAF block

```vcl
# Block requests with suspicious query parameters
if (req.url.qs ~ "(?i)(union|select|insert|update|delete|drop)") {
  # Explicitly block the request with a 403 Forbidden status
  waf.block(403, "Forbidden: Suspicious SQL keywords detected");
  
  # Log the blocked request
  log "WAF: Request with suspicious SQL keywords blocked";
}
```

#### Blocking requests from specific countries

```vcl
if (client.geo.country_code ~ "(CN|RU|KP)") {
  # Explicitly block the request with a 403 Forbidden status
  waf.block(403, "Access denied based on geographic location");
  
  # Log the blocked request
  log "WAF: Request from blocked country " + client.geo.country_code + " blocked";
}
```

#### Blocking requests with missing or invalid headers

```vcl
if (!req.http.X-API-Key) {
  # Explicitly block the request with a 401 Unauthorized status
  waf.block(401, "Unauthorized: Missing API key");
  
  # Log the blocked request
  log "WAF: Request with missing API key blocked";
} else if (req.http.X-API-Key !~ "^[a-zA-Z0-9]{32}$") {
  # Explicitly block the request with a 401 Unauthorized status
  waf.block(401, "Unauthorized: Invalid API key format");
  
  # Log the blocked request
  log "WAF: Request with invalid API key format blocked";
}
```

#### Blocking requests with suspicious file uploads

```vcl
if (req.url.path ~ "^/upload" && req.http.Content-Type ~ "application/x-msdownload") {
  # Explicitly block the request with a 403 Forbidden status
  waf.block(403, "Forbidden: Executable file upload not allowed");
  
  # Log the blocked request
  log "WAF: Executable file upload blocked";
}
```

#### Blocking requests during maintenance

```vcl
declare local var.maintenance_mode BOOL;
set var.maintenance_mode = true;  # This would typically be set based on a configuration

if (var.maintenance_mode && req.url.path !~ "^/maintenance") {
  # Explicitly block the request with a 503 Service Unavailable status
  waf.block(503, "Service Unavailable: Maintenance in progress");
  
  # Log the blocked request
  log "WAF: Request during maintenance blocked";
}
```

## waf.log

Logs a message to the WAF logging endpoint.

### Syntax

```vcl
waf.log(STRING message)
```

### Parameters

- `message`: The message to log

### Return Value

None

### Examples

#### Basic WAF logging

```vcl
# Log all requests to a specific endpoint
if (req.url.path ~ "^/api/") {
  # Log the API request
  waf.log("API request: " + req.method + " " + req.url.path);
}
```

#### Logging suspicious activity

```vcl
if (req.http.User-Agent ~ "(?i)(nikto|sqlmap|nessus|nmap|zap|burp|w3af)") {
  # Log the suspicious user agent
  waf.log("Suspicious User-Agent detected: " + req.http.User-Agent);
}
```

#### Logging authentication attempts

```vcl
if (req.url.path ~ "^/login") {
  # Log the login attempt
  waf.log("Login attempt from IP: " + client.ip + ", User-Agent: " + req.http.User-Agent);
}
```

#### Logging with request details

```vcl
declare local var.log_message STRING;

# Build a detailed log message
set var.log_message = "Request details: ";
set var.log_message = var.log_message + "Method=" + req.method;
set var.log_message = var.log_message + ", Path=" + req.url.path;
set var.log_message = var.log_message + ", QueryString=" + req.url.qs;
set var.log_message = var.log_message + ", ClientIP=" + client.ip;
set var.log_message = var.log_message + ", Country=" + client.geo.country_code;

# Log the detailed message
waf.log(var.log_message);
```

#### Conditional logging based on headers

```vcl
if (req.http.X-Forwarded-For) {
  # Log the X-Forwarded-For header
  waf.log("X-Forwarded-For chain: " + req.http.X-Forwarded-For);
}
```

## waf.rate_limit

Implements a token bucket rate limiter.

### Syntax

```vcl
BOOL waf.rate_limit(STRING key, INTEGER limit, RTIME window)
```

### Parameters

- `key`: The key to rate limit on (e.g., client.ip)
- `limit`: The maximum number of requests allowed in the window
- `window`: The time window for the rate limit

### Return Value

- TRUE if the request should be allowed
- FALSE if the request should be blocked (rate limit exceeded)

### Examples

#### Basic IP-based rate limiting

```vcl
declare local var.ip_allowed BOOL;

# Rate limit based on client IP: 100 requests per minute
set var.ip_allowed = waf.rate_limit(client.ip, 100, 60s);

if (!var.ip_allowed) {
  # Rate limit exceeded, block the request
  waf.block(429, "Too Many Requests: Rate limit exceeded");
  
  # Log the rate-limited request
  log "WAF: Rate limit exceeded for IP " + client.ip;
}
```

#### Path-specific rate limiting

```vcl
declare local var.api_allowed BOOL;

if (req.url.path ~ "^/api/") {
  # Rate limit API requests: 10 requests per second
  set var.api_allowed = waf.rate_limit(client.ip + ":api", 10, 1s);
  
  if (!var.api_allowed) {
    # Rate limit exceeded, block the request
    waf.block(429, "Too Many Requests: API rate limit exceeded");
    
    # Log the rate-limited API request
    log "WAF: API rate limit exceeded for IP " + client.ip;
  }
}
```

#### User-specific rate limiting

```vcl
declare local var.user_id STRING;
declare local var.user_allowed BOOL;

# Get user ID from a cookie or header
set var.user_id = req.http.Cookie:user_id;

if (var.user_id) {
  # Rate limit based on user ID: 1000 requests per hour
  set var.user_allowed = waf.rate_limit("user:" + var.user_id, 1000, 3600s);
  
  if (!var.user_allowed) {
    # Rate limit exceeded, block the request
    waf.block(429, "Too Many Requests: User rate limit exceeded");
    
    # Log the rate-limited user request
    log "WAF: User rate limit exceeded for user " + var.user_id;
  }
}
```

#### Endpoint-specific rate limiting

```vcl
declare local var.login_allowed BOOL;

if (req.url.path ~ "^/login" && req.method == "POST") {
  # Rate limit login attempts: 5 attempts per minute per IP
  set var.login_allowed = waf.rate_limit(client.ip + ":login", 5, 60s);
  
  if (!var.login_allowed) {
    # Rate limit exceeded, block the request
    waf.block(429, "Too Many Requests: Login attempt rate limit exceeded");
    
    # Log the rate-limited login attempt
    log "WAF: Login rate limit exceeded for IP " + client.ip;
  }
}
```

#### Combined key rate limiting

```vcl
declare local var.combined_key STRING;
declare local var.combined_allowed BOOL;

# Create a combined key based on IP and User-Agent
set var.combined_key = client.ip + ":" + digest.hash_sha256(req.http.User-Agent);

# Rate limit based on the combined key: 50 requests per minute
set var.combined_allowed = waf.rate_limit(var.combined_key, 50, 60s);

if (!var.combined_allowed) {
  # Rate limit exceeded, block the request
  waf.block(429, "Too Many Requests: Combined rate limit exceeded");
  
  # Log the rate-limited request
  log "WAF: Combined rate limit exceeded for IP " + client.ip;
}
```

## waf.rate_limit_tokens

Returns the number of tokens remaining in a rate limit bucket.

### Syntax

```vcl
INTEGER waf.rate_limit_tokens(STRING key)
```

### Parameters

- `key`: The key used in a previous waf.rate_limit call

### Return Value

The number of tokens remaining in the bucket

### Examples

#### Basic token checking

```vcl
declare local var.ip_allowed BOOL;
declare local var.tokens_remaining INTEGER;

# Rate limit based on client IP: 100 requests per minute
set var.ip_allowed = waf.rate_limit(client.ip, 100, 60s);

# Get the number of tokens remaining
set var.tokens_remaining = waf.rate_limit_tokens(client.ip);

# Set the tokens remaining in a header
set req.http.X-Rate-Limit-Remaining = var.tokens_remaining;
```

#### Logging token information

```vcl
declare local var.api_allowed BOOL;
declare local var.api_tokens INTEGER;

if (req.url.path ~ "^/api/") {
  # Rate limit API requests: 10 requests per second
  set var.api_allowed = waf.rate_limit(client.ip + ":api", 10, 1s);
  
  # Get the number of API tokens remaining
  set var.api_tokens = waf.rate_limit_tokens(client.ip + ":api");
  
  # Log the tokens remaining
  log "WAF: API tokens remaining for IP " + client.ip + ": " + var.api_tokens;
  
  # Set the API tokens remaining in a header
  set req.http.X-API-Rate-Limit-Remaining = var.api_tokens;
}
```

#### Warning on low token count

```vcl
declare local var.user_id STRING;
declare local var.user_allowed BOOL;
declare local var.user_tokens INTEGER;

# Get user ID from a cookie or header
set var.user_id = req.http.Cookie:user_id;

if (var.user_id) {
  # Rate limit based on user ID: 1000 requests per hour
  set var.user_allowed = waf.rate_limit("user:" + var.user_id, 1000, 3600s);
  
  # Get the number of user tokens remaining
  set var.user_tokens = waf.rate_limit_tokens("user:" + var.user_id);
  
  # Set the user tokens remaining in a header
  set req.http.X-User-Rate-Limit-Remaining = var.user_tokens;
  
  # Warn if tokens are running low
  if (var.user_tokens < 100) {
    # Log a warning
    log "WAF: User " + var.user_id + " is running low on rate limit tokens: " + var.user_tokens;
    
    # Set a warning header
    set req.http.X-Rate-Limit-Warning = "true";
  }
}
```

#### Adaptive behavior based on token count

```vcl
declare local var.login_allowed BOOL;
declare local var.login_tokens INTEGER;

if (req.url.path ~ "^/login" && req.method == "POST") {
  # Rate limit login attempts: 5 attempts per minute per IP
  set var.login_allowed = waf.rate_limit(client.ip + ":login", 5, 60s);
  
  # Get the number of login tokens remaining
  set var.login_tokens = waf.rate_limit_tokens(client.ip + ":login");
  
  # Set the login tokens remaining in a header
  set req.http.X-Login-Rate-Limit-Remaining = var.login_tokens;
  
  # Add CAPTCHA requirement if tokens are running low
  if (var.login_tokens <= 2) {
    # Set a header to trigger CAPTCHA
    set req.http.X-Require-CAPTCHA = "true";
    
    # Log the CAPTCHA requirement
    log "WAF: CAPTCHA required for IP " + client.ip + " due to low login tokens: " + var.login_tokens;
  }
}
```

#### Multiple rate limit buckets

```vcl
declare local var.read_allowed BOOL;
declare local var.write_allowed BOOL;
declare local var.read_tokens INTEGER;
declare local var.write_tokens INTEGER;

# Rate limit read operations: 1000 requests per minute
set var.read_allowed = waf.rate_limit(client.ip + ":read", 1000, 60s);

# Rate limit write operations: 100 requests per minute
set var.write_allowed = waf.rate_limit(client.ip + ":write", 100, 60s);

# Get the number of tokens remaining for each bucket
set var.read_tokens = waf.rate_limit_tokens(client.ip + ":read");
set var.write_tokens = waf.rate_limit_tokens(client.ip + ":write");

# Set the tokens remaining in headers
set req.http.X-Read-Rate-Limit-Remaining = var.read_tokens;
set req.http.X-Write-Rate-Limit-Remaining = var.write_tokens;

# Log the token information
log "WAF: Rate limit tokens for IP " + client.ip + ": Read=" + var.read_tokens + ", Write=" + var.write_tokens;
```

## Integrated Example: Complete WAF Protection System

This example demonstrates how multiple WAF functions can work together to create a comprehensive protection system.

```vcl
sub vcl_recv {
  # Step 1: Check for trusted sources
  declare local var.is_trusted BOOL;
  
  # Check if the request is from a trusted source
  if (client.ip ~ trusted_ips || req.http.X-API-Key == "trusted-key") {
    set var.is_trusted = true;
    
    # Explicitly allow trusted requests
    waf.allow();
    
    # Log the allowed trusted request
    waf.log("Trusted request allowed: " + client.ip);
  } else {
    set var.is_trusted = false;
  }
  
  # Step 2: Check for malicious patterns (if not trusted)
  if (!var.is_trusted) {
    # Check for SQL injection attempts
    if (req.url.qs ~ "(?i)(union|select|insert|update|delete|drop)") {
      # Block the request
      waf.block(403, "Forbidden: Suspicious SQL keywords detected");
      
      # Log the blocked request
      waf.log("SQL injection attempt blocked: " + req.url.qs);
      return;
    }
    
    # Check for XSS attempts
    if (req.url.qs ~ "(?i)(<script|javascript:|on\w+\s*=)") {
      # Block the request
      waf.block(403, "Forbidden: Suspicious XSS patterns detected");
      
      # Log the blocked request
      waf.log("XSS attempt blocked: " + req.url.qs);
      return;
    }
    
    # Check for path traversal attempts
    if (req.url.path ~ "(?i)(\.\./)") {
      # Block the request
      waf.block(403, "Forbidden: Path traversal attempt detected");
      
      # Log the blocked request
      waf.log("Path traversal attempt blocked: " + req.url.path);
      return;
    }
  }
  
  # Step 3: Apply rate limiting
  declare local var.rate_limit_key STRING;
  declare local var.rate_limit_allowed BOOL;
  declare local var.tokens_remaining INTEGER;
  
  # Determine the appropriate rate limit key
  if (req.http.Cookie:user_id) {
    # Use user ID for authenticated users
    set var.rate_limit_key = "user:" + req.http.Cookie:user_id;
  } else {
    # Use IP address for anonymous users
    set var.rate_limit_key = "ip:" + client.ip;
  }
  
  # Apply different rate limits based on the request type
  if (req.method == "GET") {
    # Rate limit GET requests: 1000 per minute
    set var.rate_limit_allowed = waf.rate_limit(var.rate_limit_key + ":get", 1000, 60s);
    set var.tokens_remaining = waf.rate_limit_tokens(var.rate_limit_key + ":get");
  } else if (req.method == "POST" || req.method == "PUT" || req.method == "DELETE") {
    # Rate limit write requests: 100 per minute
    set var.rate_limit_allowed = waf.rate_limit(var.rate_limit_key + ":write", 100, 60s);
    set var.tokens_remaining = waf.rate_limit_tokens(var.rate_limit_key + ":write");
  } else {
    # Rate limit other requests: 50 per minute
    set var.rate_limit_allowed = waf.rate_limit(var.rate_limit_key + ":other", 50, 60s);
    set var.tokens_remaining = waf.rate_limit_tokens(var.rate_limit_key + ":other");
  }
  
  # Check if rate limit was exceeded
  if (!var.rate_limit_allowed) {
    # Block the request
    waf.block(429, "Too Many Requests: Rate limit exceeded");
    
    # Log the rate-limited request
    waf.log("Rate limit exceeded for key: " + var.rate_limit_key);
    return;
  }
  
  # Set rate limit headers
  set req.http.X-Rate-Limit-Remaining = var.tokens_remaining;
  
  # Step 4: Apply additional security measures for sensitive operations
  if (req.url.path ~ "^/admin/" || req.url.path ~ "^/api/v1/sensitive/") {
    # Check for required security headers
    if (!req.http.X-Security-Token) {
      # Block the request
      waf.block(403, "Forbidden: Missing security token");
      
      # Log the blocked request
      waf.log("Sensitive operation blocked: Missing security token");
      return;
    }
    
    # Apply stricter rate limits for sensitive operations
    declare local var.sensitive_allowed BOOL;
    
    set var.sensitive_allowed = waf.rate_limit(var.rate_limit_key + ":sensitive", 10, 60s);
    
    if (!var.sensitive_allowed) {
      # Block the request
      waf.block(429, "Too Many Requests: Sensitive operation rate limit exceeded");
      
      # Log the rate-limited request
      waf.log("Sensitive operation rate limit exceeded for key: " + var.rate_limit_key);
      return;
    }
  }
  
  # Step 5: Log request details for monitoring
  declare local var.log_message STRING;
  
  # Build a detailed log message
  set var.log_message = "Request details: ";
  set var.log_message = var.log_message + "Method=" + req.method;
  set var.log_message = var.log_message + ", Path=" + req.url.path;
  set var.log_message = var.log_message + ", ClientIP=" + client.ip;
  set var.log_message = var.log_message + ", RateLimit=" + var.tokens_remaining;
  
  # Log the detailed message
  waf.log(var.log_message);
}
```

## Best Practices for WAF Functions

1. WAF Allow/Block:
   - Use waf.allow() sparingly and only for trusted sources
   - Use waf.block() with appropriate status codes and messages
   - Consider the order of allow/block rules (more specific first)

2. WAF Logging:
   - Log security-relevant events with waf.log()
   - Include enough context in log messages for analysis
   - Avoid logging sensitive information

3. Rate Limiting:
   - Choose appropriate keys for rate limiting (IP, user ID, etc.)
   - Set reasonable limits and windows based on the resource
   - Use waf.rate_limit_tokens() to provide feedback to clients

4. Security Considerations:
   - Layer multiple security controls for defense in depth
   - Validate and sanitize all user input
   - Apply the principle of least privilege

5. Performance Considerations:
   - Balance security with performance
   - Use efficient regex patterns
   - Consider the impact of rate limiting on legitimate traffic

6. Monitoring and Alerting:
   - Log security events for monitoring
   - Set up alerts for suspicious activity
   - Regularly review logs for security incidents