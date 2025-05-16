# Advanced Features in VCL

This tutorial covers advanced features in VCL, including ACLs, tables, directors, random functions, and more.

## Access Control Lists (ACLs)

ACLs allow you to define lists of IP addresses or CIDR ranges for access control.

### Defining an ACL

You can define an ACL using the `acl` directive:

```vcl
acl internal {
  "127.0.0.1";         # Single IP address
  "192.168.0.0"/24;    # CIDR range (IPv4)
  "2001:db8::"/32;     # CIDR range (IPv6)
}
```

### Using an ACL

You can use an ACL to control access to resources:

```vcl
sub vcl_recv {
  # Allow only internal IPs to access the admin area
  if (req.url ~ "^/admin/" && !(client.ip ~ internal)) {
    error 403 "Forbidden";
  }
}
```

### Multiple ACLs

You can define multiple ACLs for different purposes:

```vcl
acl internal {
  "127.0.0.1";
  "192.168.0.0"/24;
}

acl trusted_partners {
  "203.0.113.0"/24;
  "198.51.100.0"/24;
}

sub vcl_recv {
  # Allow internal IPs to access the admin area
  if (req.url ~ "^/admin/" && !(client.ip ~ internal)) {
    error 403 "Forbidden";
  }

  # Allow trusted partners to access the API
  if (req.url ~ "^/api/partners/" && !(client.ip ~ trusted_partners)) {
    error 403 "Forbidden";
  }
}
```

## Tables

Tables allow you to define key-value pairs for lookups.

### Defining a Table

You can define a table using the `table` directive:

```vcl
table redirects {
  "/old-path/": "/new-path/",
  "/legacy/": "/v2/",
  "/deprecated/": "/current/",
}
```

### Using a Table

You can use a table for lookups:

```vcl
sub vcl_recv {
  # Check if the URL path is in the redirects table
  if (table.contains(redirects, req.url)) {
    # Get the new path from the table
    set req.http.Location = "https://" + req.http.host + table.lookup(redirects, req.url);
    error 301 "Redirect";
  }
}
```

### Table Types

Tables can store different types of values:

```vcl
table string_values {
  "key1": "value1",
  "key2": "value2",
}

table integer_values {
  "key1": 42,
  "key2": 100,
}

table boolean_values {
  "key1": true,
  "key2": false,
}

sub vcl_recv {
  # String lookup
  set req.http.X-String = table.lookup(string_values, "key1");

  # Integer lookup
  set req.http.X-Integer = table.lookup_integer(integer_values, "key1");

  # Boolean lookup
  if (table.lookup_bool(boolean_values, "key1")) {
    # Do something
  }
}
```

## Directors

Directors allow you to distribute requests across multiple backends for load balancing.

### Random Director

A random director selects a backend randomly based on weights:

```vcl
director api_director random {
  .quorum = 50%;
  { .backend = api1; .weight = 3; }  # 3/6 = 50% of requests
  { .backend = api2; .weight = 2; }  # 2/6 = 33% of requests
  { .backend = api3; .weight = 1; }  # 1/6 = 17% of requests
}

sub vcl_recv {
  # Use the random director
  set req.backend = api_director;
}
```

### Hash Director

A hash director selects a backend based on a hash of a request attribute:

```vcl
director api_director hash {
  { .backend = api1; .weight = 1; }
  { .backend = api2; .weight = 1; }
  { .backend = api3; .weight = 1; }
}

sub vcl_recv {
  # Use the URL as the hash key
  set req.backend = api_director.backend(req.url);
}
```

### Client Director

A client director selects a backend based on the client IP address:

```vcl
director api_director client {
  { .backend = api1; .weight = 1; }
  { .backend = api2; .weight = 1; }
  { .backend = api3; .weight = 1; }
}

sub vcl_recv {
  # Use the client IP as the hash key
  set req.backend = api_director.backend();
}
```

### Fallback Director

A fallback director tries backends in order until a healthy one is found:

```vcl
director api_director fallback {
  { .backend = api1; }  # Try this backend first
  { .backend = api2; }  # If api1 is unhealthy, try this backend
  { .backend = api3; }  # If api1 and api2 are unhealthy, try this backend
}

sub vcl_recv {
  # Use the fallback director
  set req.backend = api_director.backend();
}
```

## Random Functions

Random functions allow you to generate random values for various purposes.

### Random Boolean

You can generate a random boolean with a specified probability:

```vcl
sub vcl_recv {
  # 50% chance of returning true
  if (std.random.randombool(0.5)) {
    set req.http.X-Random = "true";
  } else {
    set req.http.X-Random = "false";
  }
}
```

### Seeded Random Boolean

You can generate a deterministic random boolean with a specified probability and seed:

```vcl
sub vcl_recv {
  # 50% chance of returning true, using the client IP as the seed
  if (std.random.randombool_seeded(0.5, client.ip)) {
    set req.http.X-Random = "true";
  } else {
    set req.http.X-Random = "false";
  }
}
```

### Random Integer

You can generate a random integer within a specified range:

```vcl
sub vcl_recv {
  # Generate a random integer between 1 and 100
  set req.http.X-Random = std.random.randomint(1, 100);
}
```

### Seeded Random Integer

You can generate a deterministic random integer with a specified range and seed:

```vcl
sub vcl_recv {
  # Generate a random integer between 1 and 100, using the client IP as the seed
  set req.http.X-Random = std.random.randomint_seeded(1, 100, client.ip);
}
```

### Random String

You can generate a random string of a specified length:

```vcl
sub vcl_recv {
  # Generate a random string of 10 characters
  set req.http.X-Random = std.random.randomstr(10);

  # Generate a random string of 10 characters from a custom character set
  set req.http.X-Random-Hex = std.random.randomstr(10, "0123456789abcdef");
}
```

## A/B Testing

You can use random functions to implement A/B testing:

```vcl
sub vcl_recv {
  # Assign users to A or B variant (50/50 split)
  if (!req.http.Cookie:ABTest) {
    if (std.random.randombool(0.5)) {
      set req.http.X-ABTest = "A";
    } else {
      set req.http.X-ABTest = "B";
    }

    # Set a cookie to maintain the variant across requests
    add resp.http.Set-Cookie = "ABTest=" + req.http.X-ABTest + "; path=/; max-age=3600";
  } else {
    set req.http.X-ABTest = req.http.Cookie:ABTest;
  }

  # Add the variant to the cache key
  set req.http.Fastly-Cache-Key = req.http.X-ABTest;
}

sub vcl_deliver {
  # Add the variant to the response headers
  set resp.http.X-ABTest = req.http.X-ABTest;
}
```

## Content Rewriting

You can use VCL to rewrite content on the fly:

### URL Rewriting

```vcl
sub vcl_recv {
  # Rewrite old URLs to new URLs
  if (req.url ~ "^/old-path/(.*)") {
    set req.url = "/new-path/" + re.group.1;
  }
}
```

### Header Rewriting

```vcl
sub vcl_deliver {
  # Rewrite the Server header
  if (resp.http.Server) {
    set resp.http.Server = regsub(resp.http.Server, "Apache", "Fastly.JS");
  }
}
```

### Response Body Rewriting

Fastly.JS doesn't natively support response body rewriting, but you can simulate it using synthetic responses:

```vcl
sub vcl_fetch {
  # Check if the response is HTML
  if (beresp.http.Content-Type ~ "text/html") {
    # Create a synthetic response with modified content
    synthetic beresp.body;

    # Modify the synthetic response
    set beresp.body = regsub(beresp.body, "<title>(.*)</title>", "<title>Modified: \1</title>");

    return(deliver);
  }
}
```

## Geolocation

Fastly.JS provides geolocation information through the `client.geo` object:

```vcl
sub vcl_recv {
  # Set headers based on geolocation
  set req.http.X-Country = client.geo.country_code;
  set req.http.X-Region = client.geo.region;
  set req.http.X-City = client.geo.city;

  # Redirect users based on country
  if (client.geo.country_code == "US") {
    set req.http.Location = "https://us.example.com" + req.url;
    error 302 "Redirect";
  } else if (client.geo.country_code == "UK") {
    set req.http.Location = "https://uk.example.com" + req.url;
    error 302 "Redirect";
  }
}
```

## Edge Side Includes (ESI)

Edge Side Includes (ESI) allow you to assemble dynamic content at the edge. Fastly.JS now fully supports ESI processing, allowing you to include dynamic content in otherwise static pages.

### Enabling ESI Processing

To enable ESI processing, set the `beresp.do_esi` variable to `true` in your VCL:

```vcl
sub vcl_fetch {
  # Enable ESI processing for HTML content
  if (beresp.http.Content-Type ~ "text/html") {
    set beresp.do_esi = true;
  }
  return(deliver);
}
```

### Basic ESI Include Tags

The most common ESI tag is the include tag, which allows you to include content from another URL:

```html
<html>
  <head>
    <title>My Page</title>
  </head>
  <body>
    <div class="header">
      <esi:include src="/header" />
    </div>
    <div class="content">
      <p>This is the main content.</p>
    </div>
    <div class="footer">
      <esi:include src="/footer" />
    </div>
  </body>
</html>
```

### ESI Remove Tags

ESI remove tags allow you to remove content from the response:

```html
<html>
  <body>
    <h1>Welcome</h1>
    <esi:remove>
      <div class="debug">
        Debug information that should be removed in production
      </div>
    </esi:remove>
    <p>This content will remain.</p>
  </body>
</html>
```

### ESI Comment Tags

ESI comment tags allow you to add comments that will be removed from the response:

```html
<html>
  <body>
    <h1>Welcome</h1>
    <esi:comment text="This comment will be removed from the output" />
    <p>This content will remain.</p>
  </body>
</html>
```

### ESI Conditional Tags

ESI conditional tags allow you to include content based on conditions:

```html
<html>
  <body>
    <h1>Welcome</h1>
    <esi:choose>
      <esi:when test="$(HTTP_COOKIE{user_type}) == 'premium'">
        <div class="premium-content">
          Premium content here
        </div>
      </esi:when>
      <esi:otherwise>
        <div class="standard-content">
          Standard content here
        </div>
      </esi:otherwise>
    </esi:choose>
  </body>
</html>
```

This will include different content based on the value of the `user_type` cookie.

## Next Steps

Congratulations! You've completed the VCL tutorial series. You now have a solid understanding of VCL and how to use it with Fastly.JS.

For more information, check out the [examples](../examples) directory for real-world VCL configuration examples, or the [API reference](../api) for details on the JavaScript/TypeScript API.
