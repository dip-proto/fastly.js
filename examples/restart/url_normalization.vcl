# URL Normalization Example
# This VCL demonstrates advanced URL normalization using restart

sub vcl_recv {
    # Track restarts
    set req.http.X-Restart-Count = req.restarts;
    set req.http.X-Original-URL = req.url;

    # First restart: Handle double slashes
    if (req.restarts == 0) {
        # Check for double slashes
        if (req.url ~ "//") {
            # Remove double slashes
            set req.url = regsub(req.url, "//", "/");
            set req.http.X-Restart-Reason = "double_slash_removal";
            restart;
        }
    }

    # Second restart: Add trailing slash
    if (req.restarts == 1) {
        # Check if URL doesn't end with a file extension or slash
        if (req.url !~ "\\." && req.url !~ "/$") {
            # Add trailing slash
            set req.url = req.url + "/";
            set req.http.X-Restart-Reason = "add_trailing_slash";
            restart;
        }
    }

    # Third restart: Add index.html
    if (req.restarts == 2) {
        # Check if URL ends with a slash
        if (req.url ~ "/$") {
            # Add index.html
            set req.url = req.url + "index.html";
            set req.http.X-Restart-Reason = "add_index_html";
            restart;
        }
    }

    # Prevent infinite loops
    if (req.restarts >= 4) {
        set req.http.X-Max-Restarts-Reached = "true";
        error 503 "Maximum number of restarts reached";
    }

    # Log the normalized URL
    log "Normalized URL: " + req.url + " (original: " + req.http.X-Original-URL + ")";

    return(lookup);
}

sub vcl_deliver {
    # Add headers to show restart information
    set resp.http.X-Restart-Count = req.restarts;
    set resp.http.X-Original-URL = req.http.X-Original-URL;
    set resp.http.X-Current-URL = req.url;

    if (req.http.X-Restart-Reason) {
        set resp.http.X-Restart-Reason = req.http.X-Restart-Reason;
    }

    return(deliver);
}
