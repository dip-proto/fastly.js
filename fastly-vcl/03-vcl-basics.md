# VCL Basics

## Introduction

Varnish Configuration Language (VCL) is a domain-specific language used to define how Fastly processes HTTP requests and responses. This document covers the basic syntax, data types, operators, and constructs of Fastly VCL.

## Syntax

VCL syntax is C-like, with curly braces, semicolons, and similar control structures. Each VCL file consists of one or more subroutines, each containing statements that are executed in order.

### Comments

VCL supports both single-line and multi-line comments:

```vcl
// This is a single-line comment

/*
 This is a
 multi-line comment
*/
```

### Statements

Statements in VCL end with a semicolon:

```vcl
set req.http.Host = "example.com";
```

### Blocks

Blocks of code are enclosed in curly braces:

```vcl
sub vcl_recv {
    if (req.url ~ "^/api/") {
        set req.backend = F_api_backend;
    }
}
```

## Data Types

Fastly VCL is a statically typed language with several built-in types:

### BOOL

Boolean values can be either `true` or `false`:

```vcl
declare local var.is_mobile BOOL;
set var.is_mobile = (req.http.User-Agent ~ "Mobile|Android|iPhone");
```

### INTEGER

Integer values are whole numbers:

```vcl
declare local var.status_code INTEGER;
set var.status_code = 404;
```

### FLOAT

Floating-point values represent real numbers:

```vcl
declare local var.pi FLOAT;
set var.pi = 3.14159;
```

### TIME

Time values represent absolute points in time:

```vcl
declare local var.request_time TIME;
set var.request_time = now;
```

### RTIME

Relative time values represent durations:

```vcl
declare local var.timeout RTIME;
set var.timeout = 30s; // 30 seconds
```

Time units include:
- `ms` (milliseconds)
- `s` (seconds)
- `m` (minutes)
- `h` (hours)
- `d` (days)
- `y` (years)

### STRING

String values represent text:

```vcl
declare local var.greeting STRING;
set var.greeting = "Hello, world!";
```

Strings can be concatenated with the `+` operator or by placing them adjacent to each other:

```vcl
set var.greeting = "Hello, " + "world!";
set var.greeting = "Hello, " "world!"; // Same result
```

### IP

IP addresses can be IPv4 or IPv6:

```vcl
declare local var.client_ip IP;
set var.client_ip = client.ip;
```

### BACKEND

Backend values represent origin servers:

```vcl
backend F_origin {
    .host = "www.example.com";
    .port = "443";
    .ssl = true;
}
```

### ACL

Access Control Lists (ACLs) represent sets of IP addresses:

```vcl
acl internal_ips {
    "192.168.0.0"/24;
    "10.0.0.0"/8;
}
```

### REGEX

Regular expressions are used for pattern matching:

```vcl
if (req.url ~ "^/api/v[0-9]+/") {
    // Handle API requests
}
```

## Variables

VCL provides several built-in variables that represent different aspects of the HTTP request and response:

### Request Variables

- `req.url`: The URL path and query string
- `req.http.*`: HTTP request headers
- `req.method`: The HTTP method (GET, POST, etc.)
- `req.proto`: The HTTP protocol version
- `req.backend`: The selected backend

### Backend Request Variables

- `bereq.url`: The URL sent to the backend
- `bereq.http.*`: HTTP headers sent to the backend
- `bereq.method`: The HTTP method sent to the backend

### Backend Response Variables

- `beresp.status`: The HTTP status code from the backend
- `beresp.http.*`: HTTP headers from the backend
- `beresp.ttl`: The cache TTL for the response
- `beresp.grace`: The grace period for the response

### Client Response Variables

- `resp.status`: The HTTP status code sent to the client
- `resp.http.*`: HTTP headers sent to the client
- `resp.response`: The HTTP status message

### Cached Object Variables

- `obj.ttl`: The remaining TTL for the cached object
- `obj.grace`: The remaining grace period for the cached object
- `obj.hits`: The number of cache hits for the object

### Client Variables

- `client.ip`: The client's IP address
- `client.identity`: The client's identity (defaults to IP)

### Server Variables

- `server.identity`: The server's identity
- `server.region`: The server's region

## Local Variables

You can declare local variables within subroutines:

```vcl
sub vcl_recv {
    declare local var.is_mobile BOOL;
    declare local var.device_type STRING;
    
    set var.is_mobile = (req.http.User-Agent ~ "Mobile|Android|iPhone");
    
    if (var.is_mobile) {
        set var.device_type = "mobile";
    } else {
        set var.device_type = "desktop";
    }
    
    set req.http.X-Device-Type = var.device_type;
}
```

## Operators

