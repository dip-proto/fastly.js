# Simple Restart Example
# This VCL demonstrates basic restart functionality

sub vcl_recv {
    # Track restarts
    set req.http.X-Restart-Count = req.restarts;

    # First pass
    if (req.restarts == 0) {
        # First pass: Add a custom header
        set req.http.X-Custom-Header = "First Pass";
        set req.http.X-Restart-Reason = "first_pass";
        restart;
    }

    # Second pass
    if (req.restarts == 1) {
        # Second pass: Modify the custom header
        set req.http.X-Custom-Header = req.http.X-Custom-Header + ", Second Pass";
        set req.http.X-Restart-Reason = "second_pass";
        restart;
    }

    # Third pass
    if (req.restarts == 2) {
        # Third pass: Finalize the custom header
        set req.http.X-Custom-Header = req.http.X-Custom-Header + ", Final Pass";
        set req.http.X-Restart-Reason = "final_pass";
    }

    # Prevent infinite loops
    if (req.restarts >= 4) {
        set req.http.X-Max-Restarts-Reached = "true";
        error 503 "Maximum number of restarts reached";
    }

    return(lookup);
}

sub vcl_deliver {
    # FASTLY DELIVER

    # Add headers to show restart information
    set resp.http.X-Restart-Count = req.restarts;
    set resp.http.X-Custom-Header = req.http.X-Custom-Header;

    if (req.http.X-Restart-Reason) {
        set resp.http.X-Restart-Reason = req.http.X-Restart-Reason;
    }

    return(deliver);
}
