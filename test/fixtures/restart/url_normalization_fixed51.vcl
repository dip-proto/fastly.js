# URL Normalization Example
# This VCL demonstrates advanced URL normalization using restart

sub vcl_recv {
    # FASTLY RECV
    
    # Track restarts
    set req.http.X-Restart-Count = req.restarts;
    
    # Debug
    log "Current restart count: " + req.restarts;
    
    # First time through, save the original URL
    if (req.restarts == 0) {
        # Initialize headers
        set req.http.X-Original-URL = req.url;
        set req.http.X-Current-URL = req.url;
        
        # First pass: Handle double slashes
        if (req.http.X-Current-URL ~ "//") {
            set req.http.X-Current-URL = regsub(req.http.X-Current-URL, "//", "/");
            set req.http.X-Restart-Reason = "double_slash_removal";
            return(restart);
        }
    }
    # Second pass: Add trailing slash if needed
    else if (req.restarts == 1) {
        # Only add trailing slash if not a file (no extension)
        if (!req.http.X-Current-URL ~ "\\.") {
            # Only add trailing slash if not already present
            if (!req.http.X-Current-URL ~ "/$") {
                set req.http.X-Current-URL = req.http.X-Current-URL + "/";
                set req.http.X-Restart-Reason = "add_trailing_slash";
                return(restart);
            }
        }
    }
    # Third pass: Add index.html if URL ends with slash
    else if (req.restarts == 2) {
        if (req.http.X-Current-URL ~ "/$") {
            set req.http.X-Current-URL = req.http.X-Current-URL + "index.html";
            set req.http.X-Restart-Reason = "add_index_html";
            # No restart here, continue processing
        }
    }
    
    # Prevent infinite loops
    if (req.restarts >= 5) {
        set req.http.X-Max-Restarts-Reached = "true";
        error 503 "Maximum number of restarts reached";
    }

    # Log the normalized URL
    log "Normalized URL: " + req.http.X-Current-URL + " (original: " + req.http.X-Original-URL + ")";

    return(lookup);
}

sub vcl_deliver {
    # FASTLY DELIVER

    # Set response headers for debugging
    set resp.http.X-Restart-Count = req.restarts;
    set resp.http.X-Original-URL = req.http.X-Original-URL;
    set resp.http.X-Current-URL = req.http.X-Current-URL;

    if (req.http.X-Restart-Reason) {
        set resp.http.X-Restart-Reason = req.http.X-Restart-Reason;
    }

    return(deliver);
}
