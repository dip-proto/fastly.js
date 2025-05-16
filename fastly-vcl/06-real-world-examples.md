# Real-World Fastly VCL Examples

## Introduction

This document provides complete, practical examples of Fastly VCL configurations for various real-world use cases. These examples demonstrate how to apply the concepts covered in the previous documents to solve common problems and implement popular patterns.

## Example 1: E-commerce Website

This example demonstrates a complete VCL configuration for an e-commerce website, including:

- Content-based routing
- Caching strategies for different content types
- A/B testing
- Geolocation-based personalization
- Mobile detection
- Security headers
- Error handling

```vcl
# Define backends
backend F_primary_origin {
    .host = "origin.example.com";
    .port = "443";
    .ssl = true;
    .ssl_cert_hostname = "origin.example.com";
    .ssl_sni_hostname = "origin.example.com";
    .connect_timeout = 1s;
    .first_byte_timeout = 15s;
    .between_bytes_timeout = 10s;
    .probe = {
        .request = "HEAD /health HTTP/1.1" "Host: origin.example.com" "Connection: close";
        .expected_response = 200;
        .interval = 10s;
        .timeout = 5s;
        .window = 5;
        .threshold = 3;
    }
}

backend F_api_origin {
    .host = "api.example.com";
    .port = "443";
    .ssl = true;
    .ssl_cert_hostname = "api.example.com";
    .ssl_sni_hostname = "api.example.com";
    .connect_timeout = 1s;
    .first_byte_timeout = 20s;
    .between_bytes_timeout = 10s;
    .probe = {
        .request = "HEAD /health HTTP/1.1" "Host: api.example.com" "Connection: close";
        .expected_response = 200;
        .interval = 10s;
        .timeout = 5s;
        .window = 5;
        .threshold = 3;
    }
}

backend F_static_origin {
    .host = "static.example.com";
    .port = "443";
    .ssl = true;
    .ssl_cert_hostname = "static.example.com";
    .ssl_sni_hostname = "static.example.com";
    .connect_timeout = 1s;
    .first_byte_timeout = 10s;
    .between_bytes_timeout = 10s;
    .probe = {
        .request = "HEAD /health HTTP/1.1" "Host: static.example.com" "Connection: close";
        .expected_response = 200;
        .interval = 10s;
        .timeout = 5s;
        .window = 5;
        .threshold = 3;
    }
}

# Define directors
director F_primary_director random {
    .quorum = 50%;
    { .backend = F_primary_origin; .weight = 1; }
}

director F_api_director random {
    .quorum = 50%;
    { .backend = F_api_origin; .weight = 1; }
}

director F_static_director random {
    .quorum = 50%;
    { .backend = F_static_origin; .weight = 1; }
}

# Define ACLs
acl purge_acl {
    "127.0.0.1";
    "192.168.0.0"/24;
}

# VCL Initialization
sub vcl_init {
    # Initialize any runtime variables or tables
    return(ok);
}

# Request processing
sub vcl_recv {
    # Normalize URL
    if (req.url ~ "(\?|&)(utm_source|utm_medium|utm_campaign|gclid|fbclid)=") {
        set req.url = regsuball(req.url, "&?(utm_source|utm_medium|utm_campaign|gclid|fbclid)=([^&]*)", "");
        set req.url = regsuball(req.url, "\?&", "?");
        set req.url = regsub(req.url, "\?$", "");
    }
    
    # Remove trailing slash
    if (req.url.path ~ "(.+)/$") {
        set req.url = regsub(req.url, "/$", "");
    }
    
    # Handle PURGE requests
    if (req.method == "PURGE") {
        if (client.ip !~ purge_acl) {
            error 403 "Forbidden";
        }
        return(lookup);
    }
    
    # Set X-Forwarded-For header
    if (req.http.X-Forwarded-For) {
        set req.http.X-Forwarded-For = req.http.X-Forwarded-For + ", " + client.ip;
    } else {
        set req.http.X-Forwarded-For = client.ip;
    }
    
    # Detect device type
    if (req.http.User-Agent ~ "(?i)ip(hone|od)|android|blackberry|iemobile|mobile|palm") {
        set req.http.X-Device-Type = "mobile";
    } else {
        set req.http.X-Device-Type = "desktop";
    }
    
    # Set country code
    set req.http.X-Country-Code = client.geo.country_code;
    
    # A/B testing
    # Assign users to test groups based on cookie or IP hash
    if (req.http.Cookie !~ "ABTest=") {
        # Assign a test group (A or B) with 50/50 split
        declare local var.rand INTEGER;
        set var.rand = randomint(1, 100);
        
        if (var.rand <= 50) {
            set req.http.X-ABTest = "A";
        } else {
            set req.http.X-ABTest = "B";
        }
        
        # Set cookie for consistent experience
        add req.http.Cookie = "ABTest=" + req.http.X-ABTest + "; path=/; max-age=3600";
    } else {
        # Extract test group from cookie
        set req.http.X-ABTest = regsub(req.http.Cookie, ".*ABTest=([^;]+).*", "\1");
    }
    
    # Backend selection based on content type
    if (req.url ~ "^/api/") {
        set req.backend = F_api_director;
    } else if (req.url ~ "\.(jpg|jpeg|png|gif|css|js|ico|svg|woff|woff2|ttf|eot)$") {
        set req.backend = F_static_director;
    } else {
        set req.backend = F_primary_director;
    }
    
    # Pass (do not cache) for certain paths
    if (req.url ~ "^/cart" || req.url ~ "^/checkout" || req.url ~ "^/account") {
        return(pass);
    }
    
    # Pass for authenticated users
    if (req.http.Cookie ~ "session=") {
        return(pass);
    }
    
    # Default behavior
    return(lookup);
}

# Cache key generation
sub vcl_hash {
    # Default hash
    hash_data(req.url);
    
    if (req.http.host) {
        hash_data(req.http.host);
    } else {
        hash_data(server.ip);
    }
    
    # Vary cache by device type
    hash_data(req.http.X-Device-Type);
    
    # Vary cache by country for certain paths
    if (req.url ~ "^/products/" || req.url ~ "^/categories/") {
        hash_data(req.http.X-Country-Code);
    }
    
    # Vary cache by A/B test group
    hash_data(req.http.X-ABTest);
    
    return(hash);
}

# Cache hit processing
sub vcl_hit {
    # Handle PURGE requests
    if (req.method == "PURGE") {
        purge;
        error 200 "Purged";
    }
    
    # Deliver from cache
    return(deliver);
}

# Cache miss processing
sub vcl_miss {
    # Handle PURGE requests
    if (req.method == "PURGE") {
        purge;
        error 200 "Purged";
    }
    
    # Fetch from backend
    return(fetch);
}

# Pass processing
sub vcl_pass {
    # Set backend request headers
    set bereq.http.X-Device-Type = req.http.X-Device-Type;
    set bereq.http.X-Country-Code = req.http.X-Country-Code;
    set bereq.http.X-ABTest = req.http.X-ABTest;
    
    return(pass);
}

# Backend response processing
sub vcl_fetch {
    # Set different cache TTLs based on content type
    if (req.url ~ "^/products/") {
        # Product pages: cache for 2 hours
        set beresp.ttl = 2h;
        set beresp.grace = 24h;
        
        # Add surrogate key for purging
        set beresp.http.Surrogate-Key = "products";
        if (req.url ~ "^/products/([0-9]+)") {
            set beresp.http.Surrogate-Key = beresp.http.Surrogate-Key + " product-" + re.group.1;
        }
    } else if (req.url ~ "^/categories/") {
        # Category pages: cache for 4 hours
        set beresp.ttl = 4h;
        set beresp.grace = 24h;
        
        # Add surrogate key for purging
        set beresp.http.Surrogate-Key = "categories";
        if (req.url ~ "^/categories/([0-9]+)") {
            set beresp.http.Surrogate-Key = beresp.http.Surrogate-Key + " category-" + re.group.1;
        }
    } else if (req.url ~ "\.(jpg|jpeg|png|gif)$") {
        # Images: cache for 7 days
        set beresp.ttl = 7d;
        set beresp.grace = 7d;
    } else if (req.url ~ "\.(css|js)$") {
        # Static assets: cache for 1 day
        set beresp.ttl = 1d;
        set beresp.grace = 7d;
    } else if (req.url ~ "^/api/") {
        # API responses: cache for 5 minutes
        set beresp.ttl = 5m;
        set beresp.grace = 1h;
    } else {
        # Default: cache for 1 hour
        set beresp.ttl = 1h;
        set beresp.grace = 24h;
    }
    
    # Don't cache error responses
    if (beresp.status >= 500) {
        set beresp.ttl = 0s;
    }
    
    # Enable gzip compression
    if (beresp.http.Content-Type ~ "text/" || 
        beresp.http.Content-Type ~ "application/json" || 
        beresp.http.Content-Type ~ "application/javascript" || 
        beresp.http.Content-Type ~ "application/xml") {
        set beresp.gzip = true;
    }
    
    # Enable ESI processing for HTML content
    if (beresp.http.Content-Type ~ "text/html") {
        set beresp.do_esi = true;
    }
    
    return(deliver);
}

# Error handling
sub vcl_error {
    # Custom 404 page
    if (obj.status == 404) {
        set obj.http.Content-Type = "text/html; charset=utf-8";
        set obj.response = "Not Found";
        synthetic {"
<!DOCTYPE html>
<html>
<head>
    <title>Page Not Found</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 50px; }
        h1 { color: #333; }
    </style>
</head>
<body>
    <h1>Page Not Found</h1>
    <p>The page you requested could not be found. Please check the URL and try again.</p>
    <p><a href="/">Return to homepage</a></p>
</body>
</html>
        "};
        return(deliver);
    }
    
    # Custom 500 page
    if (obj.status >= 500) {
        set obj.http.Content-Type = "text/html; charset=utf-8";
        set obj.response = "Server Error";
        synthetic {"
<!DOCTYPE html>
<html>
<head>
    <title>Server Error</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 50px; }
        h1 { color: #c00; }
    </style>
</head>
<body>
    <h1>Server Error</h1>
    <p>We're sorry, but something went wrong. Please try again later.</p>
    <p><a href="/">Return to homepage</a></p>
</body>
</html>
        "};
        return(deliver);
    }
    
    return(deliver);
}

# Response delivery
sub vcl_deliver {
    # Add cache status header
    if (obj.hits > 0) {
        set resp.http.X-Cache = "HIT";
        set resp.http.X-Cache-Hits = obj.hits;
    } else {
        set resp.http.X-Cache = "MISS";
    }
    
    # Add security headers
    set resp.http.Strict-Transport-Security = "max-age=31536000; includeSubDomains";
    set resp.http.X-Content-Type-Options = "nosniff";
    set resp.http.X-Frame-Options = "DENY";
    set resp.http.X-XSS-Protection = "1; mode=block";
    set resp.http.Content-Security-Policy = "default-src 'self' https://static.example.com; script-src 'self' https://static.example.com; style-src 'self' https://static.example.com; img-src 'self' https://static.example.com data:; font-src 'self' https://static.example.com; connect-src 'self' https://api.example.com;";
    
    # Remove internal headers
    unset resp.http.Surrogate-Key;
    unset resp.http.X-Varnish;
    unset resp.http.Via;
    unset resp.http.X-Served-By;
    unset resp.http.X-Cache-Hits;
    unset resp.http.X-Timer;
    
    return(deliver);
}

# Logging
sub vcl_log {
    # Log request details
    log {"syslog "} req.service_id {" request_info :: "} 
        {"client_ip="} client.ip {" "}
        {"request_method="} req.method {" "}
        {"url="} req.url {" "}
        {"protocol="} req.proto {" "}
        {"status="} resp.status {" "}
        {"cache_status="} fastly_info.state {" "}
        {"device_type="} req.http.X-Device-Type {" "}
        {"country_code="} req.http.X-Country-Code {" "}
        {"ab_test="} req.http.X-ABTest;
    
    return(deliver);
}
## Example 2: Content Delivery for a Media Website

This example demonstrates a VCL configuration for a media website that serves news articles, videos, and images:

```vcl
# Define backends
backend F_main_origin {
    .host = "origin.media-example.com";
    .port = "443";
    .ssl = true;
    .connect_timeout = 1s;
    .first_byte_timeout = 15s;
    .between_bytes_timeout = 10s;
    .probe = {
        .request = "HEAD /health HTTP/1.1" "Host: origin.media-example.com" "Connection: close";
        .expected_response = 200;
        .interval = 10s;
        .timeout = 5s;
        .window = 5;
        .threshold = 3;
    }
}

