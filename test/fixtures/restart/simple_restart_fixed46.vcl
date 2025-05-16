# Simple Restart Example
# This VCL demonstrates basic restart functionality

sub vcl_recv {
    # FASTLY RECV
    
    # Track restarts
    set req.http.X-Restart-Count = req.restarts;
    
    # Debug
    log "Current restart count: " + req.restarts;

    # First time through, initialize headers
    if (req.restarts == 0) {
        set req.http.X-Custom-Header = "First Pass";
        set req.http.X-Restart-Reason = "first_pass";
        return(restart);
    }
    # Second pass
    else if (req.restarts == 1) {
        set req.http.X-Custom-Header = req.http.X-Custom-Header + ", Second Pass";
        set req.http.X-Restart-Reason = "second_pass";
        return(restart);
    }
    # Third pass
    else if (req.restarts == 2) {
        set req.http.X-Custom-Header = req.http.X-Custom-Header + ", Final Pass";
        set req.http.X-Restart-Reason = "final_pass";
        # No restart here, continue processing
    }
    # Prevent infinite loops
    else if (req.restarts >= 4) {
        set req.http.X-Max-Restarts-Reached = "true";
        error 503 "Maximum number of restarts reached";
    }

    return(lookup);
}

sub vcl_deliver {
    # FASTLY DELIVER

    # Set response headers for debugging
    set resp.http.X-Restart-Count = req.restarts;
    set resp.http.X-Custom-Header = req.http.X-Custom-Header;
    
    if (req.http.X-Restart-Reason) {
        set resp.http.X-Restart-Reason = req.http.X-Restart-Reason;
    }

    return(deliver);
}
