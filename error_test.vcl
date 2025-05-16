sub vcl_recv {
  # Test error handling
  
  # Return 403 Forbidden for /forbidden path
  if (req.url ~ "^/forbidden") {
    error 403 "Access Denied";
  }
  
  # Return 404 Not Found for /not-found path
  if (req.url ~ "^/not-found") {
    error 404 "Page Not Found";
  }
  
  # Return 500 Internal Server Error for /server-error path
  if (req.url ~ "^/server-error") {
    error 500 "Internal Server Error";
  }
  
  # Return 429 Too Many Requests for /rate-limit path
  if (req.url ~ "^/rate-limit") {
    error 429 "Too Many Requests";
  }
  
  # Test backend failure for /backend-failure path
  if (req.url ~ "^/backend-failure") {
    # Set a non-existent backend
    set req.backend = "non_existent_backend";
  }
  
  # Test timeout for /timeout path
  if (req.url ~ "^/timeout") {
    # Set a backend with a very short timeout
    set req.backend = "timeout_backend";
  }
  
  return(lookup);
}

sub vcl_error {
  # Custom error pages based on status code
  
  # 403 Forbidden
  if (obj.status == 403) {
    set obj.http.Content-Type = "text/html; charset=utf-8";
    synthetic {"
<!DOCTYPE html>
<html>
<head>
    <title>Access Denied</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f8f8f8;
            color: #333;
        }
        .container {
            max-width: 800px;
            margin: 0 auto;
            background-color: white;
            border-radius: 5px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
            padding: 20px;
            text-align: center;
        }
        h1 {
            color: #d9534f;
        }
        .icon {
            font-size: 72px;
            margin: 20px 0;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Access Denied</h1>
        <div class="icon">🚫</div>
        <p>You do not have permission to access this resource.</p>
        <p>Please contact the administrator if you believe this is an error.</p>
    </div>
</body>
</html>
    "};
    return(deliver);
  }
  
  # 404 Not Found
  if (obj.status == 404) {
    set obj.http.Content-Type = "text/html; charset=utf-8";
    synthetic {"
<!DOCTYPE html>
<html>
<head>
    <title>Page Not Found</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f8f8f8;
            color: #333;
        }
        .container {
            max-width: 800px;
            margin: 0 auto;
            background-color: white;
            border-radius: 5px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
            padding: 20px;
            text-align: center;
        }
        h1 {
            color: #5bc0de;
        }
        .icon {
            font-size: 72px;
            margin: 20px 0;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Page Not Found</h1>
        <div class="icon">🔍</div>
        <p>The page you are looking for does not exist or has been moved.</p>
        <p><a href="/">Go to homepage</a></p>
    </div>
</body>
</html>
    "};
    return(deliver);
  }
  
  # Default error page for other status codes
  set obj.http.Content-Type = "text/html; charset=utf-8";
  synthetic {"
<!DOCTYPE html>
<html>
<head>
    <title>Error " + obj.status + "</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f8f8f8;
            color: #333;
        }
        .container {
            max-width: 800px;
            margin: 0 auto;
            background-color: white;
            border-radius: 5px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
            padding: 20px;
            text-align: center;
        }
        h1 {
            color: #f0ad4e;
        }
        .icon {
            font-size: 72px;
            margin: 20px 0;
        }
        .error-details {
            background-color: #f5f5f5;
            padding: 10px;
            border-radius: 3px;
            margin-top: 20px;
            text-align: left;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Error " + obj.status + "</h1>
        <div class="icon">⚠️</div>
        <p>" + obj.response + "</p>
        <div class="error-details">
            <p><strong>Status:</strong> " + obj.status + "</p>
            <p><strong>URL:</strong> " + req.url + "</p>
        </div>
    </div>
</body>
</html>
  "};
  return(deliver);
}

sub vcl_deliver {
  # Add debug headers
  set resp.http.X-Error-Test = "Completed";
  
  return(deliver);
}
