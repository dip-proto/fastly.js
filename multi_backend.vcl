sub vcl_recv {
  # Initialize backends
  
  # Main backend (default)
  std.backend.add("main", "neverssl.com", 80, false, {
    "connect_timeout": 1000,
    "first_byte_timeout": 15000,
    "between_bytes_timeout": 10000
  });
  
  # API backend
  std.backend.add("api", "httpbin.org", 80, false, {
    "connect_timeout": 2000,
    "first_byte_timeout": 20000,
    "between_bytes_timeout": 15000
  });
  
  # Static content backend
  std.backend.add("static", "example.com", 80, false);
  
  # Add health check probes
  std.backend.add_probe("main", {
    "request": "HEAD / HTTP/1.1\r\nHost: neverssl.com\r\nConnection: close\r\n\r\n",
    "expected_response": 200,
    "interval": 5000,
    "timeout": 2000
  });
  
  std.backend.add_probe("api", {
    "request": "HEAD /get HTTP/1.1\r\nHost: httpbin.org\r\nConnection: close\r\n\r\n",
    "expected_response": 200,
    "interval": 10000,
    "timeout": 5000
  });
  
  # Create directors
  
  # Main director (random)
  std.director.add("main_director", "random", {
    "quorum": 50,
    "retries": 3
  });
  
  # Add backends to the main director
  std.director.add_backend("main_director", "main", 2);
  std.director.add_backend("main_director", "static", 1);
  
  # Fallback director
  std.director.add("fallback_director", "fallback");
  std.director.add_backend("fallback_director", "main", 1);
  std.director.add_backend("fallback_director", "api", 1);
  
  # Route requests based on URL path
  if (req.url ~ "^/api/") {
    # Use API backend for API requests
    std.backend.set_current("api");
    log "Using API backend for " + req.url;
  } 
  else if (req.url ~ "\.(jpg|jpeg|png|gif|css|js)$") {
    # Use static backend for static content
    std.backend.set_current("static");
    log "Using static backend for " + req.url;
  }
  else {
    # Use main director for everything else
    set req.backend = std.director.select_backend("main_director").name;
    log "Using main director backend: " + req.backend + " for " + req.url;
  }
  
  # Add custom headers for debugging
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
