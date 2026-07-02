# Rate Limiting Functions

This file demonstrates comprehensive examples of Rate Limiting Functions in VCL.
These functions help implement rate limiting, request throttling, and abuse prevention
at the edge, protecting origin servers from excessive traffic and potential attacks.

The rate limiting functions operate on two kinds of resources that must be
declared at the top level of the VCL, outside of any subroutine:

```vcl
# A rate counter tracks how often entries (such as client IPs) are seen
ratecounter my_counter {}

# A penalty box holds entries that have exceeded a limit, for a period of time
penaltybox my_pb {}
```

The counters and penalty boxes are referenced by identifier, not by string, in
the function calls below.

## ratelimit.ratecounter_increment

Increments an entry in a rate counter by a specified amount.

### Syntax

```vcl
INTEGER ratelimit.ratecounter_increment(RATECOUNTER rc, STRING entry, INTEGER delta)
```

### Parameters

- `rc`: The rate counter to increment (declared with a top-level `ratecounter` block)
- `entry`: The entry to increment within the rate counter (for example a client IP)
- `delta`: The amount to increment the entry by (must be between 0 and 1000)

### Return Value

An estimate of the count for the entry over the trailing 60 seconds

### Examples

#### Basic rate counter increment

```vcl
ratecounter requests_rc {}

sub vcl_recv {
  # Increment the client's entry in the rate counter by 1
  declare local var.count INTEGER;
  set var.count = ratelimit.ratecounter_increment(requests_rc, client.ip, 1);
}
```

#### Incrementing different counters based on request type

```vcl
ratecounter get_rc {}
ratecounter post_rc {}
ratecounter update_rc {}
ratecounter delete_rc {}

sub vcl_recv {
  declare local var.count INTEGER;

  # Track different types of requests separately
  if (req.method == "GET") {
    set var.count = ratelimit.ratecounter_increment(get_rc, client.ip, 1);
  } else if (req.method == "POST") {
    set var.count = ratelimit.ratecounter_increment(post_rc, client.ip, 1);
  } else if (req.method == "PUT" || req.method == "PATCH") {
    set var.count = ratelimit.ratecounter_increment(update_rc, client.ip, 1);
  } else if (req.method == "DELETE") {
    set var.count = ratelimit.ratecounter_increment(delete_rc, client.ip, 1);
  }
}
```

#### Incrementing counters with different weights

```vcl
ratecounter api_rc {}

sub vcl_recv {
  declare local var.count INTEGER;

  # Track API requests with different weights based on resource intensity
  if (req.url ~ "^/api/light/") {
    # Light API requests count as 1
    set var.count = ratelimit.ratecounter_increment(api_rc, client.ip, 1);
  } else if (req.url ~ "^/api/medium/") {
    # Medium API requests count as 2
    set var.count = ratelimit.ratecounter_increment(api_rc, client.ip, 2);
  } else if (req.url ~ "^/api/heavy/") {
    # Heavy API requests count as 5
    set var.count = ratelimit.ratecounter_increment(api_rc, client.ip, 5);
  }
}
```

#### User-specific entries

```vcl
ratecounter user_rc {}

sub vcl_recv {
  declare local var.user_id STRING;
  declare local var.count INTEGER;

  # Get user identifier (from auth token, cookie, or IP)
  if (req.http.Authorization) {
    # Derive an identifier from the Authorization header (simplified)
    set var.user_id = digest.hash_md5(req.http.Authorization);
  } else if (req.http.Cookie:user_id) {
    # Extract user ID from cookie
    set var.user_id = req.http.Cookie:user_id;
  } else {
    # Fall back to client IP
    set var.user_id = client.ip;
  }

  # Increment the user's entry
  set var.count = ratelimit.ratecounter_increment(user_rc, var.user_id, 1);
}
```

#### Reading the observed rates

After incrementing a rate counter, estimated rates and counts for the entry
are exposed through variables named after the rate counter:

```vcl
ratecounter requests_rc {}

sub vcl_recv {
  declare local var.count INTEGER;
  set var.count = ratelimit.ratecounter_increment(requests_rc, client.ip, 1);

  # Estimated rates over trailing windows
  set req.http.X-Rate-1s = ratecounter.requests_rc.rate.1s;
  set req.http.X-Rate-10s = ratecounter.requests_rc.rate.10s;
  set req.http.X-Rate-60s = ratecounter.requests_rc.rate.60s;
}
```

## ratelimit.check_rate

Increments an entry in a rate counter and checks whether it has exceeded the
given rate limit. If the limit is exceeded, the entry is added to the penalty
box for the given TTL. Returns true if the entry is currently in the penalty
box or has just exceeded the limit.

