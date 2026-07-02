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

You can use an ACL to control access to resources. The ACL match must be the whole `if` condition — combining `client.ip ~ acl` with `&&` or negating it with `!` is not currently supported — so use an `if`/`else`:

```vcl
sub vcl_recv {
  # Allow only internal IPs to access the admin area
  if (req.url ~ "^/admin/") {
    if (client.ip ~ internal) {
      # Allowed
    } else {
      error 403 "Forbidden";
    }
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
  if (req.url ~ "^/admin/") {
    if (client.ip ~ internal) {
      # Allowed
    } else {
      error 403 "Forbidden";
    }
  }

  # Allow trusted partners to access the API
  if (req.url ~ "^/api/partners/") {
    if (client.ip ~ trusted_partners) {
      # Allowed
    } else {
      error 403 "Forbidden";
    }
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

You can use a table for lookups. Since headers set on `req` are not copied to the error response automatically, attach the `Location` header in `vcl_error`:

```vcl
sub vcl_recv {
  # Check if the URL path is in the redirects table
  if (table.contains(redirects, req.url)) {
    # Get the new path from the table
    set req.http.X-Redirect-Location = "https://" + req.http.host + table.lookup(redirects, req.url);
    error 301 "Moved Permanently";
  }
}

sub vcl_error {
  if (obj.status == 301 && req.http.X-Redirect-Location) {
    set obj.http.Location = req.http.X-Redirect-Location;
    synthetic "";
    return(deliver);
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

Directors allow you to distribute requests across multiple backends for load balancing. A director is used by assigning it to `req.backend`; there is no `.backend()` method syntax.

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

A hash director selects a backend based on the cache hash key (the data collected with `hash_data()` in `vcl_hash`):

```vcl
director api_director hash {
  { .backend = api1; .weight = 1; }
  { .backend = api2; .weight = 1; }
  { .backend = api3; .weight = 1; }
}

sub vcl_recv {
  set req.backend = api_director;
}
```

### Client Director

A client director selects a backend based on the client identity, which Fastly.JS derives from the `X-Client-Identity` request header (falling back to the `Cookie` header):

```vcl
director api_director client {
  { .backend = api1; .weight = 1; }
  { .backend = api2; .weight = 1; }
  { .backend = api3; .weight = 1; }
}

sub vcl_recv {
  set req.backend = api_director;
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
  set req.backend = api_director;
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

You can use random functions to implement A/B testing. Assign the variant in `vcl_recv`, but set the cookie in `vcl_deliver` — response headers set in `vcl_recv` are overwritten when the response is built:

```vcl
sub vcl_recv {
  # Assign users to A or B variant (50/50 split)
  if (req.http.cookie ~ "ABTest=") {
    set req.http.X-ABTest = regsub(req.http.cookie, ".*ABTest=([^;]+).*", "\1");
  } else if (std.random.randombool(0.5)) {
    set req.http.X-ABTest = "A";
  } else {
    set req.http.X-ABTest = "B";
  }
}

sub vcl_hash {
  # Add the variant to the cache key
  hash_data(req.url);
  hash_data(req.http.host);
  hash_data(req.http.X-ABTest);
  return(hash);
}

sub vcl_deliver {
  # Add the variant to the response headers
  set resp.http.X-ABTest = req.http.X-ABTest;

  # Set a cookie to maintain the variant across requests
  if (req.http.cookie !~ "ABTest=") {
    add resp.http.Set-Cookie = "ABTest=" + req.http.X-ABTest + "; path=/; max-age=3600";
  }
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
  if (resp.http.server) {
    set resp.http.server = regsub(resp.http.server, "Apache", "Fastly.JS");
  }
}
```

### Response Body Rewriting

Fastly.JS does not support rewriting backend response bodies. The `synthetic` statement replaces the response body, but it is only valid inside `vcl_error`, so the closest equivalent is serving a synthetic body for error responses (see the [Error Handling](./05-error-handling.md) tutorial). If you need to transform proxied bodies, do it in JavaScript around the pipeline rather than in VCL.

## Geolocation

> **No geolocation database.** The `client.geo.*` variables resolve, but without a geolocation database the string fields (country code, region, city, and so on) all read `"unknown"`, and the coordinates default to Fastly's San Francisco headquarters. To make the example below actually work locally, populate `client.geo` on the context from JavaScript before running the pipeline, or inject headers like `req.http.X-Country` from your test harness.

```vcl
sub vcl_recv {
  # Set headers based on geolocation (reads "unknown" without a geo database)
  set req.http.X-Country = client.geo.country_code;
  set req.http.X-Region = client.geo.region;
  set req.http.X-City = client.geo.city;

  # Redirect users based on country
  if (client.geo.country_code == "US") {
    set req.http.X-Redirect-Location = "https://us.example.com" + req.url;
    error 302 "Found";
  } else if (client.geo.country_code == "UK") {
    set req.http.X-Redirect-Location = "https://uk.example.com" + req.url;
    error 302 "Found";
  }
}

sub vcl_error {
  # Attach the Location header to the redirect response
  if (obj.status == 302 && req.http.X-Redirect-Location) {
    set obj.http.Location = req.http.X-Redirect-Location;
    synthetic "";
    return(deliver);
  }
}
```

## Edge Side Includes (ESI)

Edge Side Includes (ESI) allow you to assemble dynamic content at the edge. Fastly.JS ships an ESI processor covering the most common tags: `esi:include`, `esi:remove`, `esi:comment`, and `esi:choose`/`esi:when`/`esi:otherwise`.

Two caveats apply to the current implementation:

- `esi:include` does not perform real backend subrequests; includes resolve to built-in placeholder content, so treat the include examples as documentation of the tag syntax.
- `esi:when` conditions only support cookie comparisons of the form `$(HTTP_COOKIE{name}) == 'value'`.

### Enabling ESI Processing

To enable ESI processing, set the `beresp.do_esi` variable to `true` in your VCL. ESI is applied when the response `Content-Type` contains `text/html`:

```vcl
sub vcl_fetch {
  # Enable ESI processing for HTML content
  if (beresp.http.content-type ~ "text/html") {
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
