sub vcl_recv {
  std.log("Hello, World!");
  return(lookup);
}
