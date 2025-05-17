# VCL Variables Reference

VCL (Varnish Configuration Language) variables provide access to request and response data during the request-response lifecycle. This document provides a reference for the standard VCL variables supported by Fastly.JS.

## Overview

VCL variables are organized into several categories:

1. **Request Variables**: Information about the client request
2. **Response Variables**: Information about the response to the client
3. **Backend Request Variables**: Information about the request to the backend
4. **Backend Response Variables**: Information about the response from the backend
5. **Cache Object Variables**: Information about the cached object
6. **Client Variables**: Information about the client
7. **Server Variables**: Information about the server
8. **Local Variables**: User-defined variables for temporary storage

## Request Variables (req.*)

Request variables contain information about the client request.

### req.method

The HTTP method of the request (e.g., "GET", "POST").

**Example:**
```vcl
if (req.method == "POST") {
  return(pass);
}
```

### req.url

The URL of the request, including the query string.

**Example:**
```vcl
if (req.url ~ "^/api/") {
  set req.backend = api_backend;
}
```

### req.url.path

The path component of the URL, without the query string.

**Example:**
```vcl
if (req.url.path == "/login") {
  return(pass);
}
```

### req.url.qs

The query string component of the URL.

**Example:**
```vcl
if (req.url.qs ~ "debug=true") {
  set req.http.X-Debug = "true";
}
```

### req.proto

The HTTP protocol version (e.g., "HTTP/1.1", "HTTP/2.0").

**Example:**
```vcl
if (req.proto == "HTTP/2.0") {
  set req.http.X-HTTP2 = "true";
}
```

### req.http.*

HTTP headers in the request.

**Example:**
```vcl
if (req.http.User-Agent ~ "Googlebot") {
  set req.http.X-Bot = "true";
}
```

### req.backend

The backend to use for the request.

**Example:**
```vcl
set req.backend = std.director.select_backend("my_director").name;
```

## Response Variables (resp.*)

Response variables contain information about the response to the client.

### resp.status

The HTTP status code of the response.

**Example:**
```vcl
if (resp.status == 404) {
  set resp.http.X-Custom-404 = "true";
}
```

### resp.http.*

HTTP headers in the response.

**Example:**
```vcl
set resp.http.X-Served-By = "Fastly.JS";
```

### resp.body

The body of the response.

**Example:**
```vcl
set resp.body = regsuball(resp.body, "old-domain.com", "new-domain.com");
```

## Backend Request Variables (bereq.*)

Backend request variables contain information about the request to the backend.

### bereq.method

The HTTP method of the backend request.

**Example:**
```vcl
if (bereq.method == "GET") {
  set bereq.http.X-Cache-Miss = "true";
}
```

### bereq.url

The URL of the backend request.

**Example:**
```vcl
set bereq.url = regsuball(bereq.url, "^/api/v1/", "/api/v2/");
```

### bereq.http.*

HTTP headers in the backend request.

**Example:**
```vcl
set bereq.http.X-Forwarded-For = client.ip;
```

## Backend Response Variables (beresp.*)

Backend response variables contain information about the response from the backend.

### beresp.status

The HTTP status code of the backend response.

**Example:**
```vcl
if (beresp.status == 503) {
  set beresp.ttl = 30s;
  return(deliver);
}
```

### beresp.http.*

HTTP headers in the backend response.

**Example:**
```vcl
if (beresp.http.Cache-Control ~ "private") {
  return(pass);
}
```

### beresp.body

The body of the backend response.

**Example:**
```vcl
set beresp.body = regsuball(beresp.body, "old-domain.com", "new-domain.com");
```

### beresp.ttl

The time-to-live for the cached object.

**Example:**
```vcl
set beresp.ttl = 3600s;
```

### beresp.grace

The grace period for the cached object.

**Example:**
```vcl
set beresp.grace = 24h;
```

### beresp.stale_while_revalidate

The stale-while-revalidate period for the cached object.

**Example:**
```vcl
set beresp.stale_while_revalidate = 60s;
```

### beresp.stale_if_error

The stale-if-error period for the cached object.

**Example:**
```vcl
set beresp.stale_if_error = 24h;
```

## Cache Object Variables (obj.*)

