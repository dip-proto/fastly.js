# Minimal Real-world VCL Example
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

# Main VCL logic
sub vcl_recv {
  # Set X-Request-ID for tracking
  set req.http.X-Request-ID = "12345678-1234-1234-1234-123456789012";

  # Route to appropriate backend
  if (req.url ~ "^/api/") {
    set req.backend = origin_api;
    return(pass);
  }
  else if (req.url ~ "^/static/") {
    set req.backend = origin_static;
    return(lookup);
  }
  else {
    set req.backend = origin_api;

    # Handle homepage A/B testing
    if (req.url == "/") {
      set req.http.X-Homepage-Variant = "A";
      set req.http.Fastly-Cache-Key = req.http.X-Homepage-Variant;
    }

    return(lookup);
  }
}

sub vcl_hash {
  hash_data(req.url);

  if (req.http.host) {
    hash_data(req.http.host);
  }

  if (req.http.X-Homepage-Variant) {
    hash_data(req.http.X-Homepage-Variant);
  }

  return(hash);
}

sub vcl_fetch {
  if (req.url ~ "^/static/") {
    set beresp.ttl = 24h;
    set beresp.grace = 1h;
    set beresp.stale_while_revalidate = 1h;
  }
  else if (req.url ~ "^/api/") {
    set beresp.ttl = 0s;
  }
  else {
    set beresp.ttl = 5m;
    set beresp.grace = 1m;
    set beresp.stale_while_revalidate = 1m;
  }

  if (beresp.http.Content-Type ~ "text/html") {
    set beresp.do_esi = true;
  }

  return(deliver);
}

sub vcl_deliver {
  if (client.ip ~ internal) {
    set resp.http.X-Cache-Status = fastly.state;
    set resp.http.X-Request-ID = req.http.X-Request-ID;

    if (req.http.X-Homepage-Variant) {
      set resp.http.X-Homepage-Variant = req.http.X-Homepage-Variant;
    }
  } else {
    unset resp.http.Server;
    unset resp.http.X-Powered-By;
    unset resp.http.X-Varnish;
    unset resp.http.Via;
  }

  set resp.http.X-Content-Type-Options = "nosniff";
  set resp.http.X-Frame-Options = "SAMEORIGIN";
  set resp.http.X-XSS-Protection = "1; mode=block";

  return(deliver);
}

sub vcl_error {
  set obj.http.Content-Type = "text/html; charset=utf-8";

  synthetic {"<!DOCTYPE html><html><head><title>Error</title></head><body><h1>Error</h1><p>Reference: "} + req.http.X-Request-ID + {"</p></body></html>"};

  return(deliver);
}