### Assignment Operators

- `=`: Basic assignment
- `+=`: Add and assign
- `-=`: Subtract and assign
- `*=`: Multiply and assign
- `/=`: Divide and assign
- `%=`: Modulo and assign

### Comparison Operators

- `==`: Equal to
- `!=`: Not equal to
- `<`: Less than
- `>`: Greater than
- `<=`: Less than or equal to
- `>=`: Greater than or equal to
- `~`: Matches regular expression
- `!~`: Does not match regular expression

### Logical Operators

- `&&`: Logical AND
- `||`: Logical OR
- `!`: Logical NOT

## Control Structures

### Conditional Statements

VCL supports if-else statements:

```vcl
if (req.url ~ "^/api/") {
    set req.backend = F_api_backend;
} else if (req.url ~ "^/admin/") {
    set req.backend = F_admin_backend;
} else {
    set req.backend = F_default_backend;
}
```

### Return Statements

Return statements are used to exit a subroutine and determine the next state in the request flow:

```vcl
sub vcl_recv {
    if (req.http.Cookie ~ "session=") {
        return(pass);
    }
    return(lookup);
}
```

## Functions

VCL provides a rich set of built-in functions for various tasks:

### String Manipulation

```vcl
// Substring extraction
set req.http.X-First-Five = substr(req.url, 0, 5);

// Regular expression replacement
set req.url = regsub(req.url, "^/blog/([0-9]{4})/([0-9]{2})/", "/blog/\1-\2-");

// Multiple replacements
set req.url = regsuball(req.url, "[?&]utm_[^&]*", "");

// String length
if (std.strlen(req.http.User-Agent) > 500) {
    set req.http.User-Agent = substr(req.http.User-Agent, 0, 500);
}
```

### Encoding and Hashing

```vcl
// URL encoding
set req.http.X-Encoded = urlencode(req.url);

// Base64 encoding
set req.http.X-Base64 = digest.base64(req.http.Authorization);

// MD5 hash
set req.http.X-MD5 = digest.hash_md5(req.url);

// SHA-256 hash
set req.http.X-SHA256 = digest.hash_sha256(req.url);
```

### Time Functions

```vcl
// Current time
set req.http.X-Now = now;

// Time formatting
set req.http.X-Date = strftime({"%Y-%m-%d %H:%M:%S"}, now);

// Time parsing
set req.http.X-Timestamp = std.time(req.http.Date, now);
```

### Randomization

```vcl
// Random integer
set req.http.X-Random = randomint(1, 100);

// Random real number
set req.http.X-Random-Real = randomint(1, 1000) / 1000.0;
```

### Geolocation

```vcl
// Client country code
set req.http.X-Country = client.geo.country_code;

// Client region
set req.http.X-Region = client.geo.region;

// Client city
set req.http.X-City = client.geo.city;
```

## Subroutines

Subroutines are the building blocks of VCL. They can be built-in (like `vcl_recv`) or custom:

```vcl
sub normalize_url {
    // Remove trailing slash
    if (req.url.path ~ "(.+)/$") {
        set req.url = regsub(req.url, "/$", "");
    }
    
    // Convert to lowercase
    set req.url = std.tolower(req.url);
}

sub vcl_recv {
    call normalize_url;
    
    // Rest of vcl_recv logic
}
```

Subroutines can also return values:

```vcl
sub is_mobile_device BOOL {
    if (req.http.User-Agent ~ "Mobile|Android|iPhone") {
        return true;
    }
    return false;
}

sub vcl_recv {
    declare local var.mobile BOOL;
    set var.mobile = is_mobile_device();
    
    if (var.mobile) {
        set req.http.X-Device-Type = "mobile";
    } else {
        set req.http.X-Device-Type = "desktop";
    }
}
```

## Error Handling

VCL provides mechanisms for handling errors:

```vcl
sub vcl_recv {
    if (req.url ~ "^/forbidden/") {
        error 403 "Forbidden";
    }
}

sub vcl_error {
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

## Best Practices

1. **Keep It Simple**: VCL is powerful but can become complex. Keep your code as simple as possible.

2. **Use Comments**: Document your code with comments to explain the purpose of each section.

3. **Use Meaningful Variable Names**: Choose descriptive names for your variables.

4. **Modularize Your Code**: Use custom subroutines to organize your code into logical units.

5. **Test Thoroughly**: Test your VCL code in a staging environment before deploying to production.

6. **Be Careful with Regular Expressions**: Regular expressions can be powerful but can also impact performance if used excessively.

7. **Consider Edge Cases**: Think about how your code will handle edge cases, such as malformed requests or backend failures.

In the next section, we'll explore backend configuration in more detail.