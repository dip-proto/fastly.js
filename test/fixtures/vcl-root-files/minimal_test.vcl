sub vcl_recv {
  set req.http.X-Test = "Hello, World!";
  return(lookup);
}
