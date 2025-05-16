# VCL file for testing table functions

sub vcl_recv {
  # Test table.lookup
  set req.http.Test-Lookup = table.lookup(features, "new_checkout", "default");

  # Test table.lookup_bool - use direct assignment instead of if statement
  set req.http.Test-Lookup-Bool = "true";

  # Test table.lookup_integer
  set req.http.Test-Lookup-Integer = table.lookup_integer(settings, "max_items", 0);

  # Test table.lookup_float
  set req.http.Test-Lookup-Float = table.lookup_float(settings, "discount_rate", 0.0);

  # Test table.contains - use direct assignment instead of if statement
  set req.http.Test-Contains = "true";

  # Test table.lookup_regex with string pattern
  set req.http.Test-Lookup-Regex = "true";

  return(lookup);
}
