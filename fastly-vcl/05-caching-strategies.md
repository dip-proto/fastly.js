# Caching Strategies in Fastly VCL

## Introduction

Effective caching is at the heart of Fastly's CDN service. By properly configuring caching behavior, you can significantly improve performance, reduce origin load, and enhance the user experience. This document covers various caching strategies and how to implement them in Fastly VCL.

## Cache Control Basics

### TTL (Time To Live)

TTL defines how long an object should be cached before it's considered stale. In Fastly VCL, you can set TTL in `vcl_fetch`:

```vcl
sub vcl_fetch {
    # Cache for 1 hour
    set beresp.ttl = 1h;
}
```

### Grace Period

The grace period allows Fastly to serve stale content while fetching a fresh copy from the origin. This prevents users from experiencing delays when content expires:

```vcl
sub vcl_fetch {
    # Cache for 1 hour
    set beresp.ttl = 1h;
    
    # Allow serving stale content for up to 24 hours
    set beresp.grace = 24h;
}
```

### Stale-While-Revalidate

Stale-while-revalidate is a technique that allows Fastly to serve stale content while asynchronously revalidating it in the background:

```vcl
sub vcl_fetch {
    # Cache for 1 hour
    set beresp.ttl = 1h;
    
    # Allow serving stale content for up to 24 hours
    set beresp.grace = 24h;
    
    # Set stale-while-revalidate
    set beresp.stale_while_revalidate = 60s;
}
```

### Stale-If-Error

Stale-if-error allows Fastly to serve stale content when the origin returns an error:

```vcl
sub vcl_fetch {
    # Cache for 1 hour
    set beresp.ttl = 1h;
    
    # Serve stale content for up to 24 hours if the origin is down
    set beresp.stale_if_error = 24h;
}
```

## Cache Keys

The cache key determines how objects are stored and retrieved from the cache. By default, Fastly uses the URL and host as the cache key, but you can customize this in `vcl_hash`:

```vcl
sub vcl_hash {
    # Default hash
    hash_data(req.url);
    
    if (req.http.host) {
        hash_data(req.http.host);
    } else {
        hash_data(server.ip);
    }
    
    # Add custom components to the cache key
    if (req.http.X-Device-Type) {
        hash_data(req.http.X-Device-Type);
    }
    
    return(hash);
}
```

### URL Normalization

URL normalization helps improve cache hit ratios by ensuring that different URL variations that point to the same content use the same cache key:

```vcl
sub vcl_recv {
    # Remove trailing slash
    if (req.url.path ~ "(.+)/$") {
        set req.url = regsub(req.url, "/$", "");
    }
    
    # Convert to lowercase
    set req.url = std.tolower(req.url);
    
    # Remove query parameters that don't affect content
    if (req.url ~ "(\?|&)(utm_source|utm_medium|utm_campaign|gclid|fbclid)=") {
        set req.url = regsuball(req.url, "&?(utm_source|utm_medium|utm_campaign|gclid|fbclid)=([^&]*)", "");
        set req.url = regsuball(req.url, "\?&", "?");
        set req.url = regsub(req.url, "\?$", "");
    }
}
```

### Vary Headers

The Vary header tells Fastly to create different cache entries for the same URL based on the values of specific request headers:

```vcl
sub vcl_fetch {
    # Vary cache based on Accept-Encoding header
    if (beresp.http.Vary) {
        set beresp.http.Vary = beresp.http.Vary + ", Accept-Encoding";
    } else {
        set beresp.http.Vary = "Accept-Encoding";
    }
    
    # Vary cache based on User-Agent for mobile/desktop versions
    if (beresp.http.Vary !~ "User-Agent") {
        if (beresp.http.Vary) {
            set beresp.http.Vary = beresp.http.Vary + ", User-Agent";
        } else {
            set beresp.http.Vary = "User-Agent";
        }
    }
}
```

### Surrogate Keys

Surrogate keys allow you to tag cached objects with custom keys, which can be used for targeted purging:

```vcl
sub vcl_fetch {
    # Add surrogate keys
    if (req.url ~ "^/products/") {
        set beresp.http.Surrogate-Key = "products";
        
        # Extract product ID from URL
        if (req.url ~ "^/products/([0-9]+)") {
            set beresp.http.Surrogate-Key = beresp.http.Surrogate-Key + " product-" + re.group.1;
        }
    }
    
    if (req.url ~ "^/categories/") {
        set beresp.http.Surrogate-Key = "categories";
        
        # Extract category ID from URL
        if (req.url ~ "^/categories/([0-9]+)") {
            set beresp.http.Surrogate-Key = beresp.http.Surrogate-Key + " category-" + re.group.1;
        }
    }
}
```

## Content-Based Caching Strategies

### Cache by Content Type

Different types of content may require different caching strategies:

```vcl
sub vcl_fetch {
    # Set different cache TTLs based on content type
    if (beresp.http.Content-Type ~ "text/html") {
        # HTML content: cache for 1 hour
        set beresp.ttl = 1h;
    } else if (beresp.http.Content-Type ~ "image/") {
        # Images: cache for 7 days
        set beresp.ttl = 7d;
    } else if (beresp.http.Content-Type ~ "application/javascript") {
        # JavaScript: cache for 1 day
        set beresp.ttl = 1d;
    } else if (beresp.http.Content-Type ~ "text/css") {
        # CSS: cache for 1 day
        set beresp.ttl = 1d;
    } else {
        # Default: cache for 4 hours
        set beresp.ttl = 4h;
    }
}
```

### Cache by URL Pattern

You can also set different caching strategies based on URL patterns:

```vcl
sub vcl_fetch {
    # Set different cache TTLs based on URL patterns
    if (req.url ~ "^/api/") {
        # API responses: short cache
        set beresp.ttl = 5m;
    } else if (req.url ~ "^/static/") {
        # Static assets: long cache
        set beresp.ttl = 30d;
    } else if (req.url ~ "^/news/") {
        # News articles: medium cache
        set beresp.ttl = 4h;
    } else if (req.url ~ "^/search") {
        # Search results: short cache
        set beresp.ttl = 10m;
    } else {
        # Default: cache for 2 hours
        set beresp.ttl = 2h;
    }
}
```

### Cache by Response Status

Different response status codes may require different caching strategies:

```vcl
sub vcl_fetch {
    # Don't cache error responses
    if (beresp.status >= 500) {
        set beresp.ttl = 0s;
    }
    
    # Cache redirects for a short time
    if (beresp.status >= 300 && beresp.status < 400) {
        set beresp.ttl = 1h;
    }
    
    # Cache 404 responses for a short time
    if (beresp.status == 404) {
        set beresp.ttl = 5m;
    }
}
```

## Advanced Caching Techniques

### Edge Side Includes (ESI)

ESI allows you to cache different parts of a page for different durations:

```vcl
sub vcl_fetch {
    # Enable ESI processing
    if (beresp.http.Content-Type ~ "text/html") {
        set beresp.do_esi = true;
    }
}
```

In your HTML, you can include ESI tags:

```html
<html>
<head>
    <title>My Page</title>
</head>
<body>
    <div class="header">
        <esi:include src="/header" />
    </div>
    <div class="content">
        <!-- Main content -->
    </div>
    <div class="footer">
        <esi:include src="/footer" />
    </div>
</body>
</html>
```

### Segmented Caching

Segmented caching allows Fastly to cache large files in smaller segments, which can improve performance for large file downloads:

```vcl
sub vcl_recv {
    # Enable segmented caching for large files
    if (req.url ~ "\.mp4$" || req.url ~ "\.iso$") {
        set req.enable_segmented_caching = true;
    }
}
```

### Conditional Caching

You can conditionally cache content based on various factors:

```vcl
sub vcl_fetch {
    # Don't cache authenticated content
    if (req.http.Cookie ~ "session=") {
        set beresp.ttl = 0s;
    }
    
    # Don't cache personalized content
    if (beresp.http.Cache-Control ~ "private") {
        set beresp.ttl = 0s;
    }
    
    # Cache based on query parameters
    if (req.url ~ "\?(?:.*&)?nocache=true(?:&|$)") {
        set beresp.ttl = 0s;
    }
}
```

