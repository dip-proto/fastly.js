# Test VCL file for standard functions

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
    
    # Test regex functions
    set req.http.Test-Regsub = regsub("hello world", "world", "universe");
    set req.http.Test-Regsuball = regsuball("hello hello hello", "hello", "hi");
    
    # Test type conversion
    set req.http.Test-Integer = std.integer("42");
    set req.http.Test-Real = std.real("3.14");
    
    # Test math functions
    set req.http.Test-Round = math.round(3.5);
    set req.http.Test-Floor = math.floor(3.7);
    set req.http.Test-Ceil = math.ceil(3.2);
    set req.http.Test-Pow = math.pow(2, 3);
    set req.http.Test-Min = math.min(5, 10);
    set req.http.Test-Max = math.max(5, 10);
    set req.http.Test-Abs = math.abs(-42);
    
    # Test encoding/decoding
    set req.http.Test-Base64 = digest.base64("hello world");
    set req.http.Test-Base64Decode = digest.base64_decode(req.http.Test-Base64);
    set req.http.Test-Base64Url = digest.base64url("hello world");
    set req.http.Test-Base64UrlDecode = digest.base64url_decode(req.http.Test-Base64Url);
    
    # Test digest functions
    set req.http.Test-MD5 = digest.hash_md5("hello world");
    set req.http.Test-SHA1 = digest.hash_sha1("hello world");
    set req.http.Test-SHA256 = digest.hash_sha256("hello world");
    set req.http.Test-HMAC-MD5 = digest.hmac_md5("key", "hello world");
    set req.http.Test-HMAC-SHA1 = digest.hmac_sha1("key", "hello world");
    set req.http.Test-HMAC-SHA256 = digest.hmac_sha256("key", "hello world");
    
    # Test query string functions
    set req.http.Test-QS-Get = querystring.get(req.url, "param");
    set req.http.Test-QS-Set = querystring.set(req.url, "param", "value");
    set req.http.Test-QS-Remove = querystring.remove(req.url, "param");
    
    # Return all test headers in the response
    return(lookup);
}

sub vcl_deliver {
    # Add a header to show all our test results
    set resp.http.X-Test-Results = "VCL Standard Functions Test Results";
    
    return(deliver);
}
