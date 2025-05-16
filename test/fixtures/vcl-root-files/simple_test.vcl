sub vcl_recv {
  # Set a custom header
  set req.http.X-Test = "Hello, World!";
  
  # Test conditional logic
  if (req.url ~ "^/api/") {
    set req.http.X-API = "true";
    return(pass);
  } else if (req.url ~ "^/static/") {
    set req.http.X-Static = "true";
    return(lookup);
  } else {
    set req.http.X-Default = "true";
    return(lookup);
  }
}

sub vcl_deliver {
  # Add a response header
  set resp.http.X-Powered-By = "VCL.js";
  
  # Log the response
  std.log("Delivering response with status: " + resp.status);
  
  return(deliver);
}
