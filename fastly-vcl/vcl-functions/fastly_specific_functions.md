# Fastly-specific Functions

This file demonstrates comprehensive examples of Fastly-specific Functions in VCL.
These functions are unique to Fastly's platform and provide specialized capabilities
for edge computing, performance optimization, and service configuration.

## fastly.hash

Returns a hash value of the string key, using seed, and returning a number between from and to, inclusive.

### Syntax

```vcl
INTEGER fastly.hash(STRING key, INTEGER seed, INTEGER from, INTEGER to)
```

### Parameters

- `key`: The string to hash
- `seed`: A seed value for the hash function (must be an integer literal)
- `from`: The lower bound of the range for the returned hash value (must be an integer literal)
- `to`: The upper bound of the range for the returned hash value (must be an integer literal)

### Return Value

An integer between from and to, inclusive

### Note

The underlying hash function might not offer cryptographic properties or collision resistance guarantees

### Examples

#### Basic hash generation

```vcl
declare local var.hash_value INTEGER;

# Generate a hash value between 0 and 1000
set var.hash_value = fastly.hash(req.url, 0, 0, 1000);

# Use the hash value for various purposes
set req.http.X-Hash-Value = var.hash_value;
```

#### Consistent hashing for A/B testing

This example demonstrates how to use fastly.hash for A/B testing:

```vcl
declare local var.ab_bucket INTEGER;
declare local var.user_id STRING;

# Get a stable identifier for the user
if (req.http.Cookie:user_id) {
  set var.user_id = req.http.Cookie:user_id;
} else if (req.http.X-User-ID) {
  set var.user_id = req.http.X-User-ID;
} else {
  # Fallback to IP address if no user ID is available
  set var.user_id = client.ip;
}

# Generate a hash value between 1 and 100 for percentage-based bucketing
set var.ab_bucket = fastly.hash(var.user_id, 42, 1, 100);

# Assign users to test groups based on the hash value
if (var.ab_bucket <= 10) {
  # 10% of users in test group A
  set req.http.X-AB-Test-Group = "A";
} else if (var.ab_bucket <= 20) {
  # 10% of users in test group B
  set req.http.X-AB-Test-Group = "B";
} else {
  # 80% of users in control group
  set req.http.X-AB-Test-Group = "control";
}
```

#### Load balancing with weighted distribution

This example demonstrates how to use fastly.hash for custom load balancing:

```vcl
declare local var.backend_selection INTEGER;
declare local var.request_key STRING;

# Create a key based on the request URL and a stable identifier
set var.request_key = req.url + var.user_id;

# Generate a hash value for backend selection
# Using a different seed than the A/B test to avoid correlation
set var.backend_selection = fastly.hash(var.request_key, 123, 1, 100);

# Distribute traffic across backends with different weights
if (var.backend_selection <= 60) {
  # 60% of traffic to primary backend
  set req.backend = F_primary_backend;
} else if (var.backend_selection <= 85) {
  # 25% of traffic to secondary backend
  set req.backend = F_secondary_backend;
} else {
  # 15% of traffic to tertiary backend
  set req.backend = F_tertiary_backend;
}
```

#### Feature flagging system

This example demonstrates how to implement feature flags using fastly.hash:

```vcl
declare local var.feature_hash INTEGER;
declare local var.feature_key STRING;

# Set up feature flags with different rollout percentages
if (req.url ~ "^/app/") {
  # Feature: New UI
  set var.feature_key = "new_ui_" + var.user_id;
  set var.feature_hash = fastly.hash(var.feature_key, 456, 1, 100);
  
  if (var.feature_hash <= 25) {
    # 25% rollout of new UI
    set req.http.X-Feature-New-UI = "enabled";
  }
  
  # Feature: Enhanced Search
  set var.feature_key = "enhanced_search_" + var.user_id;
  set var.feature_hash = fastly.hash(var.feature_key, 789, 1, 100);
  
  if (var.feature_hash <= 50) {
    # 50% rollout of enhanced search
    set req.http.X-Feature-Enhanced-Search = "enabled";
  }
}
```

## fastly.try_select_shield

Returns the shield backend named in the first argument if it is healthy and available; otherwise returns the fallback backend given as the second argument.

