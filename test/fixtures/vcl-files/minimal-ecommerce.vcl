# Minimal e-commerce VCL configuration

# Backend definitions
backend origin_api {
  .host = "api.example.com";
  .port = "443";
  .ssl = true;
}

backend origin_static {
  .host = "static.example.com";
  .port = "443";
  .ssl = true;
}

# ACLs
acl internal {
  "127.0.0.1";
  "192.168.0.0"/16;
}

# Main VCL logic
sub vcl_recv {
  # Set a unique request ID
  if (!req.http.X-Request-ID) {
    set req.http.X-Request-ID = "12345";
  }

  # Route requests based on URL path
  if (req.url == "/api/products") {
    # API requests
    set req.backend = "origin_api";

    # Check for API key
    if (!req.http.X-API-Key) {
      error 401 "API Key Required";
      return(error);
    }

    # Check for rate limiting
    if (client.ip ~ internal) {
      if (req.http.X-Rate-Limit) {
      # Rate limit exceeded
      if (req.url ~ "^/api/") {
        error 429 "Too Many Requests";
        return(error);
      }
      }
    }

    return(pass);
  }
  else if (req.url == "/static/css/style.css") {
    # Static content
    set req.backend = "origin_static";

    # Cache static content
    if (req.method == "GET") {
      return(lookup);
    } else {
      return(pass);
    }
  }
  else {
    # Default to API backend
    set req.backend = "origin_api";

    # Handle homepage A/B testing
    if (req.url == "/") {
      # Set A/B test variant
      if (req.http.Cookie) {
        # Use existing cookie value
        if (req.http.Cookie ~ "ab_test=A") {
          set req.http.X-AB-Test = "A";
        } else {
          set req.http.X-AB-Test = "B";
        }
      } else {
        # Randomly assign variant (using client IP as a simple randomizer)
        if (client.ip == "127.0.0.1") {
          set req.http.X-AB-Test = "A";
        } else {
          set req.http.X-AB-Test = "B";
        }
      }

      # Enable ESI for homepage
      set req.http.X-Enable-ESI = "true";
    }

    # Standard caching behavior
    if (req.method == "GET") {
      return(lookup);
    } else {
      return(pass);
    }
  }
}

sub vcl_hash {
  # Default hash based on URL and host
  hash_data(req.url);

  if (req.http.host) {
    hash_data(req.http.host);
  }

  return(hash);
}

sub vcl_fetch {
  # Set appropriate cache TTLs based on content type
  if (req.url == "/static/css/style.css") {
    # Cache static assets for 24 hours
    set beresp.ttl = 24h;
    set beresp.grace = 12h;
  }
  else if (req.url == "/") {
    # Cache homepage for 5 minutes
    set beresp.ttl = 5m;
    set beresp.grace = 30m;
  }
  else {
    # Default cache time for other content
    set beresp.ttl = 2m;
    set beresp.grace = 30m;
  }

  return(deliver);
}

sub vcl_deliver {
  # Add security headers
  set resp.http.X-Content-Type-Options = "nosniff";
  set resp.http.X-Frame-Options = "SAMEORIGIN";
  set resp.http.X-XSS-Protection = "1; mode=block";
  set resp.http.Content-Security-Policy = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';";

  # Set A/B test cookie if needed
  if (req.http.X-AB-Test) {
    add resp.http.Set-Cookie = "ab_test=" + req.http.X-AB-Test + "; path=/; max-age=3600";
  }

  return(deliver);
}

sub vcl_error {
  # Custom error pages
  set obj.http.Content-Type = "text/html; charset=utf-8";

  if (obj.status == 401) {
    set obj.response = "Unauthorized";
    synthetic {"
<!DOCTYPE html>
<html>
  <head><title>API Key Required</title></head>
  <body>
    <h1>API Key Required</h1>
    <p>Please provide a valid API key in the X-API-Key header.</p>
  </body>
</html>
    "};
  } else if (obj.status == 429) {
    set obj.response = "Too Many Requests";
    set obj.http.Retry-After = "60";
    synthetic {"
<!DOCTYPE html>
<html>
  <head><title>Too Many Requests</title></head>
  <body>
    <h1>Too Many Requests</h1>
    <p>You have exceeded the rate limit. Please try again later.</p>
  </body>
</html>
    "};
  }

  return(deliver);
}
