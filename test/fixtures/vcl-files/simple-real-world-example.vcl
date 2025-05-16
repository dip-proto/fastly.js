# Simple Real-world VCL Example
# This file demonstrates a simplified real-world VCL configuration

# Backend definitions
backend origin_api {
  .host = "api.example.com";
  .port = "443";
  .ssl = true;
  .connect_timeout = 1s;
  .first_byte_timeout = 5s;
  .between_bytes_timeout = 2s;
  .max_connections = 200;
}

backend origin_static {
  .host = "static.example.com";
  .port = "443";
  .ssl = true;
  .connect_timeout = 1s;
  .first_byte_timeout = 10s;
  .between_bytes_timeout = 5s;
  .max_connections = 300;
}

# ACL for internal IPs
acl internal {
  "127.0.0.1";
  "192.168.0.0"/16;
  "10.0.0.0"/8;
}

# Table for feature flags
table feature_flags {
  "new_homepage": "true",
  "beta_api": "false",
  "maintenance_mode": "false",
  "rate_limit_threshold": "100"
}

# Main VCL logic
sub vcl_recv {
  # Set X-Request-ID for tracking
  set req.http.X-Request-ID = "12345678-1234-1234-1234-123456789012";

  # Route to appropriate backend
  if (req.url ~ "^/api/") {
    set req.backend = origin_api;

    # Normalize API URL
    set req.url = std.tolower(req.url);

    # Pass API requests (don't cache)
    return(pass);
  }
  else if (req.url ~ "^/static/") {
    set req.backend = origin_static;

    # Normalize static URL
    set req.url = std.tolower(req.url);

    # Look up in cache
    return(lookup);
  }
  else {
    # Default to API backend for other requests
    set req.backend = origin_api;

    # Handle homepage A/B testing
    if (req.url == "/" || req.url == "/index.html") {
      # Randomly assign users to A or B variant
      if (!req.http.X-Homepage-Variant) {
        set req.http.X-Homepage-Variant = "A";
      }

      # Add the variant to the cache key
      set req.http.Fastly-Cache-Key = req.http.X-Homepage-Variant;
    }

    # Look up in cache
    return(lookup);
  }
}

sub vcl_hash {
  # Default hash
  hash_data(req.url);

  # Include host in cache key
  if (req.http.host) {
    hash_data(req.http.host);
  }

  # Include homepage variant in cache key if present
  if (req.http.X-Homepage-Variant) {
    hash_data(req.http.X-Homepage-Variant);
  }

  return(hash);
}

sub vcl_fetch {
  # Set appropriate cache TTL based on content type
  if (req.url ~ "^/static/") {
    # Cache static assets for 24 hours
    set beresp.ttl = 24h;
    set beresp.grace = 1h;
    set beresp.stale_while_revalidate = 1h;
  }
  else if (req.url ~ "^/api/") {
    # Don't cache API responses
    set beresp.ttl = 0s;
  }
  else {
    # Cache other content for 5 minutes
    set beresp.ttl = 5m;
    set beresp.grace = 1m;
    set beresp.stale_while_revalidate = 1m;
  }

  # Enable ESI processing for HTML content
  if (beresp.http.Content-Type ~ "text/html") {
    set beresp.do_esi = true;
  }

  return(deliver);
}

sub vcl_deliver {
  # Add debug headers for internal users
  if (client.ip ~ internal) {
    set resp.http.X-Cache-Status = fastly.state;
    set resp.http.X-Request-ID = req.http.X-Request-ID;

    if (req.http.X-Homepage-Variant) {
      set resp.http.X-Homepage-Variant = req.http.X-Homepage-Variant;
    }
  } else {
    # Remove sensitive headers for external users
    unset resp.http.Server;
    unset resp.http.X-Powered-By;
    unset resp.http.X-Varnish;
    unset resp.http.Via;
  }

  # Add security headers
  set resp.http.X-Content-Type-Options = "nosniff";
  set resp.http.X-Frame-Options = "SAMEORIGIN";
  set resp.http.X-XSS-Protection = "1; mode=block";
  set resp.http.Content-Security-Policy = "default-src 'self'; script-src 'self' https://cdn.example.com;";

  return(deliver);
}

sub vcl_error {
  # Set content type
  set obj.http.Content-Type = "text/html; charset=utf-8";

  # Generic error page
  synthetic {"
    <!DOCTYPE html>
    <html>
      <head>
        <title>Error</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 50px; text-align: center; }
          h1 { color: #c00; }
        </style>
      </head>
      <body>
        <h1>Error</h1>
        <p>An error occurred.</p>
        <p>Reference: "} + req.http.X-Request-ID + {"</p>
      </body>
    </html>
  "};

  return(deliver);
}
