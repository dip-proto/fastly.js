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
- `seed`: A seed value for the hash function
- `from`: The lower bound of the range for the returned hash value
- `to`: The upper bound of the range for the returned hash value

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
## fastly.ff.last_hop_was_serviceid

Determines if the last hop in a Fastly-Fastly request chain was from the specified service ID.

### Syntax

```vcl
BOOL fastly.ff.last_hop_was_serviceid(STRING service_id)
```

### Parameters

- `service_id`: The Fastly service ID to check against

### Return Value

- TRUE if the last hop was from the specified service ID
- FALSE otherwise

### Examples

#### Basic service chaining verification

```vcl
declare local var.trusted_service_id STRING;
declare local var.is_from_trusted_service BOOL;

# Set the trusted service ID
set var.trusted_service_id = "SU1Z0isxPaozGVKXdv0eY";

# Check if the request came from the trusted service
set var.is_from_trusted_service = fastly.ff.last_hop_was_serviceid(var.trusted_service_id);

# Take action based on the result
if (var.is_from_trusted_service) {
  # Request came from a trusted service, allow special operations
  set req.http.X-Trusted-Service = "true";
} else {
  # Request did not come from a trusted service
  set req.http.X-Trusted-Service = "false";
  
  # Optionally block certain paths from untrusted sources
  if (req.url ~ "^/admin/") {
    error 403 "Access denied";
  }
}
```

#### Multi-service architecture with service chaining

This example demonstrates how to implement a multi-service architecture:

```vcl
declare local var.auth_service_id STRING;
declare local var.api_gateway_id STRING;

set var.auth_service_id = "a1b2c3d4e5f6g7h8i9j0";
set var.api_gateway_id = "z9y8x7w6v5u4t3s2r1q0";

# Check if the request came through the proper service chain
if (fastly.ff.last_hop_was_serviceid(var.auth_service_id)) {
  # Request has been authenticated by the auth service
  set req.http.X-Auth-Status = "verified";
} else if (fastly.ff.last_hop_was_serviceid(var.api_gateway_id)) {
  # Request came through the API gateway but bypassed auth
  set req.http.X-Auth-Status = "bypassed";
  
  # Check if this is an allowed public endpoint
  if (req.url !~ "^/public/") {
    error 401 "Authentication required";
  }
} else {
  # Request did not come through the expected service chain
  set req.http.X-Auth-Status = "unknown";
  
  # Only allow public endpoints
  if (req.url !~ "^/public/") {
    error 403 "Direct access not allowed";
  }
}
```

## fastly.try_select_shield

Attempts to select a shield POP based on the client's location.

### Syntax

```vcl
BOOL fastly.try_select_shield(STRING shield_name)
```

### Parameters

- `shield_name`: The name of the shield POP to try to select

### Return Value

- TRUE if the shield was successfully selected
- FALSE otherwise

### Examples

#### Basic shield selection

```vcl
declare local var.shield_selected BOOL;

# Try to select a shield based on the client's location
if (client.geo.continent_code == "EU") {
  set var.shield_selected = fastly.try_select_shield("london-uk");
} else if (client.geo.continent_code == "AS") {
  set var.shield_selected = fastly.try_select_shield("tokyo-jp");
} else if (client.geo.continent_code == "OC") {
  set var.shield_selected = fastly.try_select_shield("sydney-au");
} else if (client.geo.country_code == "US" && client.geo.region ~ "^(CA|OR|WA)$") {
  set var.shield_selected = fastly.try_select_shield("seattle-wa");
} else if (client.geo.country_code == "US") {
  set var.shield_selected = fastly.try_select_shield("ashburn-va");
} else {
  # Default shield for other locations
  set var.shield_selected = fastly.try_select_shield("ashburn-va");
}

# Log the shield selection result
if (var.shield_selected) {
  log "Shield selected successfully";
} else {
  log "Shield selection failed, using default routing";
}
```

#### Advanced shield selection with fallbacks

This example demonstrates a more sophisticated shield selection strategy:

```vcl
declare local var.primary_shield STRING;
declare local var.backup_shield STRING;
declare local var.primary_selected BOOL;
declare local var.backup_selected BOOL;

# Determine the appropriate shields based on client location
if (client.geo.continent_code == "EU") {
  set var.primary_shield = "london-uk";
  set var.backup_shield = "amsterdam-nl";
} else if (client.geo.continent_code == "AS") {
  if (client.geo.country_code == "JP" || client.geo.country_code == "KR") {
    set var.primary_shield = "tokyo-jp";
    set var.backup_shield = "osaka-jp";
  } else if (client.geo.country_code == "SG" || client.geo.country_code == "MY" || client.geo.country_code == "ID") {
    set var.primary_shield = "singapore-sg";
    set var.backup_shield = "hong-kong-hk";
  } else {
    set var.primary_shield = "hong-kong-hk";
    set var.backup_shield = "singapore-sg";
  }
} else if (client.geo.continent_code == "OC") {
  set var.primary_shield = "sydney-au";
  set var.backup_shield = "auckland-nz";
} else if (client.geo.country_code == "US") {
  if (client.geo.region ~ "^(CA|OR|WA|NV|ID|MT)$") {
    set var.primary_shield = "seattle-wa";
    set var.backup_shield = "san-jose-ca";
  } else if (client.geo.region ~ "^(NY|MA|CT|RI|NH|VT|ME|NJ|PA|DE|MD|DC)$") {
    set var.primary_shield = "newark-nj";
    set var.backup_shield = "ashburn-va";
  } else {
    set var.primary_shield = "ashburn-va";
    set var.backup_shield = "atlanta-ga";
  }
} else {
  # Default shields for other locations
  set var.primary_shield = "ashburn-va";
  set var.backup_shield = "newark-nj";
}

# Try the primary shield first
set var.primary_selected = fastly.try_select_shield(var.primary_shield);

# If primary shield selection fails, try the backup
if (!var.primary_selected) {
  set var.backup_selected = fastly.try_select_shield(var.backup_shield);
  
  if (var.backup_selected) {
    log "Primary shield selection failed, using backup shield: " + var.backup_shield;
  } else {
    log "Both primary and backup shield selection failed, using default routing";
  }
} else {
  log "Using primary shield: " + var.primary_shield;
}

# Set a header for debugging
set req.http.X-Selected-Shield = if(var.primary_selected, var.primary_shield, 
                                  if(var.backup_selected, var.backup_shield, "none"));
```
## h2.push

Triggers an HTTP/2 server push of the asset at the specified path.

### Syntax

```vcl
h2.push(STRING path)
```

### Parameters

- `path`: The path of the asset to push

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

Disables HTTP/2 header compression for the current request/response.

### Syntax

```vcl
h2.disable_header_compression()
```

### Parameters

None

### Return Value

None

### Examples

#### Disabling HTTP/2 header compression for security-sensitive contexts

```vcl
# Check if this is a security-sensitive context
if (req.url ~ "^/admin/" || req.url ~ "^/account/") {
  # Disable HTTP/2 header compression to mitigate potential HPACK attacks
  h2.disable_header_compression();
  
  # Log the action
  log "Disabled HTTP/2 header compression for security-sensitive path: " + req.url;
}
```

## h3.alt_svc

Adds an Alt-Svc header to advertise HTTP/3 support.

### Syntax

```vcl
h3.alt_svc(STRING origin, INTEGER max_age)
```

### Parameters

- `origin`: The origin to advertise HTTP/3 support for
- `max_age`: The maximum age of the advertisement in seconds

### Return Value

None

### Examples

#### Advertising HTTP/3 support

```vcl
# Add Alt-Svc header to advertise HTTP/3 support
h3.alt_svc("example.com", 86400);  # 24 hours

# You can also use an empty string for the current origin
# h3.alt_svc("", 86400);
```

## early_hints

Sends an HTTP 103 Early Hints response with Link headers.

### Syntax

```vcl
early_hints(STRING link_header)
```

### Parameters

- `link_header`: The Link header value to include in the Early Hints response

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
# First, set up some reusable subroutines