### Syntax

```vcl
BOOL ratelimit.check_rate(STRING entry, RATECOUNTER rc, INTEGER delta, INTEGER window, INTEGER limit, PENALTYBOX pb, RTIME ttl)
```

### Parameters

- `entry`: The entry to track (for example a client IP or user ID)
- `rc`: The rate counter to use
- `delta`: The amount to increment the entry by (must be between 0 and 1000)
- `window`: The trailing window, in seconds, over which the rate is estimated (must be 1, 10, or 60)
- `limit`: The maximum allowed rate, in units per second, over the window
- `pb`: The penalty box the entry is added to when it exceeds the limit
- `ttl`: How long the entry stays in the penalty box (must be between 1m and 60m, rounded to the nearest minute)

### Return Value

- TRUE if the entry is in the penalty box or has exceeded the rate limit
- FALSE otherwise

### Examples

#### Basic rate limiting

```vcl
ratecounter requests_rc {}
penaltybox requests_pb {}

sub vcl_recv {
  declare local var.rate_exceeded BOOL;

  # Limit each client to 100 requests per second, averaged over 10 seconds.
  # Offenders are blocked for 5 minutes.
  set var.rate_exceeded = ratelimit.check_rate(
      client.ip, requests_rc, 1, 10, 100, requests_pb, 5m);

  if (var.rate_exceeded) {
    # Rate limit exceeded, return 429 Too Many Requests
    error 429 "Too Many Requests";
  }
}
```

#### Different rate limits for different request types

```vcl
ratecounter post_rc {}
ratecounter delete_rc {}
penaltybox write_pb {}

sub vcl_recv {
  declare local var.post_rate_exceeded BOOL;
  declare local var.delete_rate_exceeded BOOL;

  # Limit POST requests to 10 per second
  if (req.method == "POST") {
    set var.post_rate_exceeded = ratelimit.check_rate(
        client.ip, post_rc, 1, 10, 10, write_pb, 2m);

    if (var.post_rate_exceeded) {
      error 429 "Too Many POST Requests";
    }
  }

  # Limit DELETE requests to 5 per second
  if (req.method == "DELETE") {
    set var.delete_rate_exceeded = ratelimit.check_rate(
        client.ip, delete_rc, 1, 10, 5, write_pb, 2m);

    if (var.delete_rate_exceeded) {
      error 429 "Too Many DELETE Requests";
    }
  }
}
```

#### User-specific rate limiting

```vcl
ratecounter user_rc {}
penaltybox user_pb {}

sub vcl_recv {
  declare local var.user_id STRING;
  declare local var.user_rate_exceeded BOOL;

  # Get user identifier (from auth token, cookie, or IP)
  if (req.http.Authorization) {
    set var.user_id = digest.hash_md5(req.http.Authorization);
  } else if (req.http.Cookie:user_id) {
    set var.user_id = req.http.Cookie:user_id;
  } else {
    set var.user_id = client.ip;
  }

  # Limit each user to 5 requests per second
  set var.user_rate_exceeded = ratelimit.check_rate(
      var.user_id, user_rc, 1, 10, 5, user_pb, 5m);

  if (var.user_rate_exceeded) {
    error 429 "User Rate Limit Exceeded";
  }
}
```

#### Tiered rate limiting with headers

```vcl
ratecounter tier_rc {}
penaltybox tier_pb {}

sub vcl_recv {
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

  # Check if the tier-specific rate is exceeded
  set var.tier_rate_exceeded = ratelimit.check_rate(
      var.tier + "_" + client.ip, tier_rc, 1, 10, var.tier_limit, tier_pb, 5m);

  if (var.tier_rate_exceeded) {
    error 429 "Tier Rate Limit Exceeded";
  }
}
```

## ratelimit.check_rates

Like `ratelimit.check_rate`, but checks two rate limits at once, typically a
burst limit over a short window and a sustained limit over a longer window.
Both rate counters are incremented; if either limit is exceeded, the entry is
added to the penalty box.

### Syntax

```vcl
BOOL ratelimit.check_rates(STRING entry, RATECOUNTER rc1, INTEGER delta1, INTEGER window1, INTEGER limit1, RATECOUNTER rc2, INTEGER delta2, INTEGER window2, INTEGER limit2, PENALTYBOX pb, RTIME ttl)
```

### Parameters

