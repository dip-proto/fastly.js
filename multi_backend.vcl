# Multi-backend routing example, written in standard Fastly VCL:
# declared backends with health-check probes, a weighted random director,
# and per-path backend selection in vcl_recv.

backend main {
  .host = "neverssl.com";
  .port = "80";
  .connect_timeout = 1s;
  .first_byte_timeout = 15s;
  .between_bytes_timeout = 10s;
  .probe = {
    .request = "HEAD / HTTP/1.1" "Host: neverssl.com" "Connection: close";
    .expected_response = 200;
    .interval = 5s;
    .timeout = 2s;
  }
}

backend api {
  .host = "httpbin.org";
  .port = "80";
  .connect_timeout = 2s;
  .first_byte_timeout = 20s;
  .between_bytes_timeout = 15s;
  .probe = {
    .request = "HEAD /get HTTP/1.1" "Host: httpbin.org" "Connection: close";
    .expected_response = 200;
    .interval = 10s;
    .timeout = 5s;
  }
}

backend static_content {
  .host = "example.com";
  .port = "80";
}

# Weighted random director: main gets twice the traffic of static_content.
director main_director random {
  .quorum = 50%;
  .retries = 3;
  { .backend = main; .weight = 2; }
  { .backend = static_content; .weight = 1; }
}

# Fallback director: try main first, then api.
director fallback_director fallback {
  { .backend = main; }
  { .backend = api; }
}

sub vcl_recv {
  # Route requests based on URL path
  if (req.url ~ "^/api/") {
    set req.backend = api;
    log "Using API backend for " + req.url;
  } else if (req.url ~ "\.(jpg|jpeg|png|gif|css|js)$") {
    set req.backend = static_content;
    log "Using static backend for " + req.url;
  } else {
    set req.backend = main_director;
    log "Using main director for " + req.url;
  }

  # Add a custom header for debugging
  set req.http.X-Selected-Backend = req.backend;

  return(lookup);
}

sub vcl_deliver {
  # Add backend information to the response
  set resp.http.X-Backend = req.http.X-Selected-Backend;
  set resp.http.X-Cache-Status = "MISS";

  if (obj.hits > 0) {
    set resp.http.X-Cache-Status = "HIT";
    set resp.http.X-Cache-Hits = obj.hits;
  }

  return(deliver);
}
