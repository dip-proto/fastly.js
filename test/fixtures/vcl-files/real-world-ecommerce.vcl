# Real-world e-commerce VCL configuration

# Backend definitions
backend origin_api {
  .host = "api.example.com";
  .port = "443";
  .ssl = true;
  .connect_timeout = 1s;
  .first_byte_timeout = 15s;
  .between_bytes_timeout = 10s;
  .max_connections = 200;
}

backend origin_static {
  .host = "static.example.com";
  .port = "443";
  .ssl = true;
  .connect_timeout = 1s;
  .first_byte_timeout = 15s;
  .between_bytes_timeout = 10s;
  .max_connections = 300;
}

backend origin_cms {
  .host = "cms.example.com";
  .port = "443";
  .ssl = true;
  .connect_timeout = 1s;
  .first_byte_timeout = 20s;
  .between_bytes_timeout = 10s;
  .max_connections = 100;
}

# Director for API load balancing
director api_director random {
  { .backend = origin_api; .weight = 100; }
}

# ACLs
acl internal {
  "127.0.0.1";
  "192.168.0.0"/16;
  "10.0.0.0"/8;
}

acl purgers {
  "127.0.0.1";
  "192.168.0.0"/24;
}

# VCL Tables
table feature_flags {
  "new_homepage": "true",
  "beta_api": "false",
  "maintenance_mode": "false",
  "rate_limit_threshold": "100"
}

table geo_restrictions {
  "US": "allowed",
  "CA": "allowed",
  "GB": "allowed",
  "DE": "allowed",
  "FR": "allowed",
  "default": "blocked"
}