Cache object variables contain information about the cached object.

### obj.status

The HTTP status code of the cached object.

**Example:**
```vcl
if (obj.status == 200) {
  set resp.http.X-Cache-Status = "HIT";
}
```

### obj.http.*

HTTP headers in the cached object.

**Example:**
```vcl
set resp.http.X-Cache-Control = obj.http.Cache-Control;
```

### obj.hits

The number of cache hits for the object.

**Example:**
```vcl
set resp.http.X-Cache-Hits = obj.hits;
```

### obj.ttl

The remaining time-to-live for the cached object.

**Example:**
```vcl
if (obj.ttl < 60s) {
  set resp.http.X-Cache-TTL = "expiring soon";
}
```

### obj.grace

The remaining grace period for the cached object.

**Example:**
```vcl
if (obj.ttl <= 0s && obj.grace > 0s) {
  set resp.http.X-Cache-Status = "STALE";
}
```

### obj.age

The age of the cached object.

**Example:**
```vcl
set resp.http.X-Cache-Age = obj.age;
```

## Client Variables (client.*)

Client variables contain information about the client.

### client.ip

The IP address of the client.

**Example:**
```vcl
if (client.ip ~ internal_ips) {
  set req.http.X-Internal = "true";
}
```

### client.port

The port of the client.

**Example:**
```vcl
set req.http.X-Client-Port = client.port;
```

### client.geo.country_code

The country code of the client's location.

**Example:**
```vcl
if (client.geo.country_code == "US") {
  set req.http.X-Region = "NA";
}
```

### client.geo.continent_code

The continent code of the client's location.

**Example:**
```vcl
if (client.geo.continent_code == "EU") {
  set req.http.X-Region = "Europe";
}
```

### client.geo.city

The city of the client's location.

**Example:**
```vcl
set req.http.X-City = client.geo.city;
```

## Server Variables (server.*)

Server variables contain information about the server.

### server.ip

The IP address of the server.

**Example:**
```vcl
set resp.http.X-Server-IP = server.ip;
```

### server.port

The port of the server.

**Example:**
```vcl
set resp.http.X-Server-Port = server.port;
```

### server.hostname

The hostname of the server.

**Example:**
```vcl
set resp.http.X-Server-Hostname = server.hostname;
```

## Local Variables

Local variables are user-defined variables for temporary storage.

### declare local

Declares a local variable with a specific type.

**Example:**
```vcl
declare local var.is_mobile BOOL;
declare local var.device_type STRING;
declare local var.request_count INT;
```

### set

Sets the value of a local variable.

**Example:**
```vcl
set var.is_mobile = (req.http.User-Agent ~ "Mobile");
set var.device_type = var.is_mobile ? "mobile" : "desktop";
set var.request_count = 1;
```

## Variable Types

VCL supports the following variable types:

- `STRING`: Text strings
- `INT`: Integer numbers
- `FLOAT`: Floating-point numbers
- `TIME`: Time values (e.g., 3600s, 24h)
- `RTIME`: Relative time values
- `BOOL`: Boolean values (true/false)
- `IP`: IP addresses
- `BACKEND`: Backend references

## Variable Scope

Variables in VCL have different scopes:

- **Global Variables**: Available throughout the request-response lifecycle (e.g., `req`, `resp`, `bereq`, `beresp`, `obj`, `client`, `server`)
- **Local Variables**: Available only within the subroutine where they are declared
- **Subroutine-Specific Variables**: Available only within specific subroutines (e.g., `obj` in `vcl_error`)

## Working with Variables

### Setting Variables

```vcl
set req.http.X-Custom = "value";
set var.count = 42;
```

### Reading Variables

```vcl
if (req.http.User-Agent ~ "Googlebot") {
  # Do something
}
```

### Modifying Variables

```vcl
set req.url = regsuball(req.url, "^/old/", "/new/");
```

### Unsetting Variables

```vcl
unset req.http.Cookie;
```

## Conclusion

VCL variables provide a powerful way to access and manipulate request and response data during the request-response lifecycle. By understanding and using these variables effectively, you can implement complex caching strategies, security measures, and content transformation logic.

For more information on VCL functions, see the [VCL Functions Reference](./vcl-functions.md).
