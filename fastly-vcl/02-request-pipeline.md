# How Fastly Processes HTTP Requests: A Simple Guide

## Introduction

When you visit a website, your browser sends an HTTP request that travels through the internet to reach a server. Fastly sits between your browser and the origin server, acting as a helpful middleman that can speed things up and add special features.

This guide explains how Fastly processes these requests in a way that's easy to understand, even if you're new to the platform.

## The Big Picture: Request Journey

Think of Fastly like a smart postal service for the web. When a request arrives, it goes through several checkpoints, each with a specific job:

1. **Reception Desk** (`vcl_recv`): Greets the request and decides what to do with it
2. **Filing System** (`vcl_hash`): Creates a unique label to organize and find content
3. **Storage Check**: Looks for the requested content in storage
   - If found → **Found It!** (`vcl_hit`)
   - If not found → **Need to Get It** (`vcl_miss`)
4. **Retrieval** (`vcl_fetch`): Gets content from the origin server when needed
5. **Packaging** (`vcl_deliver`): Prepares the response before sending it back
6. **Record Keeping** (`vcl_log`): Takes notes about what happened

Each checkpoint can make decisions that affect where the request goes next. This flow of decisions is what we call the "request pipeline."

## Visual Journey Map

Here's a simplified map of how requests travel through Fastly:

```
                  ┌─────────────┐
                  │   Request   │
                  │   Arrives   │
                  └──────┬──────┘
                         │
                         ▼
                  ┌─────────────┐
                  │  Reception  │
                  │  (vcl_recv) │◄────────────┐
                  └──────┬──────┘             │
                         │                    │
                ┌────────┴────────┐           │
                │                 │           │
                ▼                 ▼           │
       ┌─────────────┐     ┌─────────────┐    │
       │ Skip Cache  │     │ Check Cache │    │
       │  (pass)     │     │  (lookup)   │    │
       └──────┬──────┘     └──────┬──────┘    │
              │                   │           │
              │                   │           │
              │             ┌─────┴─────┐     │
              │             │           │     │
              │             ▼           ▼     │
              │      ┌─────────┐  ┌─────────┐ │
              │      │ Found!  │  │Not Found│ │
              │      │(vcl_hit)│  │(vcl_miss)│ │
              │      └────┬────┘  └────┬────┘ │
              │           │            │      │
              │           │            ▼      │
              │           │      ┌──────────┐ │
              │           │      │ Get from │ │
              │           │      │  Origin  │ │
              │           │      │(vcl_fetch)│ │
              │           │      └────┬─────┘ │
              │           │           │       │
              ▼           ▼           ▼       │
       ┌─────────────────────────────────┐    │
       │         Package Response        │    │
       │          (vcl_deliver)          │    │
       └──────────────┬──────────────────┘    │
                      │                       │
                      ▼                       │
               ┌─────────────┐                │
               │ Record Log  │                │
               │ (vcl_log)   │                │
               └──────┬──────┘                │
                      │                       │
                      ▼                       │
               ┌─────────────┐                │
               │   Restart?  │────Yes─────────┘
               └──────┬──────┘
                      │No
                      ▼
               ┌─────────────┐
               │   Send to   │
               │   Browser   │
               └─────────────┘
```

## The Checkpoints Explained

Let's look at each checkpoint in more detail, with simple examples:

### 1. Reception Desk (vcl_recv)

**What it does**: This is where Fastly first meets your request. It can:
- Clean up the URL
- Check if you're logged in
- Decide which server should handle your request
- Block unwanted visitors

**Example**: Imagine you're visiting an online store. The reception desk might:
- Remove tracking parameters from the URL
- Check if you have a login cookie
- Send you to the mobile version if you're on a phone

```vcl
sub vcl_recv {
    # Remove tracking parameters from URL
    if (req.url ~ "(\?|&)(utm_source|utm_medium)=") {
        set req.url = regsuball(req.url, "&?(utm_source|utm_medium)=([^&]*)", "");
        set req.url = regsuball(req.url, "\?&", "?");
        set req.url = regsub(req.url, "\?$", "");
    }
    
    # Send API requests to a special server
    if (req.url ~ "^/api/") {
        set req.backend = F_api_server;
    }
    
    # Skip cache for logged-in users
    if (req.http.Cookie ~ "session=") {
        return(pass);
    }
}
```

### 2. Filing System (vcl_hash)

**What it does**: Creates a unique identifier (like a fingerprint) for the content. This helps Fastly find cached content quickly.

**Example**: When filing a product page, Fastly might consider:
- The URL
- The website name
- Whether you're on mobile or desktop
- Your country (for localized content)

```vcl
sub vcl_hash {
    # Basic information
    hash_data(req.url);
    hash_data(req.http.host);
    
    # Different versions for mobile and desktop
    if (req.http.User-Agent ~ "Mobile") {
        hash_data("mobile");
    } else {
        hash_data("desktop");
    }
}
```

### 3A. Found It! (vcl_hit)

**What it does**: Handles requests when the content is already in Fastly's cache.

**Example**: Fastly found the product page you requested in its cache. It can:
- Deliver it immediately
- Check if it's too old and needs refreshing
- Decide if you should get a personalized version instead

