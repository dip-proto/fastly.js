# Basic Real-world VCL Example
# This file demonstrates a simplified real-world VCL configuration

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
    set req.backend = "origin_api";
    return(pass);
  }
  else if (req.url ~ "^/static/") {
    set req.backend = "origin_static";
    return(lookup);
  }
  else {
    set req.backend = "origin_api";

    # Handle homepage A/B testing
    if (req.url == "/") {
      set req.http.X-Homepage-Variant = "A";
    }

    return(lookup);
  }
}

sub vcl_hash {
  hash_data(req.url);

  if (req.http.host) {
    hash_data(req.http.host);
  }

  return(hash);
}

sub vcl_fetch {
  if (req.url ~ "^/static/") {
    set beresp.ttl = 24h;
  }
  else if (req.url ~ "^/api/") {
    set beresp.ttl = 0s;
  }
  else {
    set beresp.ttl = 5m;
  }

  return(deliver);
}

sub vcl_deliver {
  if (client.ip ~ internal) {
    set resp.http.X-Cache-Status = fastly.state;
    set resp.http.X-Request-ID = req.http.X-Request-ID;
  } else {
    unset resp.http.Server;
    unset resp.http.X-Powered-By;
  }

  set resp.http.X-Content-Type-Options = "nosniff";

  return(deliver);
}

sub vcl_error {
  set obj.http.Content-Type = "text/html; charset=utf-8";
  return(deliver);
}
