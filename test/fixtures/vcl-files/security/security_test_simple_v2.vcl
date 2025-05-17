vcl 4.0;

# Simple Security Test VCL - Version 2
# This VCL file demonstrates the use of WAF and rate limiting features

# Define ACL for trusted IPs
acl trusted_ips {
  "127.0.0.1";
  "192.168.0.0"/16;
}

# Define backend servers
backend default {
  .host = "neverssl.com";
  .port = "80";
}

# VCL Initialization
sub vcl_init {
  return(ok);
}

# Request processing
sub vcl_recv {
  # Set X-Forwarded-For header
  if (req.http.X-Forwarded-For) {
    set req.http.X-Forwarded-For = req.http.X-Forwarded-For + ", " + client.ip;
  } else {
    set req.http.X-Forwarded-For = client.ip;
  }

  # Check for trusted sources
  if (client.ip ~ trusted_ips) {
    set req.http.X-Trusted = "true";
  }

  # Extract and log query string for debugging
  set req.http.X-Debug-QueryString = req.url.qs;

  # Check for SQL injection in query string
  if (req.url ~ "SELECT|select|UNION|union|INSERT|insert|UPDATE|update|DELETE|delete|DROP|drop") {
    set req.http.X-Attack-Type = "SQL Injection";
    error 403 "Forbidden: Suspicious SQL patterns detected";
  }

  # Check for XSS in query string
  if (req.url ~ "<script|javascript:|onclick|onload|onmouseover|onerror|onfocus|alert|eval") {
    set req.http.X-Attack-Type = "XSS";
    error 403 "Forbidden: Suspicious XSS patterns detected";
  }

  # Check for path traversal in URL
  if (req.url ~ "\.\.\/|%2e%2e%2f|%2e%2e\/|\.\.%2f") {
    set req.http.X-Attack-Type = "Path Traversal";
    error 403 "Forbidden: Path traversal attempt detected";
  }

  # Apply rate limiting for non-trusted IPs
  if (req.http.X-Trusted != "true") {
    # Implement basic rate limiting logic
    if (req.http.User-Agent ~ "bot|crawler|spider") {
      set req.http.X-Bot-Detected = "true";

      # Rate limit bots more aggressively
      if (req.url.path ~ "^/api/") {
        error 429 "Too Many Requests - Bot detected on API endpoint";
      }
    }
  }

  return(lookup);
}

# Response delivery
sub vcl_deliver {
  # Add security headers
  set resp.http.Strict-Transport-Security = "max-age=31536000; includeSubDomains";
  set resp.http.X-Content-Type-Options = "nosniff";
  set resp.http.X-Frame-Options = "DENY";
  set resp.http.X-XSS-Protection = "1; mode=block";
  set resp.http.Content-Security-Policy = "default-src 'self'";

  # Remove debug headers in production
  unset resp.http.X-Debug-QueryString;

  return(deliver);
}

# Error handling
sub vcl_error {
  set obj.http.Content-Type = "text/html; charset=utf-8";

  if (obj.status == 403) {
    set obj.response = "Forbidden";
  } else if (obj.status == 429) {
    set obj.response = "Too Many Requests";
  }

  return(deliver);
}
