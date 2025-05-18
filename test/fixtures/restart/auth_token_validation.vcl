# Authentication with Token Validation Example
# This VCL demonstrates authentication flow using restart

sub vcl_recv {
    # Track restarts
    set req.http.X-Restart-Count = req.restarts;
    
    # First restart: Extract auth token from different sources
    if (req.restarts == 0) {
        # Check if Authorization header is missing
        if (!req.http.Authorization) {
            # Try to extract from query parameter
            if (req.url ~ "[?&]token=([^&]+)") {
                set req.http.X-Auth-Token = re.group.1;
                
                # Remove token from URL for security
                set req.url = regsuball(req.url, "([?&])token=[^&]+&?", "\1");
                set req.url = regsub(req.url, "[?&]$", "");
                
                set req.http.X-Restart-Reason = "auth_from_query";
                restart;
            }
            
            # Try to extract from cookie
            if (req.http.Cookie ~ "auth_token=([^;]+)") {
                set req.http.X-Auth-Token = re.group.1;
                set req.http.X-Restart-Reason = "auth_from_cookie";
                restart;
            }
            
            # No auth token found, redirect to login
            error 401 "Authentication required";
        }
    }
    
    # Second restart: Validate and normalize token
    if (req.restarts == 1 && req.http.X-Auth-Token) {
        # Remove any whitespace from token
        if (req.http.X-Auth-Token ~ "^\s+|\s+$") {
            set req.http.X-Auth-Token = regsub(req.http.X-Auth-Token, "^\s+|\s+$", "");
            set req.http.X-Restart-Reason = "token_whitespace_cleanup";
            restart;
        }
        
        # Set Authorization header with Bearer token
        set req.http.Authorization = "Bearer " + req.http.X-Auth-Token;
    }
    
    # Third restart: Token validation and role assignment
    if (req.restarts == 2 && req.http.Authorization) {
        # Simulate token validation (in real world, this would call an auth service)
        # For demo purposes, we'll use a simple check
        if (req.http.Authorization ~ "Bearer admin_token") {
            set req.http.X-User-Role = "admin";
            set req.http.X-Restart-Reason = "admin_role_assigned";
            restart;
        } else if (req.http.Authorization ~ "Bearer user_token") {
            set req.http.X-User-Role = "user";
            set req.http.X-Restart-Reason = "user_role_assigned";
            restart;
        } else {
            # Invalid token
            error 403 "Invalid authentication token";
        }
    }
    
    # Fourth restart: Apply role-based access control
    if (req.restarts == 3 && req.http.X-User-Role) {
        # Admin can access everything
        if (req.http.X-User-Role == "admin") {
            # Allow access to admin area
            if (req.url ~ "^/admin/") {
                set req.http.X-Access-Granted = "true";
            }
        }
        
        # Regular users can't access admin area
        if (req.http.X-User-Role == "user" && req.url ~ "^/admin/") {
            error 403 "Access denied to admin area";
        }
    }
    
    # Prevent infinite loops
    if (req.restarts >= 5) {
        set req.http.X-Max-Restarts-Reached = "true";
        error 503 "Maximum number of restarts reached";
    }
    
    return(lookup);
}

sub vcl_deliver {
    # Add headers to show authentication information (for demo purposes only)
    # In production, you would not expose these headers
    set resp.http.X-Restart-Count = req.restarts;
    
    if (req.http.X-User-Role) {
        set resp.http.X-User-Role = req.http.X-User-Role;
    }
    
    if (req.http.X-Restart-Reason) {
        set resp.http.X-Restart-Reason = req.http.X-Restart-Reason;
    }
    
    # Remove sensitive headers
    unset resp.http.X-Auth-Token;
    
    return(deliver);
}

sub vcl_error {
    if (obj.status == 401) {
        set obj.http.Content-Type = "text/html; charset=utf-8";
        set obj.response = "Unauthorized";
        synthetic {"
<!DOCTYPE html>
<html>
<head>
    <title>Authentication Required</title>
</head>
<body>
    <h1>Authentication Required</h1>
    <p>Please log in to access this resource.</p>
    <p><a href="/login?redirect=} + req.url + {">Log in</a></p>
</body>
</html>
"};
        return(deliver);
    } else if (obj.status == 403) {
        set obj.http.Content-Type = "text/html; charset=utf-8";
        set obj.response = "Forbidden";
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
    
    return(deliver);
}