backend F_video_origin {
    .host = "video.media-example.com";
    .port = "443";
    .ssl = true;
    .connect_timeout = 1s;
    .first_byte_timeout = 30s;
    .between_bytes_timeout = 20s;
    .probe = {
        .request = "HEAD /health HTTP/1.1" "Host: video.media-example.com" "Connection: close";
        .expected_response = 200;
        .interval = 10s;
        .timeout = 5s;
        .window = 5;
        .threshold = 3;
    }
}

backend F_image_origin {
    .host = "images.media-example.com";
    .port = "443";
    .ssl = true;
    .connect_timeout = 1s;
    .first_byte_timeout = 10s;
    .between_bytes_timeout = 10s;
    .probe = {
        .request = "HEAD /health HTTP/1.1" "Host: images.media-example.com" "Connection: close";
        .expected_response = 200;
        .interval = 10s;
        .timeout = 5s;
        .window = 5;
        .threshold = 3;
    }
}

# Define ACLs
acl purge_acl {
    "127.0.0.1";
    "192.168.0.0"/24;
}

# Request processing
sub vcl_recv {
    # Normalize URL
    if (req.url ~ "(\?|&)(utm_source|utm_medium|utm_campaign|gclid|fbclid)=") {
        set req.url = regsuball(req.url, "&?(utm_source|utm_medium|utm_campaign|gclid|fbclid)=([^&]*)", "");
        set req.url = regsuball(req.url, "\?&", "?");
        set req.url = regsub(req.url, "\?$", "");
    }
    
    # Handle PURGE requests
    if (req.method == "PURGE") {
        if (client.ip !~ purge_acl) {
            error 403 "Forbidden";
        }
        return(lookup);
    }
    
    # Detect device type
    if (req.http.User-Agent ~ "(?i)ip(hone|od)|android|blackberry|iemobile|mobile|palm") {
        set req.http.X-Device-Type = "mobile";
    } else {
        set req.http.X-Device-Type = "desktop";
    }
    
    # Backend selection based on content type
    if (req.url ~ "^/videos/") {
        set req.backend = F_video_origin;
        
        # Enable segmented caching for video files
        if (req.url ~ "\.(mp4|mov|m4v)$") {
            set req.enable_segmented_caching = true;
        }
    } else if (req.url ~ "^/images/") {
        set req.backend = F_image_origin;
    } else {
        set req.backend = F_main_origin;
    }
    
    # Pass for authenticated users
    if (req.http.Cookie ~ "session=") {
        return(pass);
    }
    
    # Default behavior
    return(lookup);
}

