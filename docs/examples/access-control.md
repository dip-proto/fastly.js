# Access Control with Fastly.JS

Access control is a critical aspect of web application security. With Fastly.JS, you can implement various access control mechanisms at the edge, including:

- IP-based access control
- Geo-location restrictions
- Token-based authentication
- Rate limiting
- User-agent filtering
- Basic authentication

This guide demonstrates how to implement these access control mechanisms using Fastly.JS and VCL.

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
  if (client.ip !~ allowed_ips) {
    # If not, return a 403 Forbidden error
    error 403 "Access Denied";
  }
  
  # Continue processing the request
  return(lookup);
}
```

## Geo-Location Restrictions

> **Note:** Geo-location features (`client.geo.*`) are not yet implemented in Fastly.JS. The examples below show the standard Fastly VCL syntax for reference.

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
  # Check if the request has an API token
  if (!req.http.X-API-Token) {
    error 401 "API token is required";
  }
  
  # Validate the API token (simplified example)
  if (req.http.X-API-Token != "valid-token-123") {
    error 401 "Invalid API token";
  }
  
  # Continue processing the request
  return(lookup);
}
```

## Rate Limiting

Rate limiting prevents abuse by limiting the number of requests a client can make in a given time period:

```vcl
sub vcl_recv {
  # Open a rate counter window with a 60-second duration
  set req.http.X-Window-ID = std.ratelimit.open_window(60);
  
  # Increment a counter for this client IP
  set req.http.X-Counter = std.ratelimit.ratecounter_increment(client.ip, 1);
  
  # Check if the client has exceeded 10 requests per 5 seconds
  if (std.ratelimit.check_rates(client.ip, "10:5,100:60,1000:3600")) {
    # Add the client to a penalty box for 60 seconds
    std.ratelimit.penaltybox_add("rate_violators", client.ip, 60);
    error 429 "Too Many Requests";
  }
  
  # Check if the client is in the penalty box
  if (std.ratelimit.penaltybox_has("rate_violators", client.ip)) {
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
  if (req.http.User-Agent ~ "BadBot|EvilCrawler|Spammer") {
    error 403 "Access Denied";
  }
  
  # Allow only specific user agents
  if (req.http.User-Agent !~ "Mozilla|Chrome|Safari|Edge|Firefox") {
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
  if (!req.http.Authorization) {
    # If not, return a 401 Unauthorized error with a WWW-Authenticate header
    error 401 "Authentication required";
  }
  
  # Validate the Authorization header (simplified example)
  if (req.http.Authorization != "Basic dXNlcm5hbWU6cGFzc3dvcmQ=") {
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

sub vcl_recv {
  # Step 1: IP-based access control for admin area
  if (req.url ~ "^/admin" && client.ip !~ allowed_ips) {
    error 403 "Admin access restricted";
  }
  
  # Step 2: Geo-location restrictions for specific content (requires geo module)
  if (req.url ~ "^/restricted-content" && client.geo.country_code != "US") {
    error 403 "This content is only available in the US";
  }
  
  # Step 3: Rate limiting for API endpoints
  if (req.url ~ "^/api/") {
    # Open a rate counter window with a 60-second duration
    set req.http.X-Window-ID = std.ratelimit.open_window(60);
    
    # Increment a counter for this client IP
    set req.http.X-Counter = std.ratelimit.ratecounter_increment(client.ip, 1);
    
    # Check if the client has exceeded 10 requests per 5 seconds
    if (std.ratelimit.check_rates(client.ip, "10:5,100:60,1000:3600")) {
      error 429 "Too Many Requests";
    }
  }
  
  # Step 4: Token-based authentication for API endpoints
  if (req.url ~ "^/api/" && (!req.http.X-API-Token || req.http.X-API-Token != "valid-token-123")) {
    error 401 "Invalid API token";
  }
  
  # Continue processing the request
  return(lookup);
}

sub vcl_error {
  # Customize error responses
  if (obj.status == 401) {
    set obj.http.Content-Type = "application/json";
    synthetic {"{"error": "Authentication required", "status": 401}"};
    return(deliver);
  }

  if (obj.status == 403) {
    set obj.http.Content-Type = "application/json";
    synthetic {"{"error": "Access denied", "status": 403}"};
    return(deliver);
  }

  if (obj.status == 429) {
    set obj.http.Content-Type = "application/json";
    set obj.http.Retry-After = "60";
    synthetic {"{"error": "Rate limit exceeded", "status": 429, "retry_after": 60}"};
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
