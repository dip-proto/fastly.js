# Rate Limiting Functions

This file demonstrates comprehensive examples of Rate Limiting Functions in VCL.
These functions help implement rate limiting, request throttling, and abuse prevention
at the edge, protecting origin servers from excessive traffic and potential attacks.

## ratelimit.ratecounter_increment

Increments a named rate counter by a specified amount.

### Syntax

```vcl
ratelimit.ratecounter_increment(STRING counter_name, INTEGER increment_by)
```

### Parameters

- `counter_name`: The name of the rate counter to increment
- `increment_by`: The amount to increment the counter by (default: 1)

### Return Value

None

### Examples

#### Basic rate counter increment

```vcl
# Increment a rate counter named "requests" by 1
ratelimit.ratecounter_increment("requests", 1);
```

#### Incrementing different counters based on request type

```vcl
# Track different types of requests separately
if (req.method == "GET") {
  ratelimit.ratecounter_increment("get_requests", 1);
} else if (req.method == "POST") {
  ratelimit.ratecounter_increment("post_requests", 1);
} else if (req.method == "PUT" || req.method == "PATCH") {
  ratelimit.ratecounter_increment("update_requests", 1);
} else if (req.method == "DELETE") {
  ratelimit.ratecounter_increment("delete_requests", 1);
}
```

#### Incrementing counters with different weights

```vcl
# Track API requests with different weights based on resource intensity
if (req.url ~ "^/api/light/") {
  # Light API requests count as 1
  ratelimit.ratecounter_increment("api_requests", 1);
} else if (req.url ~ "^/api/medium/") {
  # Medium API requests count as 2
  ratelimit.ratecounter_increment("api_requests", 2);
} else if (req.url ~ "^/api/heavy/") {
  # Heavy API requests count as 5
  ratelimit.ratecounter_increment("api_requests", 5);
}
```

#### User-specific rate counters

```vcl
declare local var.user_id STRING;

# Get user identifier (from auth token, cookie, or IP)
if (req.http.Authorization) {
  # Extract user ID from Authorization header (simplified)
  set var.user_id = digest.hash_md5(req.http.Authorization);
} else if (req.http.Cookie:user_id) {
  # Extract user ID from cookie
  set var.user_id = req.http.Cookie:user_id;
} else {
  # Fall back to client IP
  set var.user_id = client.ip;
}

# Increment user-specific counter
ratelimit.ratecounter_increment("user_" + var.user_id, 1);
```

#### Path-specific rate counters

```vcl
declare local var.path_segment STRING;

# Extract the first path segment
if (req.url.path ~ "^/([^/]+)") {
  set var.path_segment = re.group.1;
  
  # Increment path-specific counter
  ratelimit.ratecounter_increment("path_" + var.path_segment, 1);
}
```

## ratelimit.check_rate

Checks if a rate limit has been exceeded.

### Syntax

```vcl
BOOL ratelimit.check_rate(STRING counter_name, INTEGER rate_per_second)
```

### Parameters

- `counter_name`: The name of the rate counter to check
- `rate_per_second`: The maximum allowed rate per second

### Return Value

- TRUE if the rate limit has been exceeded
- FALSE otherwise

### Examples

#### Basic rate limiting

```vcl
declare local var.rate_exceeded BOOL;

# Check if the overall request rate exceeds 100 requests per second
set var.rate_exceeded = ratelimit.check_rate("requests", 100);

if (var.rate_exceeded) {
  # Rate limit exceeded, return 429 Too Many Requests
  error 429 "Too Many Requests";
}
```

#### Different rate limits for different request types

```vcl
declare local var.post_rate_exceeded BOOL;
declare local var.delete_rate_exceeded BOOL;

# Check if POST requests exceed 10 per second
if (req.method == "POST") {
  set var.post_rate_exceeded = ratelimit.check_rate("post_requests", 10);
  
  if (var.post_rate_exceeded) {
    error 429 "Too Many POST Requests";
  }
}

# Check if DELETE requests exceed 5 per second
if (req.method == "DELETE") {
  set var.delete_rate_exceeded = ratelimit.check_rate("delete_requests", 5);
  
  if (var.delete_rate_exceeded) {
    error 429 "Too Many DELETE Requests";
  }
}
```

#### User-specific rate limiting