# Cache key generation
sub vcl_hash {
    # Default hash
    hash_data(req.url);
    
    if (req.http.host) {
        hash_data(req.http.host);
    } else {
        hash_data(server.ip);
    }
    
    # Vary cache by device type for articles
    if (req.url ~ "^/articles/") {
        hash_data(req.http.X-Device-Type);
    }
    
    return(hash);
}

# Cache hit processing
sub vcl_hit {
    # Handle PURGE requests
    if (req.method == "PURGE") {
        purge;
        error 200 "Purged";
    }
    
    return(deliver);
}

# Cache miss processing
sub vcl_miss {
    # Handle PURGE requests
    if (req.method == "PURGE") {
        purge;
        error 200 "Purged";
    }
    
    return(fetch);
}

# Backend response processing
sub vcl_fetch {
    # Set different cache TTLs based on content type
    if (req.url ~ "^/articles/") {
        # News articles: cache for 15 minutes
        set beresp.ttl = 15m;
        set beresp.grace = 4h;
        
        # Add surrogate key for purging
        set beresp.http.Surrogate-Key = "articles";
        if (req.url ~ "^/articles/([0-9]+)") {
            set beresp.http.Surrogate-Key = beresp.http.Surrogate-Key + " article-" + re.group.1;
        }
        
        # Extract category from URL if present
        if (req.url ~ "^/articles/[0-9]+/([^/]+)") {
            set beresp.http.Surrogate-Key = beresp.http.Surrogate-Key + " category-" + re.group.1;
        }
    } else if (req.url ~ "^/videos/") {
        # Videos: cache for 1 day
        set beresp.ttl = 1d;
        set beresp.grace = 7d;
        
        # Add surrogate key for purging
        set beresp.http.Surrogate-Key = "videos";
        if (req.url ~ "^/videos/([0-9]+)") {
            set beresp.http.Surrogate-Key = beresp.http.Surrogate-Key + " video-" + re.group.1;
        }
    } else if (req.url ~ "^/images/") {
        # Images: cache for 7 days
        set beresp.ttl = 7d;
        set beresp.grace = 7d;
        
        # Add surrogate key for purging
        set beresp.http.Surrogate-Key = "images";
    } else if (req.url ~ "\.(css|js)$") {
        # Static assets: cache for 1 day
        set beresp.ttl = 1d;
        set beresp.grace = 7d;
    } else {
        # Default: cache for 5 minutes
        set beresp.ttl = 5m;
        set beresp.grace = 1h;
    }
    
    # Don't cache error responses
    if (beresp.status >= 500) {
        set beresp.ttl = 0s;
    }
    
    # Enable gzip compression
    if (beresp.http.Content-Type ~ "text/" || 
        beresp.http.Content-Type ~ "application/json" || 
        beresp.http.Content-Type ~ "application/javascript" || 
        beresp.http.Content-Type ~ "application/xml") {
        set beresp.gzip = true;
    }
    
    # Enable ESI processing for HTML content
    if (beresp.http.Content-Type ~ "text/html") {
        set beresp.do_esi = true;
    }
    
    return(deliver);
}