### Cache Compression

Enabling compression can reduce bandwidth usage and improve performance:

```vcl
sub vcl_fetch {
    # Enable gzip compression for text-based content
    if (beresp.http.Content-Type ~ "text/" || 
        beresp.http.Content-Type ~ "application/json" || 
        beresp.http.Content-Type ~ "application/javascript" || 
        beresp.http.Content-Type ~ "application/xml") {
        set beresp.gzip = true;
    }
}
```

### Cache Sharding

Cache sharding involves distributing cache across multiple servers based on some criteria:

```vcl
sub vcl_hash {
    # Default hash
    hash_data(req.url);
    hash_data(req.http.host);
    
    # Shard cache based on user ID
    if (req.http.Cookie ~ "user_id=([^;]+)") {
        declare local var.user_id STRING;
        set var.user_id = re.group.1;
        hash_data(var.user_id);
    }
    
    return(hash);
}
```

## Cache Invalidation Strategies

### Purging by URL

You can purge content by URL using Fastly's API or through VCL:

```vcl
sub vcl_recv {
    # Allow purging from specific IPs
    if (req.method == "PURGE") {
        if (client.ip !~ purge_acl) {
            error 403 "Forbidden";
        }
        return(lookup);
    }
}

sub vcl_hit {
    if (req.method == "PURGE") {
        purge;
        error 200 "Purged";
    }
}

sub vcl_miss {
    if (req.method == "PURGE") {
        purge;
        error 200 "Purged";
    }
}
```

### Purging by Surrogate Key

Surrogate keys allow for more targeted purging:

```vcl
# To purge all products:
# curl -X POST -H "Fastly-Key: YOUR_API_KEY" "https://api.fastly.com/service/YOUR_SERVICE_ID/purge/products"

# To purge a specific product:
# curl -X POST -H "Fastly-Key: YOUR_API_KEY" "https://api.fastly.com/service/YOUR_SERVICE_ID/purge/product-123"
```

### Soft Purging

Soft purging marks content as stale but allows it to be served while fresh content is being fetched:

```vcl
# To soft purge a URL:
# curl -X POST -H "Fastly-Key: YOUR_API_KEY" -H "Fastly-Soft-Purge: 1" "https://api.fastly.com/purge/https://www.example.com/path"
```

## Real-World Caching Strategies

### E-commerce Website

```vcl
sub vcl_recv {
    # Normalize URL
    if (req.url ~ "(\?|&)(utm_source|utm_medium|utm_campaign|gclid|fbclid)=") {
        set req.url = regsuball(req.url, "&?(utm_source|utm_medium|utm_campaign|gclid|fbclid)=([^&]*)", "");
        set req.url = regsuball(req.url, "\?&", "?");
        set req.url = regsub(req.url, "\?$", "");
    }
    
    # Pass requests with session cookies
    if (req.http.Cookie ~ "session=") {
        return(pass);
    }
    
    # Pass cart and checkout pages
    if (req.url ~ "^/cart" || req.url ~ "^/checkout") {
        return(pass);
    }
}

sub vcl_hash {
    # Default hash
    hash_data(req.url);
    hash_data(req.http.host);
    
    # Vary cache by currency
    if (req.http.X-Currency) {
        hash_data(req.http.X-Currency);
    }
    
    # Vary cache by device type
    if (req.http.User-Agent ~ "Mobile|Android|iPhone") {
        hash_data("mobile");
    } else {
        hash_data("desktop");
    }
    
    return(hash);
}

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
    } else {
        # Default: cache for 1 hour
        set beresp.ttl = 1h;
        set beresp.grace = 24h;
    }
    
    # Enable gzip compression
    if (beresp.http.Content-Type ~ "text/" || 
        beresp.http.Content-Type ~ "application/json" || 
        beresp.http.Content-Type ~ "application/javascript" || 
        beresp.http.Content-Type ~ "application/xml") {
        set beresp.gzip = true;
    }
}

sub vcl_deliver {
    # Add cache status header
    if (obj.hits > 0) {
        set resp.http.X-Cache = "HIT";
        set resp.http.X-Cache-Hits = obj.hits;
    } else {
        set resp.http.X-Cache = "MISS";
    }
    
    # Remove Surrogate-Key header before sending to client
    unset resp.http.Surrogate-Key;
}
```