- `entry`: The entry to track
- `rc1`: The first rate counter
- `delta1`: Increment for the first counter (0 to 1000)
- `window1`: Window in seconds for the first check (1, 10, or 60)
- `limit1`: Maximum rate per second over `window1`
- `rc2`: The second rate counter
- `delta2`: Increment for the second counter (0 to 1000)
- `window2`: Window in seconds for the second check (1, 10, or 60)
- `limit2`: Maximum rate per second over `window2`
- `pb`: The penalty box the entry is added to when it exceeds either limit
- `ttl`: How long the entry stays in the penalty box (1m to 60m)

### Return Value

- TRUE if the entry is in the penalty box or has exceeded either rate limit
- FALSE otherwise

### Examples

#### Burst and sustained rate limiting

```vcl
ratecounter burst_rc {}
ratecounter sustained_rc {}
penaltybox requests_pb {}

sub vcl_recv {
  declare local var.rates_exceeded BOOL;

  # Allow bursts of up to 50 requests per second over 1 second,
  # but no more than 10 requests per second sustained over 60 seconds
  set var.rates_exceeded = ratelimit.check_rates(
      client.ip,
      burst_rc, 1, 1, 50,
      sustained_rc, 1, 60, 10,
      requests_pb, 10m);

  if (var.rates_exceeded) {
    error 429 "Rate Limit Exceeded";
  }
}
```

#### User-specific burst and sustained limits

```vcl
ratecounter user_burst_rc {}
ratecounter user_sustained_rc {}
penaltybox user_pb {}

sub vcl_recv {
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

  # Allow bursts of 20/s but only 5/s sustained
  set var.user_rates_exceeded = ratelimit.check_rates(
      var.user_id,
      user_burst_rc, 1, 1, 20,
      user_sustained_rc, 1, 60, 5,
      user_pb, 5m);

  if (var.user_rates_exceeded) {
    error 429 "User Rate Limit Exceeded";
  }
}
```

#### Different limits for different endpoints

```vcl
ratecounter api_burst_rc {}
ratecounter api_sustained_rc {}
penaltybox api_pb {}

sub vcl_recv {
  declare local var.endpoint_rates_exceeded BOOL;

  # Check endpoint-specific rate limits
  if (req.url.path ~ "^/api/users") {
    set var.endpoint_rates_exceeded = ratelimit.check_rates(
        client.ip,
        api_burst_rc, 1, 1, 10,
        api_sustained_rc, 1, 60, 2,
        api_pb, 5m);
  } else if (req.url.path ~ "^/api/") {
    set var.endpoint_rates_exceeded = ratelimit.check_rates(
        client.ip,
        api_burst_rc, 1, 1, 20,
        api_sustained_rc, 1, 60, 5,
        api_pb, 5m);
  }

  if (var.endpoint_rates_exceeded) {
    error 429 "API Endpoint Rate Limit Exceeded";
  }
}
```

## ratelimit.penaltybox_add

Adds an entry to a penalty box for a specified duration.

### Syntax

```vcl
VOID ratelimit.penaltybox_add(PENALTYBOX pb, STRING entry, RTIME ttl)
```

### Parameters

- `pb`: The penalty box (declared with a top-level `penaltybox` block)
- `entry`: The entry to add to the penalty box
- `ttl`: How long the entry stays in the penalty box (must be between 1m and
  60m, rounded to the nearest minute)

### Return Value

None

### Examples

#### Basic penalty box usage

```vcl
ratecounter user_rc {}
penaltybox user_pb {}

sub vcl_recv {
  declare local var.user_id STRING;
  declare local var.count INTEGER;

  # Get user identifier
  if (req.http.Authorization) {
    set var.user_id = digest.hash_md5(req.http.Authorization);
  } else if (req.http.Cookie:user_id) {
    set var.user_id = req.http.Cookie:user_id;
  } else {
    set var.user_id = client.ip;
  }

  # Track the user's request count and apply a manual limit
  set var.count = ratelimit.ratecounter_increment(user_rc, var.user_id, 1);

  if (ratecounter.user_rc.rate.10s > 10) {
    # Add user to penalty box for 5 minutes
    ratelimit.penaltybox_add(user_pb, var.user_id, 5m);

    error 429 "Rate Limit Exceeded - Please try again later";
  }
}
```

#### IP-based penalty box for suspicious activity

```vcl
penaltybox suspicious_pb {}

sub vcl_recv {
  declare local var.is_suspicious BOOL;

  # Determine if request is suspicious (simplified example)
  set var.is_suspicious = (
    !req.http.User-Agent ||
    req.url ~ "\.(php|asp|aspx|jsp)\.js$" ||
    req.url ~ "select.*from" ||
    req.url ~ "union.*select" ||
    req.url ~ "insert.*into"
  );

  if (var.is_suspicious) {
    # Add IP to penalty box for 1 hour
    ratelimit.penaltybox_add(suspicious_pb, client.ip, 60m);

    error 403 "Forbidden";
  }
}
```

