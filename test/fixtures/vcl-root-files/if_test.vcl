sub vcl_recv {
  if (req.url ~ "^/api/") {
    set req.http.X-API = "true";
    return(pass);
  }
  return(lookup);
}
