# VCL file for testing error handling

sub vcl_recv {
  # Return 403 Forbidden for /forbidden path
  if (req.url ~ "^/forbidden") {
    error 403 "Access Denied";
  }

  # Return 404 Not Found for /not-found path
  if (req.url ~ "^/not-found") {
    error 404 "Page Not Found";
  }

  # Return 500 Internal Server Error for /server-error path
  if (req.url ~ "^/server-error") {
    error 500 "Internal Server Error";
  }

  return(lookup);
}

sub vcl_error {
  # Set a custom header for error responses
  set obj.http.X-Error-Type = "VCL Error";
  set obj.http.X-Error-Status = obj.status;

  # Create a simple synthetic response
  set obj.http.Content-Type = "text/plain";
  synthetic {"Error " + obj.status + ": " + obj.response};

  return(deliver);
}

sub vcl_deliver {
  # Add a header to show we processed this file
  set resp.http.X-Error-Test = "Completed";

  return(deliver);
}