### Syntax

```vcl
BACKEND fastly.try_select_shield(BACKEND shield, BACKEND fallback)
```

### Parameters

- `shield`: The shield POP backend to try (shield backends are named `ssl_shield_` followed by the POP identifier, e.g. `ssl_shield_iad-va-us`)
- `fallback`: The backend to return if the shield is unhealthy or unavailable

### Return Value

The shield backend if it can be used, otherwise the fallback backend

### Examples

#### Basic shield selection with fallback to the origin

```vcl
# Route through the IAD shield when possible, otherwise go straight to origin
set req.backend = fastly.try_select_shield(ssl_shield_iad-va-us, F_origin);
```

#### Location-based shield selection

```vcl
# Pick a shield close to the client, falling back to the origin
if (client.geo.continent_code == "EU") {
  set req.backend = fastly.try_select_shield(ssl_shield_london-uk, F_origin);
} else if (client.geo.continent_code == "AS") {
  set req.backend = fastly.try_select_shield(ssl_shield_tokyo-jp, F_origin);
} else {
  set req.backend = fastly.try_select_shield(ssl_shield_iad-va-us, F_origin);
}
```

#### Chained shield selection

Because the function returns a backend, calls can be nested to express a preference order:

```vcl
# Prefer the primary shield, then the backup shield, then the origin
set req.backend = fastly.try_select_shield(ssl_shield_london-uk,
    fastly.try_select_shield(ssl_shield_amsterdam-nl, F_origin));
```
## h2.push

Triggers an HTTP/2 server push of the asset at the specified path.

### Syntax

```vcl
h2.push(STRING resource [, STRING as])
```

### Parameters

- `resource`: The path of the asset to push
- `as`: Optional content type hint for the pushed resource

### Return Value

None

### Examples

#### Basic HTTP/2 server push

This example demonstrates how to push critical assets to the client:

```vcl
# Only push if the client supports HTTP/2
if (fastly.info.is_h2 && !req.http.Fastly-FF) {
  # Push critical assets for the homepage
  if (req.url == "/" || req.url == "/index.html") {
    h2.push("/css/main.css");
    h2.push("/js/main.js");
    h2.push("/images/logo.png");
  }
  
  # Push critical assets for the product page
  if (req.url ~ "^/products/[^/]+$") {
    h2.push("/css/product.css");
    h2.push("/js/product.js");
    h2.push("/js/reviews.js");
  }
}
```

#### Conditional HTTP/2 server push based on client capabilities

This example demonstrates more sophisticated push strategies:

```vcl
# Only push if the client supports HTTP/2 and doesn't have the assets cached
if (fastly.info.is_h2 && !req.http.Fastly-FF) {
  # Check for client hints about what resources it already has
  declare local var.should_push_css BOOL;
  declare local var.should_push_js BOOL;
  
  set var.should_push_css = true;
  set var.should_push_js = true;
  
  # If the client indicates it already has the CSS cached, don't push it
  if (req.http.If-None-Match && req.http.If-None-Match ~ "css-fingerprint") {
    set var.should_push_css = false;
  }
  
  # If the client indicates it already has the JS cached, don't push it
  if (req.http.If-None-Match && req.http.If-None-Match ~ "js-fingerprint") {
    set var.should_push_js = false;
  }
  
  # Push only what the client needs
  if (var.should_push_css) {
    h2.push("/css/main.css");
  }
  
  if (var.should_push_js) {
    h2.push("/js/main.js");
  }
  
  # Always push critical images
  h2.push("/images/hero.jpg");
}
```

#### Resource prioritization with HTTP/2 server push

This example demonstrates how to prioritize pushed resources:

```vcl
if (fastly.info.is_h2 && !req.http.Fastly-FF) {
  # For SPA (Single Page Application)
  if (req.url == "/app") {
    # First push the critical CSS for above-the-fold content
    h2.push("/css/critical.css");
    
    # Then push the app shell JavaScript
    h2.push("/js/app-shell.js");
    
    # Then push the main application bundle
    h2.push("/js/app.js");
    
    # Finally push non-critical resources
    h2.push("/css/non-critical.css");
    h2.push("/js/analytics.js");
  }
}
```

