# Second VCL file for multi-file test

# Define another backend
backend test_backend_2 {
    .host = "example2.com";
    .port = "80";
}

# Define another ACL
acl test_acl_2 {
    "172.16.0.0"/12;
    "192.168.2.0"/24;
}

# Define vcl_deliver subroutine
sub vcl_deliver {
    # Set a custom header
    set resp.http.X-Test-File-2 = "File 2";
    
    # Log the response
    std.log("Delivering response from file 2");
    
    return(deliver);
}
