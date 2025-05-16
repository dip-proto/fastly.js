# Custom Error Pages with Fastly.JS

Custom error pages improve user experience by providing helpful information when errors occur. With Fastly.JS, you can create and serve custom error pages at the edge, without burdening your origin servers. This guide demonstrates how to implement custom error pages using Fastly.JS and VCL.

## Basic Error Handling

The simplest way to create custom error pages is to use the `vcl_error` subroutine:

```vcl
sub vcl_error {
  # Set the response content type
  set obj.http.Content-Type = "text/html; charset=utf-8";
  
  # Create a custom error page based on the status code
  if (obj.status == 404) {
    synthetic {"
      <!DOCTYPE html>
      <html>
        <head>
          <title>Page Not Found</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              margin: 40px;
              line-height: 1.6;
              color: #333;
            }
            h1 {
              color: #c00;
            }
          </style>
        </head>
        <body>
          <h1>Page Not Found</h1>
          <p>The page you are looking for could not be found.</p>
          <p>Please check the URL or go back to the <a href="/">homepage</a>.</p>
        </body>
      </html>
    "};
  } else if (obj.status == 500) {
    synthetic {"
      <!DOCTYPE html>
      <html>
        <head>
          <title>Server Error</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              margin: 40px;
              line-height: 1.6;
              color: #333;
            }
            h1 {
              color: #c00;
            }
          </style>
        </head>
        <body>
          <h1>Server Error</h1>
          <p>Sorry, something went wrong on our end.</p>
          <p>Our team has been notified and is working to fix the issue.</p>
        </body>
      </html>
    "};
  } else {
    synthetic {"
      <!DOCTYPE html>
      <html>
        <head>
          <title>Error " + obj.status + "</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              margin: 40px;
              line-height: 1.6;
              color: #333;
            }
            h1 {
              color: #c00;
            }
          </style>
        </head>
        <body>
          <h1>Error " + obj.status + "</h1>
          <p>Sorry, an error occurred while processing your request.</p>
          <p>Please try again later or contact support if the problem persists.</p>
        </body>
      </html>
    "};
  }
  
  return(deliver);
}
```

## Generating Error Pages in vcl_recv

You can also generate error pages in the `vcl_recv` subroutine:

```vcl
sub vcl_recv {
  # Check if the request is for a restricted area
  if (req.url ~ "^/admin" && client.ip !~ internal_ips) {
    error 403 "Forbidden";
  }
  
  # Check if the requested resource exists
  if (req.url ~ "^/old-section/") {
    error 404 "Not Found";
  }
  
  return(lookup);
}
```

## Dynamic Error Pages with Variables

You can create dynamic error pages that include information from the request:

```vcl
sub vcl_error {
  # Set the response content type
  set obj.http.Content-Type = "text/html; charset=utf-8";
  
  # Create a custom error page with request information
  synthetic {"
    <!DOCTYPE html>
    <html>
      <head>
        <title>Error " + obj.status + "</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 40px;
            line-height: 1.6;
            color: #333;
          }
          h1 {
            color: #c00;
          }
          .details {
            background-color: #f9f9f9;
            border: 1px solid #ddd;
            padding: 10px;
            margin-top: 20px;
          }
        </style>
      </head>
      <body>
        <h1>Error " + obj.status + ": " + obj.response + "</h1>
        <p>Sorry, an error occurred while processing your request.</p>
        <div class='details'>
          <p><strong>URL:</strong> " + req.url + "</p>
          <p><strong>Method:</strong> " + req.method + "</p>
          <p><strong>Time:</strong> " + std.time.now() + "</p>
          <p><strong>Error ID:</strong> " + digest.hash_md5(req.url + std.time.now()) + "</p>
        </div>
        <p>Please try again later or contact support if the problem persists.</p>
      </body>
    </html>
  "};
  
  return(deliver);
}
```

## JSON Error Responses for APIs

For API endpoints, it's often better to return error responses in JSON format:

```vcl
sub vcl_recv {
  # Check if this is an API request
  if (req.url ~ "^/api/") {
    set req.http.X-API-Request = "true";
  }
  
  return(lookup);
}

sub vcl_error {
  # Check if this is an API request
  if (req.http.X-API-Request == "true") {
    # Set the response content type to JSON
    set obj.http.Content-Type = "application/json";
    
    # Create a JSON error response
    # Note: Build JSON by concatenating strings with proper escaping
    set req.http.X-Error-JSON = "{" + LF
      + {"  "error": {"} + LF
      + {"    "status": "} + obj.status + "," + LF
      + {"    "message": ""} + obj.response + {"","} + LF
      + {"    "path": ""} + req.url + {"""} + LF
      + "  }" + LF
      + "}";
    synthetic req.http.X-Error-JSON;
  } else {
    # For non-API requests, use HTML error pages
    set obj.http.Content-Type = "text/html; charset=utf-8";
    
    # Create an HTML error page
    synthetic {"
      <!DOCTYPE html>
      <html>
        <head>
          <title>Error " + obj.status + "</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              margin: 40px;
              line-height: 1.6;
              color: #333;
            }
            h1 {
              color: #c00;
            }
          </style>
        </head>
        <body>
          <h1>Error " + obj.status + ": " + obj.response + "</h1>
          <p>Sorry, an error occurred while processing your request.</p>
          <p>Please try again later or contact support if the problem persists.</p>
        </body>
      </html>
    "};
  }
  
  return(deliver);
}
```