# Subroutine for determining critical resources based on the page type
sub determine_critical_resources {
  # Initialize arrays for critical resources
  declare local var.css_resources STRING;
  declare local var.js_resources STRING;
  declare local var.image_resources STRING;
  declare local var.font_resources STRING;
  
  # Set default empty values
  set var.css_resources = "";
  set var.js_resources = "";
  set var.image_resources = "";
  set var.font_resources = "";
  
  # Determine critical resources based on the page type
  if (req.url == "/" || req.url == "/index.html") {
    # Homepage
    set var.css_resources = "/css/critical.css /css/home.css";
    set var.js_resources = "/js/critical.js /js/home.js";
    set var.image_resources = "/images/hero.jpg /images/logo.png";
    set var.font_resources = "/fonts/roboto.woff2";
  } else if (req.url ~ "^/products/") {
    # Product pages
    set var.css_resources = "/css/critical.css /css/product.css";
    set var.js_resources = "/js/critical.js /js/product.js /js/reviews.js";
    set var.image_resources = "/images/logo.png";
    set var.font_resources = "/fonts/roboto.woff2";
  } else if (req.url ~ "^/blog/") {
    # Blog pages
    set var.css_resources = "/css/critical.css /css/blog.css";
    set var.js_resources = "/js/critical.js /js/blog.js";
    set var.image_resources = "/images/logo.png";
    set var.font_resources = "/fonts/roboto.woff2 /fonts/serif.woff2";
  } else {
    # Default for other pages
    set var.css_resources = "/css/critical.css /css/main.css";
    set var.js_resources = "/js/critical.js /js/main.js";
    set var.image_resources = "/images/logo.png";
    set var.font_resources = "/fonts/roboto.woff2";
  }
  
  # Store the resources in headers for use in other subroutines
  set req.http.X-Critical-CSS = var.css_resources;
  set req.http.X-Critical-JS = var.js_resources;
  set req.http.X-Critical-Images = var.image_resources;
  set req.http.X-Critical-Fonts = var.font_resources;
}

# Main VCL subroutines

sub vcl_recv {
  # Step 1: Determine the appropriate shield POP
  declare local var.shield_selected BOOL;
  
  # Select shield based on client location
  if (client.geo.continent_code == "EU") {
    set var.shield_selected = fastly.try_select_shield("london-uk");
  } else if (client.geo.continent_code == "AS") {
    set var.shield_selected = fastly.try_select_shield("tokyo-jp");
  } else {
    set var.shield_selected = fastly.try_select_shield("ashburn-va");
  }
  
  # Step 2: Determine critical resources for the page
  call determine_critical_resources;
  
  # Step 3: Send Early Hints for critical resources
  
  # Process CSS resources
  if (req.http.X-Critical-CSS != "") {
    declare local var.css_list ARRAY;
    set var.css_list = split(req.http.X-Critical-CSS, " ");
    
    declare local var.css_resource STRING;
    foreach (var.css_resource, var.css_list) {
      early_hints("<" + var.css_resource + ">; rel=preload; as=style");
    }
  }
  
  # Process JS resources
  if (req.http.X-Critical-JS != "") {
    declare local var.js_list ARRAY;
    set var.js_list = split(req.http.X-Critical-JS, " ");
    
    declare local var.js_resource STRING;
    foreach (var.js_resource, var.js_list) {
      early_hints("<" + var.js_resource + ">; rel=preload; as=script");
    }
  }
  
  # Process font resources
  if (req.http.X-Critical-Fonts != "") {
    declare local var.font_list ARRAY;
    set var.font_list = split(req.http.X-Critical-Fonts, " ");
    
    declare local var.font_resource STRING;
    foreach (var.font_resource, var.font_list) {
      early_hints("<" + var.font_resource + ">; rel=preload; as=font; crossorigin");
    }
  }
  
  # Step 4: A/B testing for performance optimizations
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
  } else if (var.perf_test_bucket <= 75) {
    # 25% of users get minimal optimization
    set req.http.X-Perf-Optimization = "minimal";
  } else {
    # 25% of users get no optimization (control group)
    set req.http.X-Perf-Optimization = "none";
  }
}

