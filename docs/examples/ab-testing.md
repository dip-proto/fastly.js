# A/B Testing Example

This example demonstrates how to implement A/B testing in VCL, including random assignment, cookie-based persistence, and cache variations.

## Complete Example

```vcl
# A/B Testing Example

# Define the backend server
backend default {
  .host = "example.com";
  .port = "80";
}

# This subroutine is executed when a request is received
sub vcl_recv {
  # Log the incoming request
  std.log("Received request: " + req.method + " " + req.url);
  
  # Check if the user already has an A/B test variant cookie
  if (req.http.Cookie ~ "ABTest=") {
    # Extract the variant from the cookie
    if (req.http.Cookie ~ "ABTest=A") {
      set req.http.X-ABTest = "A";
      std.log("User already assigned to variant A");
    } else if (req.http.Cookie ~ "ABTest=B") {
      set req.http.X-ABTest = "B";
      std.log("User already assigned to variant B");
    } else if (req.http.Cookie ~ "ABTest=C") {
      set req.http.X-ABTest = "C";
      std.log("User already assigned to variant C");
    } else {
      # Invalid variant, assign a new one
      set req.http.X-ABTest-Reset = "1";
    }
  }
  
  # If the user doesn't have a variant or has an invalid one, assign a new one
  if (!req.http.X-ABTest || req.http.X-ABTest-Reset) {
    # Use the random function to assign a variant
    # 40% chance of A, 40% chance of B, 20% chance of C
    declare local var.random REAL;
    set var.random = std.random.randomint(1, 100);
    
    if (var.random <= 40) {
      set req.http.X-ABTest = "A";
      std.log("Assigning user to variant A");
    } else if (var.random <= 80) {
      set req.http.X-ABTest = "B";
      std.log("Assigning user to variant B");
    } else {
      set req.http.X-ABTest = "C";
      std.log("Assigning user to variant C");
    }
    
    # Set a flag to add the cookie in vcl_deliver
    set req.http.X-Set-ABTest-Cookie = "1";
  }
  
  # Continue to cache lookup
  return(lookup);
}

# This subroutine is executed to create a hash key for the request
sub vcl_hash {
  # Hash based on URL and host
  hash_data(req.url);
  hash_data(req.http.host);
  
  # Include the A/B test variant in the cache key
  hash_data(req.http.X-ABTest);
  
  return(hash);
}

# This subroutine is executed when the response is received from the backend
sub vcl_fetch {
  # Set a reasonable TTL
  set beresp.ttl = 1h;
  
  # Add the A/B test variant to the response
  set beresp.http.X-ABTest = req.http.X-ABTest;
  
  # Modify the response based on the A/B test variant
  if (req.http.X-ABTest == "A") {
    # Variant A: Original version
    # No modifications needed
  } else if (req.http.X-ABTest == "B") {
    # Variant B: Modified version
    # Example: Change the title
    if (beresp.http.Content-Type ~ "text/html") {
      set beresp.http.X-AB-Modified = "1";
      
      # Note: In a real implementation, you would modify the response body here
      # This is a simplified example that just adds a header
    }
  } else if (req.http.X-ABTest == "C") {
    # Variant C: Another modified version
    # Example: Change the layout
    if (beresp.http.Content-Type ~ "text/html") {
      set beresp.http.X-AB-Modified = "2";
      
      # Note: In a real implementation, you would modify the response body here
      # This is a simplified example that just adds a header
    }
  }
  
  return(deliver);
}

# This subroutine is executed before the response is delivered to the client
sub vcl_deliver {
  # Add the A/B test variant to the response headers
  set resp.http.X-ABTest = req.http.X-ABTest;
  
  # Set the A/B test cookie if needed
  if (req.http.X-Set-ABTest-Cookie) {
    # Set a cookie that expires in 30 days
    add resp.http.Set-Cookie = "ABTest=" + req.http.X-ABTest + "; path=/; max-age=2592000";
    std.log("Setting ABTest cookie to " + req.http.X-ABTest);
  }
  
  # Add cache status header
  if (obj.hits > 0) {
    set resp.http.X-Cache = "HIT";
    set resp.http.X-Cache-Hits = obj.hits;
  } else {
    set resp.http.X-Cache = "MISS";
  }
  
  # Add a custom header to indicate the proxy server
  set resp.http.X-Powered-By = "Fastly.JS";
  
  # Add a header to indicate if the response was modified for A/B testing
  if (resp.http.X-AB-Modified) {
    set resp.http.X-AB-Modified = "Yes (" + resp.http.X-AB-Modified + ")";
  } else {
    set resp.http.X-AB-Modified = "No";
  }
  
  return(deliver);
}

# This subroutine is executed after the response is delivered to the client
sub vcl_log {
  # Log the completed request with the A/B test variant
  std.log("Completed request: " + req.method + " " + req.url + " - Status: " + resp.status + " - Variant: " + req.http.X-ABTest);
}
```