## Redirecting on Error

In some cases, you might want to redirect users to a different page when an error occurs:

```vcl
sub vcl_error {
  # Redirect 404 errors to the homepage
  if (obj.status == 404) {
    set obj.http.Location = "/";
    set obj.status = 302;
    return(deliver);
  }
  
  # Redirect maintenance errors to a static maintenance page
  if (obj.status == 503) {
    set obj.http.Location = "/maintenance.html";
    set obj.status = 302;
    return(deliver);
  }
  
  # For other errors, use custom error pages
  set obj.http.Content-Type = "text/html; charset=utf-8";
  synthetic {"
    <!DOCTYPE html>
    <html>
      <head>
        <title>Error " + obj.status + "</title>
      </head>
      <body>
        <h1>Error " + obj.status + "</h1>
        <p>" + obj.response + "</p>
      </body>
    </html>
  "};
  
  return(deliver);
}
```

## Complete Example

Here's a complete example that combines several error handling techniques:

```vcl
sub vcl_recv {
  # Check if this is an API request
  if (req.url ~ "^/api/") {
    set req.http.X-API-Request = "true";
  }
  
  # Check for maintenance mode
  if (req.http.X-Maintenance-Mode == "true" && req.url !~ "^/maintenance") {
    error 503 "Service Unavailable";
  }
  
  return(lookup);
}

sub vcl_error {
  # Set default response headers
  set obj.http.Cache-Control = "no-cache";
  
  # Check if this is an API request
  if (req.http.X-API-Request == "true") {
    # Set the response content type to JSON
    set obj.http.Content-Type = "application/json";
    
    # Create a JSON error response
    # Note: Build JSON by concatenating strings with proper escaping
    set req.http.X-Error-JSON = "{" + LF
      + {"  "error": {"} + LF
      + {"    "status": "} + obj.status + "," + LF
      + {"    "message": ""} + obj.response + {"","} + LF
      + {"    "path": ""} + req.url + {"""} + LF
      + "  }" + LF
      + "}";
    synthetic req.http.X-Error-JSON;
  } else {
    # For non-API requests, use HTML error pages
    set obj.http.Content-Type = "text/html; charset=utf-8";
    
    # Create an HTML error page based on the status code
    if (obj.status == 404) {
      synthetic {"
        <!DOCTYPE html>
        <html>
          <head>
            <title>Page Not Found</title>
            <style>
              body {
                font-family: Arial, sans-serif;
                margin: 40px;
                line-height: 1.6;
                color: #333;
              }
              h1 {
                color: #c00;
              }
            </style>
          </head>
          <body>
            <h1>Page Not Found</h1>
            <p>The page you are looking for could not be found.</p>
            <p>Please check the URL or go back to the <a href="/">homepage</a>.</p>
          </body>
        </html>
      "};
    } else if (obj.status == 503) {
      synthetic {"
        <!DOCTYPE html>
        <html>
          <head>
            <title>Service Unavailable</title>
            <style>
              body {
                font-family: Arial, sans-serif;
                margin: 40px;
                line-height: 1.6;
                color: #333;
              }
              h1 {
                color: #c00;
              }
            </style>
          </head>
          <body>
            <h1>Service Unavailable</h1>
            <p>Sorry, we're currently performing maintenance.</p>
            <p>Please try again later.</p>
          </body>
        </html>
      "};
    } else {
      synthetic {"
        <!DOCTYPE html>
        <html>
          <head>
            <title>Error " + obj.status + "</title>
            <style>
              body {
                font-family: Arial, sans-serif;
                margin: 40px;
                line-height: 1.6;
                color: #333;
              }
              h1 {
                color: #c00;
              }
            </style>
          </head>
          <body>
            <h1>Error " + obj.status + ": " + obj.response + "</h1>
            <p>Sorry, an error occurred while processing your request.</p>
            <p>Please try again later or contact support if the problem persists.</p>
          </body>
        </html>
      "};
    }
  }
  
  return(deliver);
}
```

## Running the Example

Save the above VCL to a file named `error-pages.vcl` and run it with Fastly.JS:

```bash
bun run index.ts error-pages.vcl
```

This will start a local HTTP proxy server that applies the custom error pages to all responses.

## Conclusion

Custom error pages improve user experience by providing helpful information when errors occur. With Fastly.JS, you can test and develop custom error pages locally before deploying them to your production Fastly service.

For more information on the VCL functions used in this example, see the [VCL Functions Reference](../reference/vcl-functions.md).