## h2.disable_header_compression

Disables HTTP/2 header compression for the named response headers, so their values are never entered into the HPACK dynamic table.

### Syntax

```vcl
h2.disable_header_compression(STRING header_name, ...)
```

### Parameters

- `header_name`: One or more header names for which compression should be disabled

### Return Value

None

### Examples

#### Disabling HTTP/2 header compression for sensitive headers

```vcl
# Check if this is a security-sensitive context
if (req.url ~ "^/admin/" || req.url ~ "^/account/") {
  # Keep sensitive header values out of the HPACK dynamic table
  # to mitigate compression side-channel attacks
  h2.disable_header_compression("Authorization", "Set-Cookie");
  
  # Log the action
  log "Disabled HTTP/2 header compression for security-sensitive path: " + req.url;
}
```

## h3.alt_svc

Adds an Alt-Svc header to the response to advertise HTTP/3 support.

### Syntax

```vcl
h3.alt_svc()
```

### Parameters

None

### Return Value

None

### Examples

#### Advertising HTTP/3 support

```vcl
# Add an Alt-Svc header to advertise HTTP/3 support
h3.alt_svc();
```

## early_hints

Sends an HTTP 103 Early Hints response with Link headers. The function is variadic: several Link values can be passed in a single call.

### Syntax

```vcl
early_hints(STRING link_header, ...)
```

### Parameters

- `link_header`: One or more Link header values to include in the Early Hints response

### Return Value

None

### Examples

#### Basic Early Hints usage

This example demonstrates how to send Early Hints for critical resources:

```vcl
# Only send Early Hints for HTML pages
if (req.url.ext == "html" || req.url == "/" || req.url !~ "\.[a-z]+$") {
  # Send Early Hints for critical CSS and JavaScript
  early_hints("</css/main.css>; rel=preload; as=style");
  early_hints("</js/main.js>; rel=preload; as=script");
  
  # Send Early Hints for critical fonts
  early_hints("</fonts/roboto.woff2>; rel=preload; as=font; crossorigin");
}
```

#### Page-specific Early Hints

This example demonstrates how to send different Early Hints for different pages:

```vcl
if (req.url == "/" || req.url == "/index.html") {
  # Homepage-specific resources
  early_hints("</css/home.css>; rel=preload; as=style");
  early_hints("</js/home.js>; rel=preload; as=script");
  early_hints("</images/hero.jpg>; rel=preload; as=image");
} else if (req.url ~ "^/products/") {
  # Product page-specific resources
  early_hints("</css/product.css>; rel=preload; as=style");
  early_hints("</js/product.js>; rel=preload; as=script");
  early_hints("</js/reviews.js>; rel=preload; as=script");
} else if (req.url ~ "^/blog/") {
  # Blog page-specific resources
  early_hints("</css/blog.css>; rel=preload; as=style");
  early_hints("</js/blog.js>; rel=preload; as=script");
  early_hints("</fonts/serif.woff2>; rel=preload; as=font; crossorigin");
}
```

#### Combining Early Hints with HTTP/2 Server Push

This example demonstrates how to use both technologies together:

```vcl
# Send Early Hints for all browsers
early_hints("</css/critical.css>; rel=preload; as=style");
early_hints("</js/critical.js>; rel=preload; as=script");

# HTTP/2 Server Push will be handled in vcl_deliver for HTTP/2 clients
# (see h2.push examples above)
```
## Integrated Example: Performance Optimization System

This example demonstrates how multiple Fastly-specific functions can work together to create a comprehensive performance optimization system.