sub vcl_deliver {
  # Step 5: HTTP/2 Server Push for critical resources
  
  # Only push if the client supports HTTP/2 and based on optimization level
  if (fastly.info.is_h2 && !req.http.Fastly-FF) {
    # Different push strategies based on optimization level
    if (req.http.X-Perf-Optimization == "aggressive") {
      # Push all critical resources
      
      # Push CSS
      if (req.http.X-Critical-CSS != "") {
        declare local var.css_list ARRAY;
        set var.css_list = split(req.http.X-Critical-CSS, " ");
        
        declare local var.css_resource STRING;
        foreach (var.css_resource, var.css_list) {
          h2.push(var.css_resource);
        }
      }
      
      # Push JS
      if (req.http.X-Critical-JS != "") {
        declare local var.js_list ARRAY;
        set var.js_list = split(req.http.X-Critical-JS, " ");
        
        declare local var.js_resource STRING;
        foreach (var.js_resource, var.js_list) {
          h2.push(var.js_resource);
        }
      }
      
      # Push images
      if (req.http.X-Critical-Images != "") {
        declare local var.img_list ARRAY;
        set var.img_list = split(req.http.X-Critical-Images, " ");
        
        declare local var.img_resource STRING;
        foreach (var.img_resource, var.img_list) {
          h2.push(var.img_resource);
        }
      }
      
    } else if (req.http.X-Perf-Optimization == "standard") {
      # Push only CSS and JS, not images
      
      # Push CSS
      if (req.http.X-Critical-CSS != "") {
        declare local var.css_list ARRAY;
        set var.css_list = split(req.http.X-Critical-CSS, " ");
        
        declare local var.css_resource STRING;
        foreach (var.css_resource, var.css_list) {
          h2.push(var.css_resource);
        }
      }
      
      # Push JS
      if (req.http.X-Critical-JS != "") {
        declare local var.js_list ARRAY;
        set var.js_list = split(req.http.X-Critical-JS, " ");
        
        declare local var.js_resource STRING;
        foreach (var.js_resource, var.js_list) {
          h2.push(var.js_resource);
        }
      }
      
    } else if (req.http.X-Perf-Optimization == "minimal") {
      # Push only CSS
      if (req.http.X-Critical-CSS != "") {
        declare local var.css_list ARRAY;
        set var.css_list = split(req.http.X-Critical-CSS, " ");
        
        declare local var.css_resource STRING;
        foreach (var.css_resource, var.css_list) {
          h2.push(var.css_resource);
        }
      }
    }
    # No push for "none" optimization level
  }
  
  # Step 6: HTTP/3 support advertisement
  # Add Alt-Svc header to advertise HTTP/3 support
  h3.alt_svc("", 86400);  # 24 hours, current origin
  
  # Step 7: Set performance-related response headers for analytics
  set resp.http.X-Perf-Optimization = req.http.X-Perf-Optimization;
  set resp.http.X-Shield-Used = req.http.X-Selected-Shield;
  set resp.http.X-HTTP-Version = if(fastly.info.is_h3, "HTTP/3", 
                                 if(fastly.info.is_h2, "HTTP/2", "HTTP/1.1"));
}
```

## Best Practices for Fastly-specific Functions

1. Shield Selection:
   - Choose shields based on client geography for optimal performance
   - Implement fallback strategies for shield selection
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

5. Service Chaining with fastly.ff.last_hop_was_serviceid:
   - Implement proper authentication between services
   - Use service chaining for specialized processing (auth, API gateway, etc.)
   - Validate service IDs to prevent unauthorized access

6. HTTP/3 Support:
   - Advertise HTTP/3 support using h3.alt_svc
   - Set appropriate max-age values for Alt-Svc headers
   - Monitor HTTP/3 adoption and performance

7. Security Considerations:
   - Disable HTTP/2 header compression for security-sensitive contexts
   - Implement proper access controls for service chaining
   - Use secure random seeds for hash-based functions

8. Performance Monitoring:
   - Set debug headers to track which optimizations were applied
   - Log performance metrics for different optimization strategies
   - Use A/B testing to measure the impact of optimizations