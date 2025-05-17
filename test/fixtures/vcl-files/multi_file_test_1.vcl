# First VCL file for multi-file test

# Define a backend
backend test_backend_1 {
    .host = "example1.com";
    .port = "80";
}

# Define an ACL
acl test_acl_1 {
    "192.168.1.0"/24;
    "10.0.0.0"/8;
}

# Define vcl_recv subroutine
sub vcl_recv {
    # Set a custom header
    set req.http.X-Test-File-1 = "File 1";
    
    # Set backend
    set req.backend = test_backend_1;
    
    # Continue processing
    return(lookup);
}
