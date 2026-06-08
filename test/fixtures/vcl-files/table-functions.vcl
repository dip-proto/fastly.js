# VCL file for testing table functions

sub vcl_recv {
  # Test table.lookup
  set req.http.Test-Lookup = table.lookup(features, "new_checkout", "default");

  # Test table.lookup_bool
  set req.http.Test-Lookup-Bool = table.lookup_bool(features, "is_enabled", false);

  # Test table.lookup_integer
  set req.http.Test-Lookup-Integer = table.lookup_integer(settings, "max_items", 0);

  # Test table.lookup_float
  set req.http.Test-Lookup-Float = table.lookup_float(settings, "discount_rate", 0.0);

  # Test table.contains
  set req.http.Test-Contains = table.contains(features, "new_checkout");

  # Test table.lookup_regex with string pattern
  set req.http.Test-Lookup-Regex = "true";

  return(lookup);
}
