# VCL file for testing string manipulation functions

sub vcl_recv {
  # Test string manipulation functions
  set req.http.Test-Tolower = std.tolower("HELLO WORLD");
  set req.http.Test-Toupper = std.toupper("hello world");
  set req.http.Test-Strlen = std.strlen("hello");
  set req.http.Test-Strstr = std.strstr("hello world", "world");
  set req.http.Test-Substr = std.substr("hello world", 6, 5);
  set req.http.Test-Prefixof = std.prefixof("hello world", "hello");
  set req.http.Test-Suffixof = std.suffixof("hello world", "world");
  set req.http.Test-Replace = std.replace("hello world", "world", "universe");
  set req.http.Test-Replaceall = std.replaceall("hello hello hello", "hello", "hi");
  
  return(lookup);
}

sub vcl_deliver {
  # Add a response header to show we processed this file
  set resp.http.X-String-Functions-Test = "Completed";
  
  return(deliver);
}
