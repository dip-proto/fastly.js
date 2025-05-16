# Basic VCL configuration for HTTP proxy

# This is a simple VCL file that demonstrates the basic structure
# and functionality of Fastly VCL for our HTTP proxy implementation.

# Reception: This is executed when a request is received
sub vcl_recv {
    # Log the incoming request
    std.log("Received request: " + req.method + " " + req.url);

    # Add a custom header to track that this request was processed by our VCL
    set req.http.X-VCL-Processed = "true";

    # Example: Block requests to specific paths
    if (req.url ~ "^/admin") {
        error 403 "Forbidden";
    }

    # Example: Redirect HTTP to HTTPS (not applicable in our proxy yet)
    # if (req.http.X-Forwarded-Proto != "https") {
    #     error 301 "Redirect to HTTPS";
    # }

    # Continue with normal processing
    return(lookup);
}

# Hash: This determines how the cache key is created
sub vcl_hash {
    # Default hash data
    hash_data(req.url);
    hash_data(req.http.host);

    # Example: Different cache for mobile and desktop
    if (req.http.User-Agent ~ "Mobile|Android|iPhone") {
        hash_data("mobile");
    } else {
        hash_data("desktop");
    }

    return(hash);
}

# Hit: This is executed when the object is found in cache
sub vcl_hit {
    std.log("Cache hit for: " + req.url);
    return(deliver);
}

# Miss: This is executed when the object is not found in cache
sub vcl_miss {
    std.log("Cache miss for: " + req.url);
    return(fetch);
}

# Pass: This is executed when we skip the cache
sub vcl_pass {
    std.log("Cache pass for: " + req.url);
    return(fetch);
}

# Fetch: This is executed after we receive a response from the backend
sub vcl_fetch {
    # Log that we're in vcl_fetch
    std.log("DEBUG: Executing vcl_fetch");

    # Set default cache time to 5 minutes
    set beresp.ttl = 5m;
    std.log("DEBUG: Set TTL to 5m (300 seconds)");

    # Set grace period to 1 hour
    set beresp.grace = 1h;
    std.log("DEBUG: Set grace to 1h (3600 seconds)");

    # Set stale-while-revalidate to 10 seconds
    set beresp.stale_while_revalidate = 10s;
    std.log("DEBUG: Set stale-while-revalidate to 10s");

    # Don't cache error responses
    if (beresp.status >= 500) {
        return(pass);
    }

    # Example: Cache images longer
    if (beresp.http.Content-Type ~ "image/") {
        set beresp.ttl = 1h;
    }

    # Example: Add debug headers
    set beresp.http.X-VCL-Cache-TTL = beresp.ttl;
    set beresp.http.X-VCL-Cache-Grace = beresp.grace;
    set beresp.http.X-VCL-Cache-SWR = beresp.stale_while_revalidate;

    return(deliver);
}

# Deliver: This is executed before sending the response to the client
sub vcl_deliver {
    # Add a header to indicate cache status if not already set
    if (!resp.http.X-Cache) {
        if (obj.hits > 0) {
            set resp.http.X-Cache = "HIT";
        } else {
            set resp.http.X-Cache = "MISS";
        }
    }

    # Example: Add a custom header
    set resp.http.X-Powered-By = "VCL Proxy";

    # Example: Keep debug headers in development, but would remove in production
    # unset resp.http.X-VCL-Cache-TTL;
    # unset resp.http.X-VCL-Cache-Grace;
    # unset resp.http.X-VCL-Cache-SWR;

    return(deliver);
}

# Error: This is executed when an error occurs
sub vcl_error {
    # For 403 Forbidden responses
    if (obj.status == 403) {
        set obj.http.Content-Type = "text/html; charset=utf-8";
        synthetic {"
<!DOCTYPE html>
<html>
<head>
    <title>Access Denied</title>
</head>
<body>
    <h1>Access Denied</h1>
    <p>You do not have permission to access this resource.</p>
</body>
</html>
        "};
        return(deliver);
    }

    # For 301 redirects
    if (obj.status == 301) {
        set obj.http.Location = "https://" + req.http.host + req.url;
        synthetic {"
<!DOCTYPE html>
<html>
<head>
    <title>Redirecting...</title>
    <meta http-equiv="refresh" content="0;url=https://" + req.http.host + req.url + ">
</head>
<body>
    <h1>Redirecting...</h1>
    <p>You are being redirected to the secure version of this site.</p>
</body>
</html>
        "};
        return(deliver);
    }

    # Default error page
    set obj.http.Content-Type = "text/html; charset=utf-8";
    synthetic {"
<!DOCTYPE html>
<html>
<head>
    <title>Error</title>
</head>
<body>
    <h1>Error " + obj.status + "</h1>
    <p>" + obj.response + "</p>
</body>
</html>
    "};
    return(deliver);
}

# Log: This is executed after the response has been sent
sub vcl_log {
    std.log("Completed request: " + req.method + " " + req.url + " - Status: " + resp.status);
}