```vcl
declare local var.user_id STRING;
declare local var.user_rate_exceeded BOOL;

# Get user identifier (from auth token, cookie, or IP)
if (req.http.Authorization) {
  # Extract user ID from Authorization header (simplified)
  set var.user_id = digest.hash_md5(req.http.Authorization);
} else if (req.http.Cookie:user_id) {
  # Extract user ID from cookie
  set var.user_id = req.http.Cookie:user_id;
} else {
  # Fall back to client IP
  set var.user_id = client.ip;
}

# Check if user exceeds 5 requests per second
set var.user_rate_exceeded = ratelimit.check_rate("user_" + var.user_id, 5);

if (var.user_rate_exceeded) {
  error 429 "User Rate Limit Exceeded";
}
```

#### Path-specific rate limiting

```vcl
declare local var.path_segment STRING;
declare local var.path_rate_exceeded BOOL;

# Extract the first path segment
if (req.url.path ~ "^/([^/]+)") {
  set var.path_segment = re.group.1;
  
  # Check if path-specific rate exceeds the limit
  # Different paths can have different limits
  if (var.path_segment == "api") {
    set var.path_rate_exceeded = ratelimit.check_rate("path_" + var.path_segment, 50);
  } else if (var.path_segment == "admin") {
    set var.path_rate_exceeded = ratelimit.check_rate("path_" + var.path_segment, 10);
  } else {
    set var.path_rate_exceeded = ratelimit.check_rate("path_" + var.path_segment, 100);
  }
  
  if (var.path_rate_exceeded) {
    error 429 "Path Rate Limit Exceeded";
  }
}
```

#### Tiered rate limiting with headers

```vcl
declare local var.tier STRING;
declare local var.tier_limit INTEGER;
declare local var.tier_rate_exceeded BOOL;

# Determine user tier from a header
set var.tier = req.http.X-User-Tier;

# Set rate limit based on tier
if (var.tier == "premium") {
  set var.tier_limit = 50;
} else if (var.tier == "standard") {
  set var.tier_limit = 20;
} else {
  # Default/free tier
  set var.tier_limit = 5;
}

# Check if tier-specific rate is exceeded
set var.tier_rate_exceeded = ratelimit.check_rate("tier_" + var.tier + "_" + var.user_id, var.tier_limit);

if (var.tier_rate_exceeded) {
  error 429 "Tier Rate Limit Exceeded";
}
```

## ratelimit.check_rates

Checks if any of multiple rate limits have been exceeded.

### Syntax

```vcl
BOOL ratelimit.check_rates(STRING counter_name, STRING rates)
```

### Parameters

- `counter_name`: The name of the rate counter to check
- `rates`: A comma-separated list of rates in the format "count:seconds"

### Return Value

- TRUE if any rate limit has been exceeded
- FALSE otherwise

### Examples

#### Multi-window rate limiting

```vcl
declare local var.rates_exceeded BOOL;

# Check multiple rate limits:
# - 10 requests per second
# - 50 requests per minute
# - 1000 requests per hour
set var.rates_exceeded = ratelimit.check_rates("requests", "10:1,50:60,1000:3600");

if (var.rates_exceeded) {
  error 429 "Rate Limit Exceeded";
}
```

#### User-specific multi-window rate limiting

```vcl
declare local var.user_id STRING;
declare local var.user_rates_exceeded BOOL;

# Get user identifier
if (req.http.Authorization) {
  set var.user_id = digest.hash_md5(req.http.Authorization);
} else if (req.http.Cookie:user_id) {
  set var.user_id = req.http.Cookie:user_id;
} else {
  set var.user_id = client.ip;
}

# Check user-specific rate limits:
# - 5 requests per second
# - 20 requests per minute
# - 100 requests per hour
set var.user_rates_exceeded = ratelimit.check_rates("user_" + var.user_id, "5:1,20:60,100:3600");

if (var.user_rates_exceeded) {
  error 429 "User Rate Limit Exceeded";
}
```

#### API endpoint multi-window rate limiting

