# Backend Failover with Health Checking Example
# This VCL demonstrates advanced failover strategies using restart

# Define multiple backends
backend primary {
    .host = "primary-backend.example.com";
    .port = "80";
    .connect_timeout = 1s;
    .first_byte_timeout = 5s;
    .between_bytes_timeout = 2s;
    .probe = {
        .url = "/health";
        .timeout = 1s;
        .interval = 5s;
        .window = 5;
        .threshold = 3;
    }
}

backend secondary {
    .host = "secondary-backend.example.com";
    .port = "80";
    .connect_timeout = 1s;
    .first_byte_timeout = 5s;
    .between_bytes_timeout = 2s;
    .probe = {
        .url = "/health";
        .timeout = 1s;
        .interval = 5s;
        .window = 5;
        .threshold = 3;
    }
}

backend tertiary {
    .host = "tertiary-backend.example.com";
    .port = "80";
    .connect_timeout = 2s;
    .first_byte_timeout = 10s;
    .between_bytes_timeout = 5s;
    .probe = {
        .url = "/health";
        .timeout = 2s;
        .interval = 10s;
        .window = 5;
        .threshold = 3;
    }
}

# Define a director for load balancing
director backend_pool random {
    { .backend = primary; .weight = 10; }
    { .backend = secondary; .weight = 5; }
}

sub vcl_recv {
    # Track restarts
    set req.http.X-Restart-Count = req.restarts;
    
    # First restart: Select initial backend based on request type
    if (req.restarts == 0) {
        # API requests go to primary backend
        if (req.url ~ "^/api/") {
            set req.backend = primary;
            set req.http.X-Selected-Backend = "primary";
        } 
        # Static content uses the backend pool
        else if (req.url ~ "\.(jpg|jpeg|png|gif|css|js)$") {
            set req.backend = backend_pool;
            set req.http.X-Selected-Backend = "backend_pool";
        }
        # Default to primary
        else {
            set req.backend = primary;
            set req.http.X-Selected-Backend = "primary";
        }
        
        # Check if selected backend is healthy
        if (!std.backend.is_healthy(req.backend)) {
            set req.http.X-Restart-Reason = "initial_backend_unhealthy";
            restart;
        }
    }
    
    # Second restart: Failover to secondary if primary is unhealthy
    if (req.restarts == 1) {
        # If we're here, the initially selected backend was unhealthy
        if (req.http.X-Selected-Backend == "primary" || req.http.X-Selected-Backend == "backend_pool") {
            set req.backend = secondary;
            set req.http.X-Selected-Backend = "secondary";
            
            # Check if secondary backend is healthy
            if (!std.backend.is_healthy(req.backend)) {
                set req.http.X-Restart-Reason = "secondary_backend_unhealthy";
                restart;
            }
        }
    }
    
    # Third restart: Failover to tertiary as last resort
    if (req.restarts == 2) {
        # If we're here, both primary and secondary were unhealthy
        set req.backend = tertiary;
        set req.http.X-Selected-Backend = "tertiary";
        
        # Check if tertiary backend is healthy
        if (!std.backend.is_healthy(req.backend)) {
            # All backends are unhealthy
            set req.http.X-Restart-Reason = "all_backends_unhealthy";
            error 503 "All backends are unhealthy";
        }
    }
    
    # Restart if we get a 5xx response from the backend
    if (req.restarts > 0 && req.restarts < 3 && req.http.X-Backend-Status ~ "^5") {
        set req.http.X-Restart-Reason = "backend_5xx_error";
        restart;
    }
    
    # Prevent infinite loops
    if (req.restarts >= 4) {
        set req.http.X-Max-Restarts-Reached = "true";
        error 503 "Maximum number of restarts reached";
    }
    
    return(lookup);
}

sub vcl_fetch {
    # Store the backend response status for potential restart
    set req.http.X-Backend-Status = beresp.status;
    
    # If we get a 5xx error, trigger a restart to try another backend
    if (beresp.status >= 500 && beresp.status < 600 && req.restarts < 3) {
        return(restart);
    }
    
    return(deliver);
}

sub vcl_deliver {
    # Add headers to show backend information
    set resp.http.X-Restart-Count = req.restarts;
    set resp.http.X-Selected-Backend = req.http.X-Selected-Backend;
    
    if (req.http.X-Restart-Reason) {
        set resp.http.X-Restart-Reason = req.http.X-Restart-Reason;
    }
    
    return(deliver);
}

sub vcl_error {
    if (obj.status == 503) {
        set obj.http.Content-Type = "text/html; charset=utf-8";
        synthetic {"
<!DOCTYPE html>
<html>
<head>
    <title>Service Unavailable</title>
</head>
<body>
    <h1>Service Unavailable</h1>
    <p>We're experiencing technical difficulties. Please try again later.</p>
    <p>Reason: "} + obj.response + {"</p>
</body>
</html>
"};
        return(deliver);
    }
    
    return(deliver);
}