#### Graduated penalty box durations

```vcl
penaltybox graduated_pb {}

sub vcl_recv {
  declare local var.violation_count INTEGER;

  # Get violation count from a header (in a real scenario, this would come
  # from a database or edge dictionary)
  set var.violation_count = std.atoi(req.http.X-Violation-Count);

  # Set penalty duration based on violation count. Note that penalty box
  # TTLs are limited to a range of 1 minute to 1 hour.
  if (var.violation_count == 1) {
    # First violation: 5 minutes
    ratelimit.penaltybox_add(graduated_pb, client.ip, 5m);
  } else if (var.violation_count == 2) {
    # Second violation: 30 minutes
    ratelimit.penaltybox_add(graduated_pb, client.ip, 30m);
  } else if (var.violation_count >= 3) {
    # Three or more violations: the maximum of 1 hour
    ratelimit.penaltybox_add(graduated_pb, client.ip, 60m);
  }

  if (var.violation_count > 0) {
    error 429 "Rate Limit Exceeded - Please try again later";
  }
}
```

#### Different penalty boxes for different violations

```vcl
ratecounter api_rc {}
ratecounter login_rc {}
penaltybox api_pb {}
penaltybox login_pb {}

sub vcl_recv {
  # Check for API abuse: 20 requests per second, blocked for 10 minutes
  if (req.url ~ "^/api/") {
    if (ratelimit.check_rate(client.ip, api_rc, 1, 10, 20, api_pb, 10m)) {
      error 429 "API Rate Limit Exceeded";
    }
  }

  # Check for login abuse: 5 attempts per second, blocked for 15 minutes
  if (req.url.path == "/login" && req.method == "POST") {
    if (ratelimit.check_rate(client.ip, login_rc, 1, 1, 5, login_pb, 15m)) {
      error 429 "Too Many Login Attempts";
    }
  }
}
```

## ratelimit.penaltybox_has

Checks if an entry is in a penalty box.

### Syntax

```vcl
BOOL ratelimit.penaltybox_has(PENALTYBOX pb, STRING entry)
```

### Parameters

- `pb`: The penalty box to check
- `entry`: The entry to check for

### Return Value

- TRUE if the entry is in the penalty box
- FALSE otherwise

### Examples

#### Basic penalty box check

```vcl
penaltybox user_pb {}

sub vcl_recv {
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
  set var.in_penalty_box = ratelimit.penaltybox_has(user_pb, var.user_id);

  if (var.in_penalty_box) {
    error 429 "Too Many Requests - Please try again later";
  }
}
```

#### IP-based penalty box check for suspicious activity

```vcl
penaltybox suspicious_pb {}

sub vcl_recv {
  declare local var.ip_blocked BOOL;

  # Check if IP is in suspicious IPs penalty box
  set var.ip_blocked = ratelimit.penaltybox_has(suspicious_pb, client.ip);

  if (var.ip_blocked) {
    error 403 "Forbidden";
  }
}
```

#### Checking multiple penalty boxes

```vcl
penaltybox user_pb {}
penaltybox api_pb {}
penaltybox login_pb {}
penaltybox scraping_pb {}

sub vcl_recv {
  declare local var.in_any_penalty_box BOOL;

  # Check if user is in any penalty box
  set var.in_any_penalty_box = (
    ratelimit.penaltybox_has(user_pb, req.http.X-User-ID) ||
    ratelimit.penaltybox_has(api_pb, req.http.X-User-ID) ||
    ratelimit.penaltybox_has(login_pb, client.ip) ||
    ratelimit.penaltybox_has(scraping_pb, client.ip)
  );

  if (var.in_any_penalty_box) {
    error 429 "Access Temporarily Restricted";
  }
}
```

#### Different handling based on penalty box type

```vcl
penaltybox api_pb {}
penaltybox login_pb {}

sub vcl_recv {
  declare local var.in_api_penalty BOOL;
  declare local var.in_login_penalty BOOL;

  # Check specific penalty boxes
  set var.in_api_penalty = ratelimit.penaltybox_has(api_pb, req.http.X-User-ID);
  set var.in_login_penalty = ratelimit.penaltybox_has(login_pb, client.ip);

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
}
```

## Integrated Example: Complete Rate Limiting System

This example demonstrates how multiple rate limiting functions can work together to create a comprehensive rate limiting system.

