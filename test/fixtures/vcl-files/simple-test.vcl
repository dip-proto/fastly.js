# Simple VCL test file

# Backend definition
backend origin_api {
  .host = "api.example.com";
  .port = "443";
  .ssl = true;
}

# Main VCL logic
sub vcl_recv {
  # Set backend
  set req.backend = "origin_api";

  # Return pass
  return(pass);
}
