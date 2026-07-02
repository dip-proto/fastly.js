# Request and Response Handling in VCL

This tutorial covers how to handle HTTP requests and responses in VCL, including manipulating headers, cookies, and query parameters.

## The HTTP Request Flow

Before diving into request and response handling, it's important to understand the HTTP request flow in Fastly.JS:

1. **Client Request Reception**
   - The client sends a request to Fastly.JS
   - Fastly.JS executes `vcl_recv`
   - Based on the return value, Fastly.JS either looks up the request in cache, passes it to the backend, or returns an error

2. **Cache Lookup**
   - If `vcl_recv` returns `lookup`, Fastly.JS generates a cache key using `vcl_hash`
   - If the request is in cache, Fastly.JS executes `vcl_hit`
   - If the request is not in cache, Fastly.JS executes `vcl_miss`
   - If `vcl_recv` returns `pass`, Fastly.JS executes `vcl_pass`

3. **Backend Request**
   - If `vcl_miss` or `vcl_pass` returns `fetch`, Fastly.JS sends a request to the backend
   - When the backend responds, Fastly.JS executes `vcl_fetch`
   - Based on the return value, Fastly.JS either delivers the response to the client, passes it through, or returns an error

4. **Response Delivery**
   - Before delivering the response to the client, Fastly.JS executes `vcl_deliver`
   - After delivering the response, Fastly.JS executes `vcl_log`

## Request Handling

Request handling primarily occurs in the `vcl_recv` subroutine, which is executed when a request is received from the client.

### Accessing Request Properties

You can access various properties of the client request using the `req` object:

```vcl
acl internal {
  "192.168.0.0"/24;
}

sub vcl_recv {
  # Access request method
  if (req.method == "POST") {
    # Handle POST requests
  }
  
  # Access request URL
  if (req.url ~ "^/api/") {
    # Handle API requests
  }
  
  # Access request headers
  if (req.http.user-agent ~ "Mobile") {
    # Handle mobile requests
  }
  
  # Access client IP, matched against a named ACL
  if (client.ip ~ internal) {
    # Handle internal requests
  }
}
```

Note that `client.ip` must be matched against a named ACL. A quoted string on the right-hand side of `~` is treated as a regular expression, not a CIDR range, so `client.ip ~ "192.168.0.0/24"` does not do what it looks like.

### Manipulating Request Headers

You can add, modify, or remove request headers. Remember that lookups are case-sensitive and incoming header names are stored in lowercase, which is why the examples read `req.http.user-agent` rather than `req.http.User-Agent`:

```vcl
sub vcl_recv {
  # Set a header
  set req.http.X-Custom-Header = "value";
  
  # Modify a header
  if (req.http.user-agent) {
    set req.http.user-agent = req.http.user-agent + " via Fastly.JS";
  }
  
  # Remove a header
  unset req.http.cookie;
  
  # Normalize a header
  set req.http.host = std.tolower(req.http.host);
}
```

### Handling Cookies

You can access and manipulate cookies in the request:

```vcl
sub vcl_recv {
  # Check if a cookie exists
  if (req.http.cookie ~ "session=") {
    # Extract the session cookie
    set req.http.X-Session = regsub(req.http.cookie, ".*session=([^;]+).*", "\1");
  }
  
  # Remove all cookies except the session cookie
  if (req.http.cookie) {
    set req.http.cookie = ";" + req.http.cookie;
    set req.http.cookie = regsuball(req.http.cookie, "; +", ";");
    set req.http.cookie = regsuball(req.http.cookie, ";(session)=", "; \1=");
    set req.http.cookie = regsuball(req.http.cookie, ";[^ ][^;]*", "");
    set req.http.cookie = regsuball(req.http.cookie, "^[; ]+|[; ]+$", "");
    
    if (req.http.cookie == "") {
      unset req.http.cookie;
    }
  }
}
```

### Handling Query Parameters