```vcl
ratecounter global_burst_rc {}
ratecounter global_sustained_rc {}
ratecounter api_rc {}
ratecounter login_rc {}
penaltybox global_pb {}
penaltybox api_pb {}
penaltybox login_pb {}

sub vcl_recv {
  # Step 1: Define user identifier
  declare local var.user_id STRING;

  # Get user identifier (from auth token, cookie, or IP)
  if (req.http.Authorization) {
    # Derive an identifier from the Authorization header (simplified)
    set var.user_id = digest.hash_md5(req.http.Authorization);
  } else if (req.http.Cookie:user_id) {
    # Extract user ID from cookie
    set var.user_id = req.http.Cookie:user_id;
  } else {
    # Fall back to client IP
    set var.user_id = client.ip;
  }

  # Step 2: Check if user is in any penalty box before doing more work
  declare local var.in_penalty_box BOOL;

  set var.in_penalty_box = (
    ratelimit.penaltybox_has(global_pb, var.user_id) ||
    ratelimit.penaltybox_has(api_pb, var.user_id) ||
    ratelimit.penaltybox_has(login_pb, var.user_id)
  );

  if (var.in_penalty_box) {
    # User is in a penalty box, return 429 response
    error 429 "Too Many Requests - Please try again later";
  }

  # Step 3: Determine request type
  declare local var.is_api_request BOOL;
  declare local var.is_login_request BOOL;

  set var.is_api_request = (req.url ~ "^/api/");
  set var.is_login_request = (req.url.path == "/login" && req.method == "POST");

  # Step 4: Check global rate limits (burst and sustained)
  declare local var.global_limit_exceeded BOOL;
  set var.global_limit_exceeded = ratelimit.check_rates(
      var.user_id,
      global_burst_rc, 1, 1, 30,
      global_sustained_rc, 1, 60, 5,
      global_pb, 5m);

  if (var.global_limit_exceeded) {
    error 429 "Global Rate Limit Exceeded";
  }

  # Step 5: Check request type specific limits

  # API requests: 10 per second averaged over 10 seconds, 2 minute penalty
  if (var.is_api_request) {
    declare local var.api_limit_exceeded BOOL;
    set var.api_limit_exceeded = ratelimit.check_rate(
        var.user_id, api_rc, 1, 10, 10, api_pb, 2m);

    if (var.api_limit_exceeded) {
      error 429 "API Rate Limit Exceeded";
    }
  }

  # Login attempts: 1 per second averaged over 60 seconds, 15 minute penalty
  if (var.is_login_request) {
    declare local var.login_limit_exceeded BOOL;
    set var.login_limit_exceeded = ratelimit.check_rate(
        var.user_id, login_rc, 1, 60, 1, login_pb, 15m);

    if (var.login_limit_exceeded) {
      error 429 "Login Rate Limit Exceeded";
    }
  }

  # Step 6: Set rate limit headers for client information
  set req.http.X-Rate-Limit-Global = "30 per second burst, 5 per second sustained";

  if (var.is_api_request) {
    set req.http.X-Rate-Limit-API = "10 per second";
  } else if (var.is_login_request) {
    set req.http.X-Rate-Limit-Login = "1 per second";
  }
}
```

## Best Practices for Rate Limiting Functions

1. User Identification:
   - Use a consistent identifier for users (auth token, cookie, IP)
   - Consider the implications of using IP addresses (shared IPs, proxies)
   - Hash sensitive identifiers for privacy

2. Rate Limit Design:
   - Use ratelimit.check_rates to combine a burst limit (1 second window)
     with a sustained limit (60 second window)
   - Remember that windows are limited to 1, 10, or 60 seconds, and limits
     are expressed in units per second over that window
   - Set different limits for different endpoints based on resource intensity
   - Consider tiered rate limits for different user types

3. Penalty Box Usage:
   - Use penalty boxes for temporary blocking after rate limit violations
   - Penalty box TTLs must be between 1 minute and 1 hour
   - Check penalty boxes early in the request flow for efficiency

4. Response Handling:
   - Return appropriate status codes (429 Too Many Requests)
   - Include helpful headers (Retry-After, X-Rate-Limit-*)
   - Provide clear error messages to help clients understand limits

5. Resource Naming:
   - Declare rate counters and penalty boxes at the top level with
     descriptive names
   - Use separate rate counters and penalty boxes for different types of
     limits so they can be tuned independently

6. Performance Considerations:
   - Rate counters are probabilistic: counts and rates are estimates
   - Check penalty boxes before incrementing counters
   - Be mindful of the performance impact of complex rate limiting logic

7. Monitoring and Tuning:
   - Monitor rate limit violations and adjust limits as needed
   - Track penalty box additions to identify potential attacks
   - Regularly review and tune rate limits based on traffic patterns