# Error handling
sub vcl_error {
    # Custom 404 page
    if (obj.status == 404) {
        set obj.http.Content-Type = "text/html; charset=utf-8";
        set obj.response = "Not Found";
        synthetic {"
<!DOCTYPE html>
<html>
<head>
    <title>Content Not Found</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 50px; }
        h1 { color: #333; }
    </style>
</head>
<body>
    <h1>Content Not Found</h1>
    <p>The content you requested could not be found. Please check the URL and try again.</p>
    <p><a href="/">Return to homepage</a></p>
</body>
</html>
        "};
        return(deliver);
    }
    
    return(deliver);
}

# Response delivery
sub vcl_deliver {
    # Add cache status header
    if (obj.hits > 0) {
        set resp.http.X-Cache = "HIT";
        set resp.http.X-Cache-Hits = obj.hits;
    } else {
        set resp.http.X-Cache = "MISS";
    }
    
    # Add security headers
    set resp.http.Strict-Transport-Security = "max-age=31536000; includeSubDomains";
    set resp.http.X-Content-Type-Options = "nosniff";
    set resp.http.X-Frame-Options = "DENY";
    set resp.http.X-XSS-Protection = "1; mode=block";
    
    # Remove internal headers
    unset resp.http.Surrogate-Key;
    unset resp.http.X-Varnish;
    unset resp.http.Via;
    unset resp.http.X-Served-By;
    unset resp.http.X-Cache-Hits;
    unset resp.http.X-Timer;
    
    return(deliver);
}
```

## Example 3: API Gateway with Rate Limiting

This example demonstrates a VCL configuration for an API gateway with rate limiting, authentication, and request routing:

```vcl
# Define backends
backend F_api_v1 {
    .host = "api-v1.example.com";
    .port = "443";
    .ssl = true;
    .connect_timeout = 1s;
    .first_byte_timeout = 15s;
    .between_bytes_timeout = 10s;
}

backend F_api_v2 {
    .host = "api-v2.example.com";
    .port = "443";
    .ssl = true;
    .connect_timeout = 1s;
    .first_byte_timeout = 15s;
    .between_bytes_timeout = 10s;
}

# Define ACLs
acl internal_networks {
    "10.0.0.0"/8;
    "172.16.0.0"/12;
    "192.168.0.0"/16;
}

# VCL Initialization
sub vcl_init {
    # Initialize rate limiting
    # Create a rate counter with a 10-second window
    new rate_counter = ratecounter.open_window(10s);
    
    return(ok);
}

# Request processing
sub vcl_recv {
    # Set X-Forwarded-For header
    if (req.http.X-Forwarded-For) {
        set req.http.X-Forwarded-For = req.http.X-Forwarded-For + ", " + client.ip;
    } else {
        set req.http.X-Forwarded-For = client.ip;
    }
    
    # API version routing
    if (req.url ~ "^/v1/") {
        set req.backend = F_api_v1;
    } else if (req.url ~ "^/v2/") {
        set req.backend = F_api_v2;
    } else {
        # Default to latest version
        set req.backend = F_api_v2;
    }
    
    # Extract API key from header or query parameter
    declare local var.api_key STRING;
    
    if (req.http.Authorization ~ "^Bearer (.+)$") {
        set var.api_key = regsub(req.http.Authorization, "^Bearer (.+)$", "\1");
    } else if (req.url ~ "[?&]api_key=([^&]+)") {
        set var.api_key = regsub(req.url, ".*[?&]api_key=([^&]+).*", "\1");
        
        # Remove API key from URL to improve cache hit ratio
        set req.url = regsuball(req.url, "[?&]api_key=[^&]+", "");
        set req.url = regsuball(req.url, "\?&", "?");
        set req.url = regsub(req.url, "\?$", "");
    }
    
    # Set API key header for backend
    if (var.api_key != "") {
        set req.http.X-API-Key = var.api_key;
    }
    
    # Implement rate limiting
    # Skip rate limiting for internal networks
    if (client.ip !~ internal_networks) {
        # Use API key or client IP as the rate limiting key
        declare local var.rate_key STRING;
        
        if (var.api_key != "") {
            set var.rate_key = var.api_key;
        } else {
            set var.rate_key = client.ip;
        }
        
        # Increment rate counter
        declare local var.rate INTEGER;
        set var.rate = rate_counter.increment(var.rate_key, 1);
        
        # Set rate headers for debugging
        set req.http.X-RateLimit-Count = var.rate;
        
        # Apply rate limit (100 requests per 10 seconds)
        if (var.rate > 100) {
            error 429 "Too Many Requests";
        }
    }
    
    # Always pass API requests (don't cache)
    return(pass);
}

# Pass processing
sub vcl_pass {
    # Set backend request headers
    set bereq.http.X-Forwarded-For = req.http.X-Forwarded-For;
    
    return(pass);
}

# Backend response processing
sub vcl_fetch {
    # Set CORS headers
    set beresp.http.Access-Control-Allow-Origin = "*";
    set beresp.http.Access-Control-Allow-Methods = "GET, POST, PUT, DELETE, OPTIONS";
    set beresp.http.Access-Control-Allow-Headers = "Content-Type, Authorization, X-Requested-With";
    set beresp.http.Access-Control-Max-Age = "86400";
    
    return(deliver);
}

# Error handling
sub vcl_error {
    # Set Content-Type for all error responses
    set obj.http.Content-Type = "application/json; charset=utf-8";
    
    # CORS headers for errors
    set obj.http.Access-Control-Allow-Origin = "*";
    set obj.http.Access-Control-Allow-Methods = "GET, POST, PUT, DELETE, OPTIONS";
    set obj.http.Access-Control-Allow-Headers = "Content-Type, Authorization, X-Requested-With";
    
    # Custom error responses
    if (obj.status == 429) {
        set obj.response = "Too Many Requests";
        synthetic {"{"error": "Rate limit exceeded", "status": 429, "message": "You have exceeded the rate limit. Please try again later."}"};
        return(deliver);
    }
    
    if (obj.status == 401) {
        set obj.response = "Unauthorized";
        synthetic {"{"error": "Unauthorized", "status": 401, "message": "Authentication is required to access this resource."}"};
        return(deliver);
    }
    
    if (obj.status == 403) {
        set obj.response = "Forbidden";
        synthetic {"{"error": "Forbidden", "status": 403, "message": "You do not have permission to access this resource."}"};
        return(deliver);
    }
    
    if (obj.status == 404) {
        set obj.response = "Not Found";
        synthetic {"{"error": "Not found", "status": 404, "message": "The requested resource could not be found."}"};
        return(deliver);
    }
    
    # Generic error
    synthetic {"{"error": "Server error", "status": "} obj.status {", "message": "An error occurred while processing your request."}"};
    return(deliver);
}

# Response delivery
sub vcl_deliver {
    # Add rate limit headers
    if (req.http.X-RateLimit-Count) {
        set resp.http.X-RateLimit-Limit = "100";
        set resp.http.X-RateLimit-Remaining = "" + (100 - std.atoi(req.http.X-RateLimit-Count));
        set resp.http.X-RateLimit-Reset = "10";
    }
    
    # Add security headers
    set resp.http.Strict-Transport-Security = "max-age=31536000; includeSubDomains";
    
    # Remove internal headers
    unset resp.http.X-Varnish;
    unset resp.http.Via;
    unset resp.http.X-Served-By;
    unset resp.http.X-Cache;
    unset resp.http.X-Cache-Hits;
    unset resp.http.X-Timer;
    
    return(deliver);
}
```

## Best Practices for Production VCL

When implementing VCL for production use, consider these best practices:

1. **Start with a Minimal Configuration**: Begin with a minimal VCL configuration and add functionality incrementally.

2. **Test Thoroughly**: Test your VCL configuration in a staging environment before deploying to production.

3. **Use Version Control**: Store your VCL configuration in a version control system to track changes.

4. **Document Your Code**: Add comments to explain the purpose of each section of your VCL code.

5. **Implement Proper Error Handling**: Create custom error pages for common error scenarios.

6. **Set Appropriate Cache TTLs**: Choose TTL values based on how frequently your content changes.

7. **Use Surrogate Keys**: Implement surrogate keys for targeted cache invalidation.

8. **Monitor Performance**: Regularly monitor cache hit ratios and adjust your caching strategy accordingly.

9. **Implement Security Headers**: Add security headers to protect against common web vulnerabilities.

10. **Use Fastly's Debugging Tools**: Leverage Fastly's debugging headers and logging to troubleshoot issues.

11. **Consider Edge Cases**: Think about how your VCL code will handle edge cases, such as malformed requests or backend failures.

12. **Optimize for Performance**: Keep your VCL code efficient and avoid unnecessary operations.

These real-world examples demonstrate how to implement common patterns and best practices in Fastly VCL. You can use them as a starting point for your own VCL configurations, adapting them to your specific requirements.