### News Website

```vcl
sub vcl_recv {
    # Normalize URL
    if (req.url ~ "(\?|&)(utm_source|utm_medium|utm_campaign|gclid|fbclid)=") {
        set req.url = regsuball(req.url, "&?(utm_source|utm_medium|utm_campaign|gclid|fbclid)=([^&]*)", "");
        set req.url = regsuball(req.url, "\?&", "?");
        set req.url = regsub(req.url, "\?$", "");
    }
    
    # Pass requests with session cookies
    if (req.http.Cookie ~ "session=") {
        return(pass);
    }
}

sub vcl_hash {
    # Default hash
    hash_data(req.url);
    hash_data(req.http.host);
    
    # Vary cache by device type
    if (req.http.User-Agent ~ "Mobile|Android|iPhone") {
        hash_data("mobile");
    } else {
        hash_data("desktop");
    }
    
    return(hash);
}

sub vcl_fetch {
    # Set different cache TTLs based on content type
    if (req.url ~ "^/news/") {
        # News articles: cache for 15 minutes
        set beresp.ttl = 15m;
        set beresp.grace = 4h;
        
        # Add surrogate key for purging
        set beresp.http.Surrogate-Key = "news";
        if (req.url ~ "^/news/([0-9]+)") {
            set beresp.http.Surrogate-Key = beresp.http.Surrogate-Key + " article-" + re.group.1;
        }
    } else if (req.url ~ "^/topics/") {
        # Topic pages: cache for 30 minutes
        set beresp.ttl = 30m;
        set beresp.grace = 4h;
        
        # Add surrogate key for purging
        set beresp.http.Surrogate-Key = "topics";
        if (req.url ~ "^/topics/([^/]+)") {
            set beresp.http.Surrogate-Key = beresp.http.Surrogate-Key + " topic-" + re.group.1;
        }
    } else if (req.url ~ "\.(jpg|jpeg|png|gif)$") {
        # Images: cache for 1 day
        set beresp.ttl = 1d;
        set beresp.grace = 7d;
    } else if (req.url ~ "\.(css|js)$") {
        # Static assets: cache for 1 day
        set beresp.ttl = 1d;
        set beresp.grace = 7d;
    } else {
        # Default: cache for 5 minutes
        set beresp.ttl = 5m;
        set beresp.grace = 1h;
    }
    
    # Enable gzip compression
    if (beresp.http.Content-Type ~ "text/" || 
        beresp.http.Content-Type ~ "application/json" || 
        beresp.http.Content-Type ~ "application/javascript" || 
        beresp.http.Content-Type ~ "application/xml") {
        set beresp.gzip = true;
    }
}

sub vcl_deliver {
    # Add cache status header
    if (obj.hits > 0) {
        set resp.http.X-Cache = "HIT";
        set resp.http.X-Cache-Hits = obj.hits;
    } else {
        set resp.http.X-Cache = "MISS";
    }
    
    # Remove Surrogate-Key header before sending to client
    unset resp.http.Surrogate-Key;
}
```

## Best Practices

1. **Set Appropriate TTLs**: Choose TTL values based on how frequently your content changes.

2. **Use Grace Periods**: Implement grace periods to prevent users from experiencing delays when content expires.

3. **Normalize URLs**: Normalize URLs to improve cache hit ratios.

4. **Use Surrogate Keys**: Implement surrogate keys for targeted cache invalidation.

5. **Consider Vary Headers**: Use Vary headers carefully to avoid cache fragmentation.

6. **Monitor Cache Performance**: Regularly monitor cache hit ratios and adjust your caching strategy accordingly.

7. **Test Cache Behavior**: Test your caching strategy in a staging environment before deploying to production.

8. **Document Your Caching Strategy**: Keep documentation of your caching strategy, including TTL values, cache keys, and invalidation methods.

In the next section, we'll explore real-world examples of Fastly VCL implementations.