## Explanation

This example implements an A/B testing strategy with the following features:

### Variant Assignment (vcl_recv)

- Checks if the user already has an A/B test variant cookie
- If not, assigns a new variant using a random function:
  - 40% chance of variant A
  - 40% chance of variant B
  - 20% chance of variant C
- Sets a flag to add the cookie in vcl_deliver

### Cache Variation (vcl_hash)

- Creates a cache key based on the URL, host, and A/B test variant
- This ensures that each variant is cached separately

### Response Modification (vcl_fetch)

- Adds the A/B test variant to the response
- Modifies the response based on the A/B test variant:
  - Variant A: Original version (no modifications)
  - Variant B: Modified version (example: change the title)
  - Variant C: Another modified version (example: change the layout)

### Cookie Setting (vcl_deliver)

- Sets the A/B test cookie if needed
- The cookie expires in 30 days (2592000 seconds)
- This ensures that the user sees the same variant on subsequent visits

### Debugging Headers (vcl_deliver)

- Adds the A/B test variant to the response headers
- Adds a header to indicate if the response was modified for A/B testing
- Adds cache status headers

### Logging (vcl_log)

- Logs the completed request with the A/B test variant

## Usage

To use this example, save it to a file named `ab-testing.vcl` and run Fastly.JS with the following command:

```bash
bun run index.ts ab-testing.vcl
```

Then, open your browser and navigate to:

```
http://127.0.0.1:8000
```

You should see the content from example.com, and the response headers should include:

- `X-ABTest`: Indicates the A/B test variant (A, B, or C)
- `X-AB-Modified`: Indicates if the response was modified for A/B testing
- `X-Cache`: Indicates whether the response was cached (HIT or MISS)
- `X-Cache-Hits`: Indicates the number of cache hits (if the response was cached)
- `X-Powered-By`: Indicates the proxy server (Fastly.JS)

You should also receive a cookie named `ABTest` with the value of your assigned variant.

## Customization

You can customize this example by:

- Changing the variant distribution (e.g., 50/50 split instead of 40/40/20)
- Modifying the response differently for each variant
- Adding more variants
- Changing the cookie expiration time
- Implementing more sophisticated variant assignment logic

For example, to implement a 50/50 split between two variants, you could modify the `vcl_recv` subroutine:

```vcl
sub vcl_recv {
  # ... existing code ...
  
  # If the user doesn't have a variant or has an invalid one, assign a new one
  if (!req.http.X-ABTest || req.http.X-ABTest-Reset) {
    # Use the random function to assign a variant
    # 50% chance of A, 50% chance of B
    if (std.random.randombool(0.5)) {
      set req.http.X-ABTest = "A";
      std.log("Assigning user to variant A");
    } else {
      set req.http.X-ABTest = "B";
      std.log("Assigning user to variant B");
    }
    
    # Set a flag to add the cookie in vcl_deliver
    set req.http.X-Set-ABTest-Cookie = "1";
  }
  
  # ... existing code ...
}
```

This would create a simple A/B test with a 50/50 split between two variants.