# Main VCL logic
sub vcl_recv {
  # Set a unique request ID
  if (!req.http.X-Request-ID) {
    set req.http.X-Request-ID = uuid.version4();
  }

  # Check for maintenance mode
  if (table.lookup(feature_flags, "maintenance_mode") == "true" && !client.ip ~ internal) {
    error 503 "Site under maintenance";
  }

  # Route requests based on URL path
  if (req.url ~ "^/api/") {
    # API requests
    set req.backend = api_director;
    
    # Rate limiting for API
    if (!std.ratelimit.check_rates(client.ip, "100:60,1000:3600")) {
      error 429 "Too Many Requests";
    }
    
    # Check for API key
    if (!req.http.X-API-Key) {
      error 401 "API Key Required";
    }
    
    return(pass);
  } 
  else if (req.url ~ "^/static/") {
    # Static content
    set req.backend = origin_static;
    
    # Cache static content
    if (req.method == "GET" || req.method == "HEAD") {
      return(lookup);
    } else {
      return(pass);
    }
  }
  else if (req.url ~ "^/cms/") {
    # CMS content
    set req.backend = origin_cms;
    
    # Only allow internal access to CMS
    if (!client.ip ~ internal) {
      error 403 "Forbidden";
    }
    
    return(pass);
  }
  else {
    # Default to API backend
    set req.backend = origin_api;
    
    # Handle purge requests
    if (req.method == "PURGE") {
      if (!client.ip ~ purgers) {
        error 403 "Forbidden";
      }
      return(lookup);
    }
    
    # A/B testing for homepage
    if (req.url == "/" || req.url == "/index.html") {
      # Use consistent A/B testing based on cookie or IP
      if (req.http.Cookie ~ "ab_test=") {
        # Keep existing test group
      } else {
        # Assign new test group
        if (std.random.randombool(0.5)) {
          set req.http.X-AB-Test = "A";
        } else {
          set req.http.X-AB-Test = "B";
        }
        
        # Set cookie for consistent experience
        add req.http.Cookie = "ab_test=" + req.http.X-AB-Test + "; path=/;";
      }
    }
    
    # Enable ESI for HTML content
    if (req.url ~ "\.html$" || req.url == "/" || req.url ~ "^/products/") {
      set req.http.X-Enable-ESI = "true";
    }
    
    # Standard caching behavior
    if (req.method == "GET" || req.method == "HEAD") {
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
  
  # Include A/B test variant in cache key
  if (req.http.X-AB-Test) {
    hash_data(req.http.X-AB-Test);
  }
  
  # Include user's country for geo-specific content
  if (client.geo.country_code) {
    hash_data(client.geo.country_code);
  }
  
  return(hash);
}

sub vcl_fetch {
  # Set appropriate cache TTLs based on content type
  if (req.url ~ "^/static/") {
    # Cache static assets for 24 hours
    if (req.url ~ "\.(jpg|jpeg|png|gif|ico|css|js)$") {
      set beresp.ttl = 24h;
      set beresp.grace = 12h;
      set beresp.stale_while_revalidate = 1h;
    } else {
      set beresp.ttl = 1h;
    }
  } 
  else if (req.url ~ "^/api/") {
    # Don't cache API responses by default
    set beresp.ttl = 0s;
    
    # But cache read-only API endpoints
    if (req.url ~ "^/api/products" && req.method == "GET") {
      set beresp.ttl = 5m;
      set beresp.grace = 1h;
      set beresp.stale_while_revalidate = 10m;
    }
  }
  else if (req.url == "/" || req.url == "/index.html") {
    # Cache homepage for 5 minutes
    set beresp.ttl = 5m;
    set beresp.grace = 1h;
    set beresp.stale_while_revalidate = 10m;
  }
  else {
    # Default cache time for other content
    set beresp.ttl = 2m;
    set beresp.grace = 30m;
  }
  
  # Enable ESI processing if requested
  if (req.http.X-Enable-ESI == "true" && beresp.http.Content-Type ~ "text/html") {
    set beresp.do_esi = true;
  }
  
  # Add debugging headers for internal users
  if (client.ip ~ internal) {
    set beresp.http.X-Cache-TTL = beresp.ttl;
    set beresp.http.X-Cache-Grace = beresp.grace;
    set beresp.http.X-Cache-SWR = beresp.stale_while_revalidate;
  }
  
  return(deliver);
}

sub vcl_deliver {
  # Add security headers
  set resp.http.X-Content-Type-Options = "nosniff";
  set resp.http.X-Frame-Options = "SAMEORIGIN";
  set resp.http.X-XSS-Protection = "1; mode=block";
  set resp.http.Content-Security-Policy = "default-src 'self' https://static.example.com; script-src 'self' https://static.example.com; style-src 'self' https://static.example.com; img-src 'self' https://static.example.com data:;";
  
  # Add debug headers for internal users
  if (client.ip ~ internal) {
    set resp.http.X-Cache-Status = fastly.state;
    set resp.http.X-Request-ID = req.http.X-Request-ID;
    set resp.http.X-AB-Test = req.http.X-AB-Test;
  } else {
    # Remove internal headers
    unset resp.http.Server;
    unset resp.http.X-Powered-By;
    unset resp.http.X-Varnish;
    unset resp.http.Via;
    unset resp.http.X-Cache;
    unset resp.http.X-Cache-Hits;
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
  } 
  else if (obj.status == 403) {
    set obj.response = "Forbidden";
    synthetic {"
      <!DOCTYPE html>
      <html>
        <head><title>Access Denied</title></head>
        <body>
          <h1>Access Denied</h1>
          <p>You do not have permission to access this resource.</p>
        </body>
      </html>
    "};
  }
  else if (obj.status == 429) {
    set obj.http.Retry-After = "60";
    set obj.response = "Too Many Requests";
    synthetic {"
      <!DOCTYPE html>
      <html>
        <head><title>Rate Limit Exceeded</title></head>
        <body>
          <h1>Too Many Requests</h1>
          <p>You have made too many requests. Please try again later.</p>
        </body>
      </html>
    "};
  }
  else if (obj.status == 503) {
    set obj.response = "Service Unavailable";
    synthetic {"
      <!DOCTYPE html>
      <html>
        <head><title>Site Maintenance</title></head>
        <body>
          <h1>Site Under Maintenance</h1>
          <p>We're currently performing maintenance. Please check back soon.</p>
        </body>
      </html>
    "};
  }
  
  return(deliver);
}