```vcl
declare local var.endpoint STRING;
declare local var.endpoint_rates_exceeded BOOL;

# Extract API endpoint from URL
if (req.url.path ~ "^/api/([^/]+)") {
  set var.endpoint = re.group.1;
  
  # Check endpoint-specific rate limits
  if (var.endpoint == "users") {
    set var.endpoint_rates_exceeded = ratelimit.check_rates("endpoint_" + var.endpoint, "10:1,50:60");
  } else if (var.endpoint == "orders") {
    set var.endpoint_rates_exceeded = ratelimit.check_rates("endpoint_" + var.endpoint, "5:1,20:60");
  } else {
    set var.endpoint_rates_exceeded = ratelimit.check_rates("endpoint_" + var.endpoint, "20:1,100:60");
  }
  
  if (var.endpoint_rates_exceeded) {
    error 429 "API Endpoint Rate Limit Exceeded";
  }
}
```

#### Tiered multi-window rate limiting

```vcl
declare local var.tier STRING;
declare local var.tier_rates STRING;
declare local var.tier_rates_exceeded BOOL;

# Determine user tier
set var.tier = req.http.X-User-Tier;

# Set rate limits based on tier
if (var.tier == "premium") {
  set var.tier_rates = "50:1,200:60,1000:3600";
} else if (var.tier == "standard") {
  set var.tier_rates = "20:1,100:60,500:3600";
} else {
  # Default/free tier
  set var.tier_rates = "5:1,20:60,100:3600";
}

# Check tier-specific rate limits
set var.tier_rates_exceeded = ratelimit.check_rates("tier_" + var.tier + "_" + var.user_id, var.tier_rates);

if (var.tier_rates_exceeded) {
  error 429 "Tier Rate Limit Exceeded";
}
```

#### Different rate limits for different HTTP methods

```vcl
declare local var.method_rates_exceeded BOOL;

# Check method-specific rate limits
if (req.method == "GET") {
  set var.method_rates_exceeded = ratelimit.check_rates("method_GET", "100:1,1000:60");
} else if (req.method == "POST") {
  set var.method_rates_exceeded = ratelimit.check_rates("method_POST", "10:1,50:60");
} else if (req.method == "PUT" || req.method == "PATCH") {
  set var.method_rates_exceeded = ratelimit.check_rates("method_UPDATE", "5:1,20:60");
} else if (req.method == "DELETE") {
  set var.method_rates_exceeded = ratelimit.check_rates("method_DELETE", "2:1,10:60");
}

if (var.method_rates_exceeded) {
  error 429 "Method Rate Limit Exceeded";
}
```

## ratelimit.penaltybox_add

Adds an identifier to a penalty box for a specified duration.

### Syntax

```vcl
ratelimit.penaltybox_add(STRING penaltybox_name, STRING identifier, INTEGER duration)
```

### Parameters

- `penaltybox_name`: The name of the penalty box
- `identifier`: The identifier to add to the penalty box
- `duration`: The duration in seconds to keep the identifier in the penalty box

### Return Value

None

### Examples

#### Basic penalty box usage

```vcl
declare local var.user_id STRING;
declare local var.rate_exceeded BOOL;

# Get user identifier
if (req.http.Authorization) {
  set var.user_id = digest.hash_md5(req.http.Authorization);
} else if (req.http.Cookie:user_id) {
  set var.user_id = req.http.Cookie:user_id;
} else {
  set var.user_id = client.ip;
}

# Check if user exceeds rate limit
set var.rate_exceeded = ratelimit.check_rate("user_" + var.user_id, 10);

if (var.rate_exceeded) {
  # Add user to penalty box for 5 minutes (300 seconds)
  ratelimit.penaltybox_add("user_penalty", var.user_id, 300);
  
  error 429 "Rate Limit Exceeded - Please try again later";
}
```

#### IP-based penalty box for suspicious activity

```vcl
declare local var.is_suspicious BOOL;

# Determine if request is suspicious (simplified example)
set var.is_suspicious = (
  req.http.User-Agent == "" || 
  req.http.User-Agent ~ "^$" ||
  req.url ~ "\.(php|asp|aspx|jsp)\.js$" ||
  req.url ~ "select.*from" ||
  req.url ~ "union.*select" ||
  req.url ~ "insert.*into"
);

if (var.is_suspicious) {
  # Add IP to penalty box for 1 hour (3600 seconds)
  ratelimit.penaltybox_add("suspicious_ips", client.ip, 3600);
  
  error 403 "Forbidden";
}
```

#### Graduated penalty box durations

