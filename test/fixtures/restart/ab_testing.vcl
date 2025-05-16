# A/B Testing with Restart-Based Traffic Splitting
# This VCL demonstrates how to implement A/B testing using restart

# Define backends for different versions
backend version_a {
    .host = "version-a.example.com";
    .port = "80";
}

backend version_b {
    .host = "version-b.example.com";
    .port = "80";
}

# Define a table for feature flag configuration
table feature_flags {
    "homepage_redesign": "active",
    "new_checkout": "active",
    "personalization": "inactive"
}

sub vcl_recv {
    # Track restarts
    set req.http.X-Restart-Count = req.restarts;
    
    # First restart: Determine if user is in a test group
    if (req.restarts == 0) {
        # Check for existing test assignment cookie
        if (req.http.Cookie ~ "AB_Test=([^;]+)") {
            set req.http.X-AB-Test = re.group.1;
        } else {
            # No existing assignment, determine based on user or randomly
            
            # Option 1: Use user identifier if available
            if (req.http.Cookie ~ "user_id=([^;]+)") {
                # Hash the user ID to get consistent assignment
                declare local var.user_hash STRING;
                set var.user_hash = digest.hash_sha1(re.group.1);
                
                # Use the hash to determine test group (A or B)
                # This ensures the same user always gets the same experience
                if (std.strstr(var.user_hash, "a") < std.strstr(var.user_hash, "f")) {
                    set req.http.X-AB-Test = "A";
                } else {
                    set req.http.X-AB-Test = "B";
                }
            } else {
                # Option 2: Random assignment with weighted distribution
                # 70% to A, 30% to B
                if (randombool(70, 100)) {
                    set req.http.X-AB-Test = "A";
                } else {
                    set req.http.X-AB-Test = "B";
                }
            }
            
            # Set cookie for consistent experience in future requests
            set req.http.X-Set-AB-Cookie = "AB_Test=" + req.http.X-AB-Test + "; path=/; max-age=3600";
        }
        
        # Check if feature flags are active
        if (table.lookup(feature_flags, "homepage_redesign") == "active" && req.url ~ "^/$") {
            set req.http.X-Restart-Reason = "homepage_test_assignment";
            restart;
        }
        
        if (table.lookup(feature_flags, "new_checkout") == "active" && req.url ~ "^/checkout") {
            set req.http.X-Restart-Reason = "checkout_test_assignment";
            restart;
        }
    }
    
    # Second restart: Route to appropriate backend based on test group
    if (req.restarts == 1) {
        # Homepage test
        if (req.http.X-Restart-Reason == "homepage_test_assignment") {
            if (req.http.X-AB-Test == "B") {
                # Route to version B backend
                set req.backend = version_b;
                set req.http.X-Selected-Version = "B";
                
                # Optionally modify the URL to point to the B version
                set req.url = "/homepage-b" + req.url;
            } else {
                # Default to version A
                set req.backend = version_a;
                set req.http.X-Selected-Version = "A";
            }
        }
        
        # Checkout test
        if (req.http.X-Restart-Reason == "checkout_test_assignment") {
            if (req.http.X-AB-Test == "B") {
                # Route to version B backend
                set req.backend = version_b;
                set req.http.X-Selected-Version = "B";
                
                # Optionally add a parameter to indicate B version
                if (req.url ~ "\\?") {
                    set req.url = req.url + "&version=B";
                } else {
                    set req.url = req.url + "?version=B";
                }
            } else {
                # Default to version A
                set req.backend = version_a;
                set req.http.X-Selected-Version = "A";
            }
        }
    }
    
    # Third restart: Handle special cases for test groups
    if (req.restarts == 2) {
        # Example: If version B has a different URL structure for certain pages
        if (req.http.X-Selected-Version == "B" && req.url ~ "^/product/([0-9]+)") {
            set req.url = "/catalog/item/" + re.group.1;
            set req.http.X-Restart-Reason = "url_structure_change";
        }
    }
    
    # Prevent infinite loops
    if (req.restarts >= 4) {
        set req.http.X-Max-Restarts-Reached = "true";
        error 503 "Maximum number of restarts reached";
    }
    
    # Track test for analytics
    if (req.http.X-AB-Test) {
        set req.http.X-Analytics-AB-Test = req.http.X-AB-Test;
    }
    
    return(lookup);
}

sub vcl_deliver {
    # Set the AB test cookie if needed
    if (req.http.X-Set-AB-Cookie) {
        add resp.http.Set-Cookie = req.http.X-Set-AB-Cookie;
    }
    
    # Add headers to show test information (for debugging, remove in production)
    set resp.http.X-Restart-Count = req.restarts;
    set resp.http.X-AB-Test = req.http.X-AB-Test;
    
    if (req.http.X-Selected-Version) {
        set resp.http.X-Selected-Version = req.http.X-Selected-Version;
    }
    
    if (req.http.X-Restart-Reason) {
        set resp.http.X-Restart-Reason = req.http.X-Restart-Reason;
    }
    
    # Add JavaScript to track test for client-side analytics
    if (req.http.X-AB-Test && req.http.X-Selected-Version) {
        set resp.http.X-Analytics-Data = "{\"test\":\"" + req.http.X-AB-Test + "\",\"version\":\"" + req.http.X-Selected-Version + "\"}";
    }
    
    return(deliver);
}
