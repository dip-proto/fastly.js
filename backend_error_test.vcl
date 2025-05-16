sub vcl_recv {
  # Test backend error handling
  
  # Set a non-existent backend for /non-existent-backend path
  if (req.url ~ "^/non-existent-backend") {
    set req.backend = "non_existent_backend";
  }
  
  # Set an unhealthy backend for /unhealthy-backend path
  if (req.url ~ "^/unhealthy-backend") {
    # First, mark the backend as unhealthy
    set std.backend.get("api").is_healthy = false;
    # Then try to use it
    set req.backend = "api";
  }
  
  # Test fallback for /fallback-test path
  if (req.url ~ "^/fallback-test") {
    # First, mark the main backend as unhealthy
    set std.backend.get("main").is_healthy = false;
    # Then try to use the main director, which should fall back to another backend
    set req.backend = std.director.select_backend("fallback_director").name;
  }
  
  return(lookup);
}

sub vcl_error {
  # Custom error page for backend failures
  if (obj.status == 503) {
    set obj.http.Content-Type = "text/html; charset=utf-8";
    synthetic {"
<!DOCTYPE html>
<html>
<head>
    <title>Service Unavailable</title>
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
        <h1>Service Unavailable</h1>
        <div class="icon">🔧</div>
        <p>The service is temporarily unavailable. Please try again later.</p>
        <div class="error-details">
            <p><strong>Error:</strong> " + obj.response + "</p>
            <p><strong>Request:</strong> " + req.method + " " + req.url + "</p>
        </div>
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