```vcl
declare local var.violation_count INTEGER;
declare local var.penalty_duration INTEGER;

# Get violation count from a header (in a real scenario, this would come from a database or edge dictionary)
set var.violation_count = std.atoi(req.http.X-Violation-Count);

# Set penalty duration based on violation count
if (var.violation_count == 1) {
  # First violation: 5 minutes
  set var.penalty_duration = 300;
} else if (var.violation_count == 2) {
  # Second violation: 30 minutes
  set var.penalty_duration = 1800;
} else if (var.violation_count == 3) {
  # Third violation: 2 hours
  set var.penalty_duration = 7200;
} else {
  # Four or more violations: 24 hours
  set var.penalty_duration = 86400;
}

# Add to penalty box with graduated duration
if (var.violation_count > 0) {
  ratelimit.penaltybox_add("graduated_penalty", var.user_id, var.penalty_duration);
  
  error 429 "Rate Limit Exceeded - Please try again later";
}
```

#### Different penalty boxes for different violations

```vcl
# Check for API abuse
if (ratelimit.check_rate("api_" + var.user_id, 20)) {
  # Add to API abuse penalty box for 10 minutes
  ratelimit.penaltybox_add("api_abuse", var.user_id, 600);
  
  error 429 "API Rate Limit Exceeded";
}

# Check for login attempts
if (req.url.path == "/login" && req.method == "POST") {
  if (ratelimit.check_rate("login_" + client.ip, 5)) {
    # Add to login abuse penalty box for 15 minutes
    ratelimit.penaltybox_add("login_abuse", client.ip, 900);
    
    error 429 "Too Many Login Attempts";
  }
}
```

#### Penalty box with custom response

```vcl
declare local var.custom_status INTEGER;
declare local var.custom_response STRING;

# Check for scraping behavior
if (ratelimit.check_rate("scraping_" + client.ip, 30)) {
  # Add to scraping penalty box for 1 hour
  ratelimit.penaltybox_add("scraping", client.ip, 3600);
  
  # Set custom response
  set var.custom_status = 429;
  set var.custom_response = "{\"error\": \"Rate limit exceeded\", \"retry_after\": 3600}";
  
  error var.custom_status var.custom_response;
}
```

## ratelimit.penaltybox_has

Checks if an identifier is in a penalty box.

### Syntax

```vcl
BOOL ratelimit.penaltybox_has(STRING penaltybox_name, STRING identifier)
```

### Parameters

- `penaltybox_name`: The name of the penalty box
- `identifier`: The identifier to check

### Return Value

- TRUE if the identifier is in the penalty box
- FALSE otherwise

### Examples

#### Basic penalty box check

```vcl
declare local var.user_id STRING;
declare local var.in_penalty_box BOOL;

# Get user identifier
if (req.http.Authorization) {
  set var.user_id = digest.hash_md5(req.http.Authorization);
} else if (req.http.Cookie:user_id) {
  set var.user_id = req.http.Cookie:user_id;
} else {
  set var.user_id = client.ip;
}

# Check if user is in penalty box
set var.in_penalty_box = ratelimit.penaltybox_has("user_penalty", var.user_id);

if (var.in_penalty_box) {
  error 429 "Too Many Requests - Please try again later";
}
```

#### IP-based penalty box check for suspicious activity

```vcl
declare local var.ip_blocked BOOL;

# Check if IP is in suspicious IPs penalty box
set var.ip_blocked = ratelimit.penaltybox_has("suspicious_ips", client.ip);

if (var.ip_blocked) {
  error 403 "Forbidden";
}
```

#### Checking multiple penalty boxes

```vcl
declare local var.in_any_penalty_box BOOL;

# Check if user is in any penalty box
set var.in_any_penalty_box = (
  ratelimit.penaltybox_has("user_penalty", var.user_id) ||
  ratelimit.penaltybox_has("api_abuse", var.user_id) ||
  ratelimit.penaltybox_has("login_abuse", client.ip) ||
  ratelimit.penaltybox_has("scraping", client.ip)
);

if (var.in_any_penalty_box) {
  error 429 "Access Temporarily Restricted";
}
```

#### Different handling based on penalty box type

```vcl
declare local var.in_api_penalty BOOL;
declare local var.in_login_penalty BOOL;

# Check specific penalty boxes
set var.in_api_penalty = ratelimit.penaltybox_has("api_abuse", var.user_id);
set var.in_login_penalty = ratelimit.penaltybox_has("login_abuse", client.ip);

# Handle differently based on penalty box type
if (var.in_api_penalty) {
  # Only block API requests
  if (req.url ~ "^/api/") {
    error 429 "API Access Restricted";
  }
}

if (var.in_login_penalty) {
  # Only block login attempts
  if (req.url.path == "/login") {
    error 429 "Too Many Login Attempts";
  }
}
```