```vcl
sub vcl_hit {
    # Don't use cache for logged-in users
    if (req.http.Cookie ~ "session=") {
        return(pass);
    }
    
    # Use cached content even if origin is down
    if (!req.backend.healthy && obj.ttl + obj.grace > 0s) {
        return(deliver);
    }
}
```

### 3B. Need to Get It (vcl_miss)

**What it does**: Handles requests when the content is not in Fastly's cache.

**Example**: Fastly couldn't find the product page in its cache, so it needs to:
- Prepare to ask the origin server
- Set timeouts for how long to wait
- Add any special headers the origin needs

```vcl
sub vcl_miss {
    # Give more time for slow API responses
    if (req.url ~ "^/api/search") {
        set bereq.first_byte_timeout = 30s;
    }
    
    # Add a request ID for tracking
    set bereq.http.X-Request-ID = digest.hash_sha256(now + req.url);
}
```

### 4. Retrieval (vcl_fetch)

**What it does**: Processes the response from the origin server.

**Example**: Fastly got the product page from your website's server and now it can:
- Decide how long to keep it in cache
- Compress it to make it smaller
- Check if it's an error page
- Add special headers

```vcl
sub vcl_fetch {
    # Cache images longer than HTML pages
    if (beresp.http.Content-Type ~ "image/") {
        set beresp.ttl = 7d;  # 7 days
    } else if (beresp.http.Content-Type ~ "text/html") {
        set beresp.ttl = 1h;  # 1 hour
    }
    
    # Don't cache error pages
    if (beresp.status >= 500) {
        return(pass);
    }
    
    # Compress text content to save bandwidth
    if (beresp.http.Content-Type ~ "text/" || 
        beresp.http.Content-Type ~ "application/json") {
        set beresp.gzip = true;
    }
}
```

### 5. Packaging (vcl_deliver)

**What it does**: Prepares the final response before sending it to the user.

**Example**: Before sending the product page to the browser, Fastly can:
- Add security headers
- Remove internal headers
- Add debugging information
- Set cookies

```vcl
sub vcl_deliver {
    # Add cache status for debugging
    if (obj.hits > 0) {
        set resp.http.X-Cache = "HIT";
    } else {
        set resp.http.X-Cache = "MISS";
    }
    
    # Add security headers
    set resp.http.X-Content-Type-Options = "nosniff";
    set resp.http.X-Frame-Options = "DENY";
    
    # Remove internal headers
    unset resp.http.X-Varnish;
    unset resp.http.Via;
}
```

### 6. Record Keeping (vcl_log)

**What it does**: Records information about the request after it's been handled.

**Example**: After sending the product page, Fastly can log:
- Which page was requested
- Whether it was a cache hit or miss
- How long it took
- Any errors that occurred

```vcl
sub vcl_log {
    # Log basic request information
    log {"syslog "} req.service_id {" request :: "} 
        {"url="} req.url {" "}
        {"status="} resp.status {" "}
        {"cache="} fastly_info.state;
}
```

## Common Request Journeys

### Journey 1: Fast Path (Cache Hit)

When Fastly already has what you're looking for:

1. Request arrives at Reception (`vcl_recv`)
2. Filing System creates a label (`vcl_hash`)
3. Content is found in cache (`vcl_hit`)
4. Response is packaged (`vcl_deliver`)
5. Request is logged (`vcl_log`)
6. Response is sent to your browser

This is the fastest path because Fastly doesn't need to contact the origin server.

### Journey 2: Fetch Path (Cache Miss)

When Fastly needs to get fresh content:

1. Request arrives at Reception (`vcl_recv`)
2. Filing System creates a label (`vcl_hash`)
3. Content is not found in cache (`vcl_miss`)
4. Fastly asks the origin server for the content
5. Origin responds, and Fastly processes it (`vcl_fetch`)
6. Response is packaged (`vcl_deliver`)
7. Request is logged (`vcl_log`)
8. Response is sent to your browser and stored in cache

This takes a bit longer but happens only the first time content is requested.

### Journey 3: Bypass Path (Pass)

When Fastly needs to skip the cache:

1. Request arrives at Reception (`vcl_recv`) and is marked as "pass"
2. Fastly prepares to contact the origin (`vcl_pass`)
3. Fastly asks the origin server for the content
4. Origin responds, and Fastly processes it (`vcl_fetch`)
5. Response is packaged (`vcl_deliver`)
6. Request is logged (`vcl_log`)
7. Response is sent to your browser but not stored in cache

This is used for personalized or dynamic content that shouldn't be cached.

## Tips for Success

1. **Start Simple**: Begin with basic modifications and test thoroughly before adding complexity.

2. **Think About the Journey**: Always consider which path a request will take through the pipeline.

3. **Use Clear Conditions**: Make your if-statements clear and specific to avoid unexpected behavior.

4. **Test in Staging**: Always test your changes in a non-production environment first.

5. **Add Comments**: Explain what your code does and why, so others (and future you) can understand.

6. **Watch for Performance**: Keep your VCL code efficient since it runs on every request.

7. **Plan for Errors**: Consider what happens if the origin server is down or responds with errors.

## Next Steps

Now that you understand how requests flow through Fastly, you're ready to learn more about:

- VCL syntax and data types
- Backend configuration
- Caching strategies
- Real-world examples

Each of these topics is covered in detail in the following sections of this guide.