```vcl
sub vcl_recv {
  # Step 1: Route through the closest shield POP, falling back to the origin
  if (client.geo.continent_code == "EU") {
    set req.backend = fastly.try_select_shield(ssl_shield_london-uk, F_origin);
  } else if (client.geo.continent_code == "AS") {
    set req.backend = fastly.try_select_shield(ssl_shield_tokyo-jp, F_origin);
  } else {
    set req.backend = fastly.try_select_shield(ssl_shield_iad-va-us, F_origin);
  }
  
  # Step 2: Send Early Hints for critical resources based on the page type
  # (VCL has no loops, so each page type lists its resources explicitly)
  if (req.url == "/" || req.url == "/index.html") {
    early_hints(
      "</css/critical.css>; rel=preload; as=style",
      "</css/home.css>; rel=preload; as=style",
      "</js/home.js>; rel=preload; as=script",
      "</fonts/roboto.woff2>; rel=preload; as=font; crossorigin");
  } else if (req.url ~ "^/products/") {
    early_hints(
      "</css/critical.css>; rel=preload; as=style",
      "</css/product.css>; rel=preload; as=style",
      "</js/product.js>; rel=preload; as=script");
  } else {
    early_hints(
      "</css/critical.css>; rel=preload; as=style",
      "</js/main.js>; rel=preload; as=script");
  }
  
  # Step 3: A/B testing for performance optimizations
  declare local var.user_id STRING;
  declare local var.perf_test_bucket INTEGER;
  
  # Get a stable identifier for the user
  if (req.http.Cookie:user_id) {
    set var.user_id = req.http.Cookie:user_id;
  } else {
    # Fallback to IP address if no user ID is available
    set var.user_id = client.ip;
  }
  
  # Assign users to performance test groups
  set var.perf_test_bucket = fastly.hash(var.user_id, 789, 1, 100);
  
  if (var.perf_test_bucket <= 25) {
    # 25% of users get aggressive optimization
    set req.http.X-Perf-Optimization = "aggressive";
  } else if (var.perf_test_bucket <= 50) {
    # 25% of users get standard optimization
    set req.http.X-Perf-Optimization = "standard";
  } else {
    # 50% of users get no optimization (control group)
    set req.http.X-Perf-Optimization = "none";
  }
}

sub vcl_deliver {
  # Step 4: HTTP/2 Server Push for critical resources
  
  # Only push if the client supports HTTP/2 and based on optimization level
  if (fastly.info.is_h2 && !req.http.Fastly-FF) {
    if (req.http.X-Perf-Optimization == "aggressive") {
      # Push all critical resources
      h2.push("/css/critical.css");
      h2.push("/js/main.js");
      h2.push("/images/logo.png");
    } else if (req.http.X-Perf-Optimization == "standard") {
      # Push only the critical CSS
      h2.push("/css/critical.css");
    }
    # No push for the control group
  }
  
  # Step 5: HTTP/3 support advertisement
  # Add an Alt-Svc header to advertise HTTP/3 support
  h3.alt_svc();
  
  # Step 6: Set performance-related response headers for analytics
  set resp.http.X-Perf-Optimization = req.http.X-Perf-Optimization;
  set resp.http.X-HTTP-Version = if(fastly.info.is_h3, "HTTP/3", 
                                 if(fastly.info.is_h2, "HTTP/2", "HTTP/1.1"));
}
```

## Best Practices for Fastly-specific Functions

1. Shield Selection:
   - Choose shields based on client geography for optimal performance
   - Always provide a sensible fallback backend as the second argument
   - Monitor shield performance and adjust selection logic accordingly

2. HTTP/2 Server Push:
   - Only push critical resources needed for initial rendering
   - Avoid pushing resources that are likely already cached
   - Consider the performance impact of pushing too many resources
   - Use Early Hints as a fallback for browsers that don't support HTTP/2

3. Early Hints:
   - Send Early Hints for critical CSS and JavaScript
   - Customize Early Hints based on the page type
   - Combine with HTTP/2 Server Push for comprehensive optimization

4. A/B Testing with fastly.hash:
   - Use consistent hashing for stable test groups
   - Choose appropriate seed values to avoid correlation between tests
   - Implement percentage-based bucketing for gradual feature rollouts

5. HTTP/3 Support:
   - Advertise HTTP/3 support using h3.alt_svc
   - Set appropriate max-age values for Alt-Svc headers
   - Monitor HTTP/3 adoption and performance

6. Security Considerations:
   - Disable HTTP/2 header compression for security-sensitive contexts
   - Implement proper access controls for service chaining
   - Use secure random seeds for hash-based functions

7. Performance Monitoring:
   - Set debug headers to track which optimizations were applied
   - Log performance metrics for different optimization strategies
   - Use A/B testing to measure the impact of optimizations