#### Penalty box check with custom response headers

```vcl
declare local var.in_penalty BOOL;

# Check if in penalty box
set var.in_penalty = ratelimit.penaltybox_has("graduated_penalty", var.user_id);

if (var.in_penalty) {
  # Set custom response headers
  set req.http.X-Rate-Limited = "true";
  set req.http.Retry-After = "300";
  
  error 429 "Rate Limit Exceeded";
}
```

## limiter.inc

Increments a named counter by a specified amount.

### Syntax

```vcl
limiter.inc(STRING counter_name, INTEGER increment_by)
```

### Parameters

- `counter_name`: The name of the counter to increment
- `increment_by`: The amount to increment the counter by (default: 1)

### Return Value

None

### Examples

#### Basic counter increment

```vcl
# Increment a counter named "total_requests" by 1
limiter.inc("total_requests", 1);
```

#### Incrementing different counters based on request type

```vcl
# Track different types of requests separately
if (req.method == "GET") {
  limiter.inc("get_requests", 1);
} else if (req.method == "POST") {
  limiter.inc("post_requests", 1);
} else if (req.method == "PUT" || req.method == "PATCH") {
  limiter.inc("update_requests", 1);
} else if (req.method == "DELETE") {
  limiter.inc("delete_requests", 1);
}
```

#### Incrementing counters with different weights

```vcl
# Track API requests with different weights based on resource intensity
if (req.url ~ "^/api/light/") {
  # Light API requests count as 1
  limiter.inc("api_requests", 1);
} else if (req.url ~ "^/api/medium/") {
  # Medium API requests count as 2
  limiter.inc("api_requests", 2);
} else if (req.url ~ "^/api/heavy/") {
  # Heavy API requests count as 5
  limiter.inc("api_requests", 5);
}
```

#### User-specific counters

```vcl
declare local var.user_id STRING;

# Get user identifier
if (req.http.Authorization) {
  set var.user_id = digest.hash_md5(req.http.Authorization);
} else if (req.http.Cookie:user_id) {
  set var.user_id = req.http.Cookie:user_id;
} else {
  set var.user_id = client.ip;
}

# Increment user-specific counter
limiter.inc("user_" + var.user_id, 1);
```

#### Conditional increments

```vcl
declare local var.is_bot BOOL;

# Determine if request is from a bot (simplified)
set var.is_bot = (
  req.http.User-Agent ~ "(?i)bot|crawler|spider|slurp|baiduspider" ||
  req.http.User-Agent ~ "(?i)googlebot|bingbot|yandex|ahrefsbot|mj12bot"
);

# Increment bot counter if applicable
if (var.is_bot) {
  limiter.inc("bot_requests", 1);
} else {
  limiter.inc("human_requests", 1);
}
```

## Integrated Example: Complete Rate Limiting System

This example demonstrates how multiple rate limiting functions can work together to create a comprehensive rate limiting system.