You can access and manipulate query parameters in the request:

```vcl
sub vcl_recv {
  # Check if a query parameter exists
  if (req.url ~ "\?.*(\&|^)param=([^&]*)") {
    # Extract the parameter value
    set req.http.X-Param = re.group.2;
  }
  
  # Remove a query parameter
  set req.url = querystring.filter(req.url, "param");
  
  # Add or modify a query parameter
  set req.url = querystring.set(req.url, "param", "value");
  
  # Sort query parameters
  set req.url = querystring.sort(req.url);
}
```

### URL Rewriting

You can rewrite the request URL:

```vcl
sub vcl_recv {
  # Rewrite a URL
  if (req.url ~ "^/old-path/") {
    set req.url = regsub(req.url, "^/old-path/", "/new-path/");
  }
  
  # Add a trailing slash
  if (req.url !~ "/$" && req.url !~ "\.[a-zA-Z0-9]+$") {
    set req.url = req.url + "/";
  }
  
  # Remove index.html
  if (req.url ~ "/index.html$") {
    set req.url = regsub(req.url, "/index.html$", "/");
  }
}
```

## Response Handling

Response handling primarily occurs in the `vcl_fetch` and `vcl_deliver` subroutines.

### Accessing Backend Response Properties

In `vcl_fetch`, you can access various properties of the backend response using the `beresp` object:

```vcl
sub vcl_fetch {
  # Access response status
  if (beresp.status == 404) {
    # Handle 404 responses
  }
  
  # Access response headers
  if (beresp.http.content-type ~ "text/html") {
    # Handle HTML responses
  }
  
  # Access response TTL
  if (beresp.ttl <= 0s) {
    # Handle uncacheable responses
  }
}
```

### Manipulating Backend Response Headers

In `vcl_fetch`, you can add, modify, or remove backend response headers:

```vcl
sub vcl_fetch {
  # Set a header
  set beresp.http.X-Custom-Header = "value";
  
  # Modify a header
  if (beresp.http.server) {
    set beresp.http.server = beresp.http.server + " via Fastly.JS";
  }
  
  # Remove a header
  unset beresp.http.x-powered-by;
}
```

### Manipulating Client Response Headers

In `vcl_deliver`, you can add, modify, or remove client response headers:

```vcl
sub vcl_deliver {
  # Set a header
  set resp.http.X-Custom-Header = "value";
  
  # Modify a header
  if (resp.http.server) {
    set resp.http.server = resp.http.server + " via Fastly.JS";
  }
  
  # Remove a header
  unset resp.http.x-powered-by;
  
  # Add cache status header
  if (obj.hits > 0) {
    set resp.http.X-Cache = "HIT";
  } else {
    set resp.http.X-Cache = "MISS";
  }
}
```

### Setting Response Status

You can modify the response status:

```vcl
sub vcl_deliver {
  # Set response status
  set resp.status = 200;
  set resp.response = "OK";
}
```

The reason phrase variable is `resp.response`, as in Fastly VCL. (`resp.reason` is Varnish syntax and is not supported.)

### Creating Synthetic Responses

You can create synthetic responses in `vcl_error`:

```vcl
sub vcl_error {
  # Create a custom error page
  if (obj.status == 403) {
    set obj.http.Content-Type = "text/html; charset=utf-8";
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
}
```

## Logging

You can log information at any stage of the request flow using the `std.log` function:

```vcl
sub vcl_recv {
  std.log("Received request: " + req.method + " " + req.url);
}

sub vcl_fetch {
  std.log("Backend response: " + beresp.status);
}

sub vcl_deliver {
  std.log("Delivered response: " + resp.status);
}

sub vcl_log {
  std.log("Completed request: " + req.method + " " + req.url + " - Status: " + resp.status);
}
```

## Next Steps

Now that you understand how to handle HTTP requests and responses in VCL, you can move on to the next tutorial: [Caching Strategies](./03-caching-strategies.md).
