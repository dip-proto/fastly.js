# Backend Failover Example
# This VCL demonstrates backend failover using restart

# Define backends
backend primary {
    .host = "primary.example.com";
    .port = 80;
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
    .host = "secondary.example.com";
    .port = 80;
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
    .host = "tertiary.example.com";
    .port = 80;
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
    .backend = primary { .weight = 3; }
    .backend = secondary { .weight = 1; }
}

sub vcl_recv {
    # Track restarts
    set req.http.X-Restart-Count = req.restarts;
    
    # First time through, select the initial backend
    if (req.restarts == 0) {
        # API requests go directly to primary
        if (req.url ~ "^/api/") {
            set req.backend = primary;
            set req.http.X-Selected-Backend = "primary";
        }
        # Static content uses the backend pool
        else if (req.url ~ "^/images/") {
            set req.backend = backend_pool;
            set req.http.X-Selected-Backend = "backend_pool";
        }
        # Default to primary for everything else
        else {
            set req.backend = primary;
            set req.http.X-Selected-Backend = "primary";
        }
        
        # Check if the selected backend is healthy
        if (!std.backend.is_healthy(req.backend)) {
            set req.http.X-Restart-Reason = "initial_backend_unhealthy";
            return(restart);
        }
    }
    
    # First restart - try secondary backend
    if (req.restarts == 1) {
        # If we were using primary or backend_pool, switch to secondary
        if (req.http.X-Selected-Backend == "primary" || req.http.X-Selected-Backend == "backend_pool") {
            set req.backend = secondary;
            set req.http.X-Selected-Backend = "secondary";
            
            # Check if secondary is healthy
            if (!std.backend.is_healthy(req.backend)) {
                set req.http.X-Restart-Reason = "secondary_backend_unhealthy";
                return(restart);
            }
        }
    }
    
    # Second restart - try tertiary backend
    if (req.restarts == 2) {
        set req.backend = tertiary;
        set req.http.X-Selected-Backend = "tertiary";
        
        # Check if tertiary is healthy
        if (!std.backend.is_healthy(req.backend)) {
            set req.http.X-Restart-Reason = "all_backends_unhealthy";
            error 503 "All backends are unhealthy";
        }
    }
    
    # Handle backend errors that triggered a restart
    if (req.restarts > 0 && req.http.X-Backend-Status) {
        if (req.restarts == 1 && req.http.X-Backend-Status ~ "^5[0-9][0-9]$") {
            set req.http.X-Restart-Reason = "backend_5xx_error";
            return(restart);
        }
    }
    
    # Prevent infinite loops
    if (req.restarts >= 3) {
        set req.http.X-Max-Restarts-Reached = "true";
        error 503 "Max restarts reached";
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
        synthetic "<html><body><h1>Service Unavailable</h1></body></html>";
        return(deliver);
    }

    return(deliver);
}