```vcl
sub vcl_recv {
  # Step 1: Define user identifier
  declare local var.user_id STRING;
  
  # Get user identifier (from auth token, cookie, or IP)
  if (req.http.Authorization) {
    # Extract user ID from Authorization header (simplified)
    set var.user_id = digest.hash_md5(req.http.Authorization);
  } else if (req.http.Cookie:user_id) {
    # Extract user ID from cookie
    set var.user_id = req.http.Cookie:user_id;
  } else {
    # Fall back to client IP
    set var.user_id = client.ip;
  }
  
  # Step 2: Check if user is in any penalty box
  declare local var.in_penalty_box BOOL;
  
  # Check multiple penalty boxes
  set var.in_penalty_box = (
    ratelimit.penaltybox_has("global_penalty", var.user_id) ||
    ratelimit.penaltybox_has("api_penalty", var.user_id) ||
    ratelimit.penaltybox_has("login_penalty", var.user_id)
  );
  
  if (var.in_penalty_box) {
    # User is in a penalty box, return 429 response
    error 429 "Too Many Requests - Please try again later";
  }
  
  # Step 3: Determine request type and corresponding rate limits
  declare local var.is_api_request BOOL;
  declare local var.is_login_request BOOL;
  declare local var.is_static_request BOOL;
  
  set var.is_api_request = (req.url ~ "^/api/");
  set var.is_login_request = (req.url.path == "/login" && req.method == "POST");
  set var.is_static_request = (req.url ~ "\.(jpg|jpeg|png|gif|css|js)$");
  
  # Step 4: Increment appropriate rate counters
  
  # Increment global request counter
  ratelimit.ratecounter_increment("global_" + var.user_id, 1);
  
  # Increment request type specific counters
  if (var.is_api_request) {
    ratelimit.ratecounter_increment("api_" + var.user_id, 1);
  } else if (var.is_login_request) {
    ratelimit.ratecounter_increment("login_" + var.user_id, 1);
  } else if (var.is_static_request) {
    ratelimit.ratecounter_increment("static_" + var.user_id, 1);
  } else {
    ratelimit.ratecounter_increment("other_" + var.user_id, 1);
  }
  
  # Step 5: Check rate limits and apply penalties if exceeded
  
  # Check global rate limits (multi-window)
  declare local var.global_limit_exceeded BOOL;
  set var.global_limit_exceeded = ratelimit.check_rates("global_" + var.user_id, "30:1,300:60,3000:3600");
  
  if (var.global_limit_exceeded) {
    # Add to global penalty box for 5 minutes
    ratelimit.penaltybox_add("global_penalty", var.user_id, 300);
    error 429 "Global Rate Limit Exceeded";
  }
  
  # Check API rate limits
  if (var.is_api_request) {
    declare local var.api_limit_exceeded BOOL;
    set var.api_limit_exceeded = ratelimit.check_rates("api_" + var.user_id, "10:1,100:60,1000:3600");
    
    if (var.api_limit_exceeded) {
      # Add to API penalty box for 2 minutes
      ratelimit.penaltybox_add("api_penalty", var.user_id, 120);
      error 429 "API Rate Limit Exceeded";
    }
  }
  
  # Check login rate limits
  if (var.is_login_request) {
    declare local var.login_limit_exceeded BOOL;
    set var.login_limit_exceeded = ratelimit.check_rates("login_" + var.user_id, "3:60,5:300,10:3600");
    
    if (var.login_limit_exceeded) {
      # Add to login penalty box for 15 minutes
      ratelimit.penaltybox_add("login_penalty", var.user_id, 900);
      error 429 "Login Rate Limit Exceeded";
    }
  }
  
  # Step 6: Set rate limit headers for client information
  
  # Set headers with rate limit information
  set req.http.X-Rate-Limit-Global = "30 per second, 300 per minute, 3000 per hour";
  
  if (var.is_api_request) {
    set req.http.X-Rate-Limit-API = "10 per second, 100 per minute, 1000 per hour";
  } else if (var.is_login_request) {
    set req.http.X-Rate-Limit-Login = "3 per minute, 5 per 5 minutes, 10 per hour";
  }
}
```

## Best Practices for Rate Limiting Functions

1. User Identification:
   - Use a consistent identifier for users (auth token, cookie, IP)
   - Consider the implications of using IP addresses (shared IPs, proxies)
   - Hash sensitive identifiers for privacy

2. Rate Limit Design:
   - Implement multi-window rate limits for comprehensive protection
   - Set different limits for different endpoints based on resource intensity
   - Consider tiered rate limits for different user types

3. Penalty Box Usage:
   - Use penalty boxes for temporary blocking after rate limit violations
   - Implement graduated penalty durations for repeat offenders
   - Check penalty boxes early in the request flow for efficiency

4. Response Handling:
   - Return appropriate status codes (429 Too Many Requests)
   - Include helpful headers (Retry-After, X-Rate-Limit-*)
   - Provide clear error messages to help clients understand limits

5. Counter Naming:
   - Use consistent naming conventions for counters
   - Include user identifiers in counter names for user-specific limits
   - Consider namespace prefixes for different types of rate limits

6. Performance Considerations:
   - Check penalty boxes before incrementing counters
   - Use the most specific rate limit checks first
   - Be mindful of the performance impact of complex rate limiting logic

7. Monitoring and Tuning:
   - Monitor rate limit violations and adjust limits as needed
   - Track penalty box additions to identify potential attacks
   - Regularly review and tune rate limits based on traffic patterns