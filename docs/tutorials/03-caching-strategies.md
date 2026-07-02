# Caching Strategies in VCL

This tutorial covers how to implement various caching strategies in VCL, including TTL-based caching, cache variations, and cache invalidation.

## Caching Basics

Caching is the process of storing responses from backends and serving them directly to clients without contacting the backend again. Fastly.JS supports TTL-based caching, grace periods, and stale-while-revalidate.

### The Caching Process

1. When a request is received, Fastly.JS executes `vcl_recv` to determine whether to look up the request in cache or pass it to the backend.
2. If `vcl_recv` returns `lookup`, Fastly.JS generates a cache key using `vcl_hash` and checks if the request is in cache.
3. If the request is in cache, Fastly.JS executes `vcl_hit` and delivers the cached response.
4. If the request is not in cache, Fastly.JS executes `vcl_miss`, fetches the response from the backend, and executes `vcl_fetch` to determine whether to cache the response.
5. If `vcl_fetch` returns `deliver`, Fastly.JS caches the response (if cacheable) and delivers it to the client.

## TTL-Based Caching

TTL (Time To Live) is the amount of time a response is considered fresh and can be served from cache without contacting the backend.

### Setting TTL

You can set the TTL for a response in `vcl_fetch`:

```vcl
sub vcl_fetch {
  # Set TTL to 1 hour
  set beresp.ttl = 1h;
}
```

### Setting TTL Based on Content Type

You can set different TTLs for different types of content:

```vcl
sub vcl_fetch {
  # Cache static assets for 1 day
  if (beresp.http.content-type ~ "image/" || req.url ~ "\.(css|js)$") {
    set beresp.ttl = 1d;
  }
  # Cache HTML for 5 minutes
  else if (beresp.http.content-type ~ "text/html") {
    set beresp.ttl = 5m;
  }
  # Cache everything else for 1 hour
  else {
    set beresp.ttl = 1h;
  }
}
```

### Cache-Control Headers and the Default TTL

Fastly.JS does not derive the TTL from the backend's `Cache-Control` header. If `vcl_fetch` finishes with `beresp.ttl` unset, a default of 5 minutes is applied (along with a 1 hour grace period and 10 seconds of stale-while-revalidate). To honor `Cache-Control`, inspect the header yourself:

```vcl
sub vcl_fetch {
  # Use the backend's max-age when present
  if (beresp.http.cache-control ~ "max-age=(\d+)") {
    set beresp.ttl = std.atoi(re.group.1);
  }
  # Otherwise, set a default TTL
  else {
    set beresp.ttl = 1h;
  }
}
```

## Grace Periods

Grace periods allow Fastly.JS to keep serving stale content after the TTL has expired. A stale response is delivered with `X-Cache: HIT-STALE`, and the next request for the same object fetches a fresh copy from the backend.

### Setting Grace Periods

You can set grace periods in `vcl_fetch`:

```vcl
sub vcl_fetch {
  # Set TTL to 1 hour
  set beresp.ttl = 1h;
  
  # Set grace period to 24 hours
  set beresp.grace = 24h;
}
```

### Stale-While-Revalidate

`stale_while_revalidate` extends the window during which a stale object may still be served. As with the grace period, the refresh happens on the request that follows a stale delivery rather than in the background.

```vcl
sub vcl_fetch {
  # Set TTL to 1 hour
  set beresp.ttl = 1h;
  
  # Set stale-while-revalidate to 10 seconds
  set beresp.stale_while_revalidate = 10s;
}
```

## Cache Variations

Cache variations allow you to cache different versions of the same URL based on request attributes like headers, cookies, or query parameters.

### Varying on Headers

You can vary cache based on request headers:

```vcl
sub vcl_hash {
  # Hash based on URL and host
  hash_data(req.url);
  hash_data(req.http.host);
  
  # Vary cache based on User-Agent
  if (req.http.user-agent) {
    hash_data(req.http.user-agent);
  }
  
  # Vary cache based on Accept-Language
  if (req.http.accept-language) {
    hash_data(req.http.accept-language);
  }
  
  return(hash);
}
```

### Varying on Cookies

You can vary cache based on cookies:

```vcl
sub vcl_hash {
  # Hash based on URL and host
  hash_data(req.url);
  hash_data(req.http.host);
  
  # Vary cache based on a specific cookie
  if (req.http.cookie ~ "user_pref=") {
    set req.http.X-User-Pref = regsub(req.http.cookie, ".*user_pref=([^;]+).*", "\1");
    hash_data(req.http.X-User-Pref);
  }
  
  return(hash);
}
```

### Varying on Query Parameters

You can vary cache based on query parameters:

```vcl
sub vcl_hash {
  # Hash based on URL (including query parameters) and host
  hash_data(req.url);
  hash_data(req.http.host);
  
  return(hash);
}
```

Or you can be more selective about which query parameters to include in the cache key:

```vcl
sub vcl_recv {
  # Only include specific query parameters in the cache key
  set req.url = querystring.filter_except(req.url, "id,version");
}

sub vcl_hash {
  # Hash based on filtered URL and host
  hash_data(req.url);
  hash_data(req.http.host);
  
  return(hash);
}
```

## Cache Invalidation

Cache invalidation allows you to remove items from the cache before they expire.

### Purging

Fastly VCL has a `purge` return action in `vcl_recv`, and Fastly.JS accepts the syntax:

```vcl
sub vcl_recv {
  if (req.method == "PURGE") {
    return(purge);
  }
}
```

However, cache invalidation is not implemented yet: returning `purge` currently behaves like a `pass` and leaves the cached object in place. In practice, objects leave the cache when their TTL (plus grace and stale-while-revalidate) expires, or when the cache is cleared programmatically (the cache handed to the pipeline is a plain JavaScript `Map`).

### Surrogate Keys

Surrogate keys allow you to tag cached objects and purge them as a group. Fastly.JS doesn't natively support surrogate keys, but you can simulate them using custom headers:

```vcl
sub vcl_fetch {
  # Tag the response with surrogate keys
  set beresp.http.Surrogate-Key = "key1 key2 key3";
}

sub vcl_deliver {
  # Remove the Surrogate-Key header before sending to the client
  unset resp.http.Surrogate-Key;
}
```

Then, to purge all objects with a specific key, you would need to implement a custom purging mechanism in your application.

## Preventing Caching

Sometimes you want to prevent caching for certain types of content or requests.

### Passing in vcl_recv

You can bypass the cache and send the request directly to the backend using the `pass` return value in `vcl_recv`:

```vcl
sub vcl_recv {
  # Don't cache POST requests
  if (req.method == "POST") {
    return(pass);
  }
  
  # Don't cache requests with authentication
  if (req.http.authorization) {
    return(pass);
  }
  
  # Don't cache requests with certain cookies
  if (req.http.cookie ~ "session=") {
    return(pass);
  }
  
  # Continue to cache lookup for other requests
  return(lookup);
}
```

### Passing in vcl_fetch

Be careful with `set beresp.ttl = 0s;`: a TTL of exactly 0 is treated as "unset", so the default 5 minute TTL is applied and the response gets cached anyway. To keep a backend response out of the cache, return `pass` from `vcl_fetch`:

```vcl
sub vcl_fetch {
  # Don't cache error responses
  if (beresp.status >= 500) {
    return(pass);
  }
  
  # Don't cache responses with certain headers
  if (beresp.http.cache-control ~ "private" || beresp.http.cache-control ~ "no-store") {
    return(pass);
  }

  return(deliver);
}
```

## Debugging Cache Behavior

You can add debug headers to help understand cache behavior:

```vcl
sub vcl_fetch {
  # Add debug headers
  set beresp.http.X-Cache-TTL = beresp.ttl;
  set beresp.http.X-Cache-Grace = beresp.grace;
  set beresp.http.X-Cache-SWR = beresp.stale_while_revalidate;
}

sub vcl_deliver {
  # Add cache status header
  if (obj.hits > 0) {
    set resp.http.X-Cache = "HIT";
    set resp.http.X-Cache-Hits = obj.hits;
  } else {
    set resp.http.X-Cache = "MISS";
  }
  
  # Remove debug headers in production
  # unset resp.http.X-Cache-TTL;
  # unset resp.http.X-Cache-Grace;
  # unset resp.http.X-Cache-SWR;
}
```

## Next Steps

Now that you understand caching strategies in VCL, you can move on to the next tutorial: [Backend Configuration](./04-backend-configuration.md).
