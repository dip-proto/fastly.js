# Simple VCL file for testing restart functionality

sub vcl_recv {
    # Add a header to track restarts
    set req.http.X-Restart-Count = req.restarts;

    # Simple restart test
    if (req.restarts == 0) {
        set req.http.X-Restart-Reason = "test";
        restart;
    }

    # Prevent infinite loops
    if (req.restarts >= 3) {
        error 503 "Maximum number of restarts reached";
    }

    return(lookup);
}

sub vcl_deliver {
    # Add headers to show restart information
    set resp.http.X-Restart-Count = req.restarts;

    return(deliver);
}
