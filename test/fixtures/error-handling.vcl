sub vcl_recv {
  # Trigger an error for specific paths
  if (req.url ~ "^/forbidden") {
    set req.http.X-Error-Status = "403";
    set req.http.X-Error-Message = "Forbidden";
  }

  return lookup;
}
