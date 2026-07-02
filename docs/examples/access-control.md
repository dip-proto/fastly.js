# Access Control with Fastly.JS

Access control is a critical aspect of web application security. With Fastly.JS, you can implement various access control mechanisms at the edge, including:

- IP-based access control
- Geo-location restrictions
- Token-based authentication
- Rate limiting
- User-agent filtering
- Basic authentication

This guide demonstrates how to implement these access control mechanisms using Fastly.JS and VCL.

> **Note:** Two implementation details matter throughout this guide. First, ACL matching is currently only supported in the form `if (client.ip ~ acl_name)` — the negated `!~` form does not work, so the deny case goes in an `else` branch. Second, the bundled proxy in `index.ts` does not yet populate the client address, so `client.ip` always reads `127.0.0.1` there; ACL rules are still fully testable through the test framework.

## IP-Based Access Control

One of the simplest forms of access control is restricting access based on IP addresses. Here's an example that allows access only from specific IP addresses:

```vcl
# Define an Access Control List (ACL) for allowed IPs
acl allowed_ips {
  "192.168.1.0"/24;  # Allow an entire subnet
  "10.0.0.1";        # Allow a specific IP
  "2001:db8::/32";   # Allow an IPv6 subnet
}

sub vcl_recv {
  # Check if the client IP is in the allowed list
  if (client.ip ~ allowed_ips) {
    # Continue processing the request
    return(lookup);
  }
  
  # If not, return a 403 Forbidden error
  error 403 "Access Denied";
}
```

## Geo-Location Restrictions

> **Note:** The `client.geo.*` variables exist in Fastly.JS but there is no geolocation database behind them: string fields read `"unknown"` and the coordinates point at Fastly's San Francisco headquarters. Rules based on them therefore won't behave meaningfully when run locally — a check like `client.geo.country_code != "US"` matches every request. The examples below show the standard Fastly VCL syntax for reference.

You can restrict access based on the geographic location of the client:

```vcl
sub vcl_recv {
  # Block access from specific countries
  if (client.geo.country_code == "RU" || client.geo.country_code == "CN") {
    error 403 "Access from your country is not allowed";
  }
  
  # Allow access only from specific countries
  if (client.geo.country_code != "US" && client.geo.country_code != "CA") {
    error 403 "Access is only allowed from the US and Canada";
  }
  
  # Continue processing the request
  return(lookup);
}
```

## Token-Based Authentication

Token-based authentication involves validating a token provided in the request:

```vcl
sub vcl_recv {
  # Check if the request has an API token (client-sent header names
  # are stored lowercase)
  if (!req.http.x-api-token) {
    error 401 "API token is required";
  }
  
  # Validate the API token (simplified example)
  if (req.http.x-api-token != "valid-token-123") {
    error 401 "Invalid API token";
  }
  
  # Continue processing the request
  return(lookup);
}
```

## Rate Limiting

Rate limiting prevents abuse by limiting the number of requests a client can make in a given time period:

```vcl
# Declare the rate counter and penalty box this VCL uses
ratecounter requests {}
penaltybox rate_violators {}

sub vcl_recv {
  # Count this request and check the rate in one call: increment the "requests"
  # counter by 1 over a 60-second window, and once the client passes 100 requests
  # in that window, drop them into the "rate_violators" penalty box for 300
  # seconds. check_rate returns true the moment the threshold is crossed.
  if (ratelimit.check_rate(client.ip, requests, 100, 60, 1, rate_violators, 300s)) {
    error 429 "Too Many Requests";
  }
  
  # Reject anyone already serving time in the penalty box
  if (ratelimit.penaltybox_has(rate_violators, client.ip)) {
    error 429 "Too Many Requests";
  }
  
  # Continue processing the request
  return(lookup);
}
```

## User-Agent Filtering

You can filter requests based on the User-Agent header:

```vcl
sub vcl_recv {
  # Block requests from specific user agents
  # (incoming request headers are stored lowercase, and header
  # lookups are case-sensitive)
  if (req.http.user-agent ~ "BadBot|EvilCrawler|Spammer") {
    error 403 "Access Denied";
  }
  
  # Allow only specific user agents
  if (req.http.user-agent !~ "Mozilla|Chrome|Safari|Edge|Firefox") {
    error 403 "Unsupported browser";
  }
  
  # Continue processing the request
  return(lookup);
}
```

## Basic Authentication

Basic authentication requires users to provide a username and password:

```vcl
sub vcl_recv {
  # Check if the request has an Authorization header
  if (!req.http.authorization) {
    # If not, return a 401 Unauthorized error with a WWW-Authenticate header
    error 401 "Authentication required";
  }
  
  # Validate the Authorization header (simplified example)
  if (req.http.authorization != "Basic dXNlcm5hbWU6cGFzc3dvcmQ=") {
    error 401 "Invalid credentials";
  }
  
  # Continue processing the request
  return(lookup);
}

sub vcl_error {
  # Add WWW-Authenticate header for 401 responses
  if (obj.status == 401) {
    set obj.http.WWW-Authenticate = "Basic realm=\"Restricted Area\"";
  }
  
  return(deliver);
}
```

## Combining Access Control Mechanisms

You can combine multiple access control mechanisms for enhanced security:

```vcl
# Define an Access Control List (ACL) for allowed IPs
acl allowed_ips {
  "192.168.1.0"/24;
  "10.0.0.1";
}

# Rate counter and penalty box for the API rate limit
ratecounter api_requests {}
penaltybox api_violators {}

sub vcl_recv {
  # Step 1: IP-based access control for admin area. ACL matching only
  # works in the "client.ip ~ acl" form, so the deny case goes in the
  # else branch.
  if (req.url ~ "^/admin") {
    if (client.ip ~ allowed_ips) {
      # Internal address, let it through
    } else {
      error 403 "Admin access restricted";
    }
  }
  
  # Step 2: Rate limiting for API endpoints (100 requests per 60 seconds)
  if (req.url ~ "^/api/") {
    if (ratelimit.check_rate(client.ip, api_requests, 100, 60, 1, api_violators, 300s)) {
      error 429 "Too Many Requests";
    }
  }
  
  # Step 3: Token-based authentication for API endpoints
  if (req.url ~ "^/api/" && (!req.http.x-api-token || req.http.x-api-token != "valid-token-123")) {
    error 401 "Invalid API token";
  }
  
  # Continue processing the request
  return(lookup);
}

sub vcl_error {
  # Customize error responses. The synthetic statement resets
  # Content-Type to text/html, so set the JSON Content-Type afterwards.
  if (obj.status == 401) {
    synthetic {"{"error": "Authentication required", "status": 401}"};
    set obj.http.Content-Type = "application/json";
    return(deliver);
  }

  if (obj.status == 403) {
    synthetic {"{"error": "Access denied", "status": 403}"};
    set obj.http.Content-Type = "application/json";
    return(deliver);
  }

  if (obj.status == 429) {
    set obj.http.Retry-After = "60";
    synthetic {"{"error": "Rate limit exceeded", "status": 429, "retry_after": 60}"};
    set obj.http.Content-Type = "application/json";
    return(deliver);
  }

  return(deliver);
}
```

## Running the Example

Save the above VCL to a file named `access-control.vcl` and run it with Fastly.JS:

```bash
bun run index.ts access-control.vcl
```

This will start a local HTTP proxy server that applies the access control rules to all requests.

## Conclusion

Access control is a critical aspect of web application security. With Fastly.JS, you can test and develop access control mechanisms locally before deploying them to your production Fastly service.

For more information on the VCL functions used in this example, see the [VCL Functions Reference](../reference/vcl-functions.md).
