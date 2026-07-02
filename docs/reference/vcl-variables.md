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
8. **Time, Fastly, TLS, and WAF Variables**: Runtime state
9. **Local Variables**: User-defined variables for temporary storage

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

Header lookups are case-sensitive, and Fastly.JS stores incoming request and
origin response header names in lowercase, so headers that arrive from the
client or backend are read with lowercase names (`req.http.user-agent`,
`beresp.http.cache-control`). Headers your own VCL sets keep the casing you
write.

**Example:**
```vcl
if (req.http.user-agent ~ "Googlebot") {
  set req.http.X-Bot = "true";
}
```

### req.backend

The backend to use for the request. Assign a declared backend or director by name.

**Example:**
```vcl
set req.backend = my_director;
```

### Other request variables

- `req.url.basename`, `req.url.dirname`, `req.url.ext`: components of the URL path
- `req.restarts`: number of times the request has been restarted
- `req.method` aliases: `req.request` (legacy name)
- `req.body`, `req.postbody`, `req.body.base64`: the request body (when provided by the harness)
- `req.is_ssl`, `req.is_ipv6`, `req.is_purge`, `req.is_esi_subreq`, `req.is_background_fetch`, `req.is_clustering`
- `req.esi`, `req.esi_level`: ESI processing state
- `req.hash`, `req.digest`, `req.digest.ratio`: cache key data
- `req.hash_always_miss`, `req.hash_ignore_busy`: cache lookup modifiers
- `req.grace`, `req.max_stale_if_error`, `req.max_stale_while_revalidate`
- `req.xid`, `req.service_id`, `req.customer_id`, `req.vcl`, `req.vcl.md5`, `req.vcl.generation`, `req.vcl.version`
- `req.topurl`: URL of the top-level request in an ESI tree
- `req.headers`: all request headers serialized as a string
- `req.bytes_read`, `req.header_bytes_read`, `req.body_bytes_read` (always 0 locally)

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

### resp.response

The HTTP status text of the response. There is no `resp.body` variable; synthetic bodies are produced with the `synthetic` statement in `vcl_error`.

**Example:**
```vcl
set resp.response = "OK";
```

### Other response variables

- `resp.proto`: the protocol of the response
- `resp.is_locally_generated`: true for synthetic (error) responses
- `resp.completed`, `resp.stale`, `resp.stale.is_error`, `resp.stale.is_revalidating`
- `resp.headers`: all response headers serialized as a string
- `resp.bytes_written`, `resp.header_bytes_written`, `resp.body_bytes_written` (always 0 locally)

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

### Other backend request variables

- `bereq.url.path`, `bereq.url.qs`, `bereq.url.basename`, `bereq.url.dirname`, `bereq.url.ext`
- `bereq.proto`, `bereq.request` (legacy alias of `bereq.method`)
- `bereq.connect_timeout`, `bereq.first_byte_timeout`, `bereq.between_bytes_timeout`, `bereq.fetch_timeout`, `bereq.max_reuse_idle_time`
- `bereq.headers`: all backend request headers serialized as a string

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
if (beresp.http.cache-control ~ "private") {
  return(pass);
}
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

### Other backend response variables

There is no `beresp.body` variable; response bodies cannot be rewritten from VCL.

- `beresp.response`: the HTTP status text
- `beresp.proto`: the protocol of the backend response
- `beresp.cacheable`: whether the response is cacheable
- `beresp.do_esi`: enables ESI processing of the response
- `beresp.do_stream`, `beresp.gzip`, `beresp.brotli`, `beresp.saintmode`, `beresp.hipaa`, `beresp.pci`
- `beresp.backend.name`, `beresp.backend.ip`, `beresp.backend.port`, `beresp.backend.src_ip`, `beresp.backend.src_port`, `beresp.backend.requests`, `beresp.backend.alternate_ips`
- `beresp.headers`: all backend response headers serialized as a string
- `beresp.handshake_time_to_origin_ms`, `beresp.used_alternate_path_to_origin`

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
set resp.http.X-Cache-Control = obj.http.cache-control;
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

### Other object variables

- `obj.response`: the status text (in `vcl_error`, the error message; not set until an error occurs)
- `obj.proto`: the protocol
- `obj.cacheable`, `obj.is_pci`
- `obj.stale_if_error`, `obj.stale_while_revalidate`
- `obj.lastuse`, `obj.entered`
- `obj.headers`: all object headers serialized as a string

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

### client.geo.*

The full set of `client.geo.*` fields is implemented: `country_code`, `country_code3`, `country_name`, `continent_code`, `city`, `region`, `postal_code`, `latitude`, `longitude`, `metro_code`, `area_code`, `gmt_offset`, `utc_offset`, `conn_speed`, `conn_type`, `proxy_description`, `proxy_type`, and the `.ascii`/`.latin1`/`.utf8` variants of the name fields.

There is no geolocation database locally, so unless you populate `context.client.geo` from JavaScript before invoking the VCL pipeline, string fields read `"unknown"` and the coordinates default to Fastly's San Francisco headquarters (37.779, -122.398) — the same values Fastly returns when geolocation fails. The legacy `geoip.*` variables are an alias for `client.geo.*`.

```vcl
if (client.geo.country_code == "US") {
  set req.http.X-Region = "NA";
}
```

### Other client variables

- `client.identity`: identity string used by `client` directors (defaults to `client.ip`)
- `client.requests`, `client.identified`, `client.sess_timeout`
- `client.as.number`, `client.as.name`: autonomous system info (loopback space maps to the reserved AS)
- `client.browser.name`, `client.browser.version`, `client.os.name`, `client.os.version`, `client.bot.name`
- `client.class.*` (bot, browser, checker, ...): always false locally
- `client.platform.*` (hwtype, model, vendor, mobile, tablet, ...)
- `client.display.*` (width, height, ppi, touchscreen)
- `client.socket.*` (congestion_algorithm, cwnd, nexthop, TCP info counters)

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

### Other server variables

`server.identity`, `server.datacenter`, `server.region`, `server.pop`, and `server.billing_region` are available; locally they default to `"localhost"` / `"local"` unless overridden on the context.

## Time and Fastly Variables

### now / now.sec

`now` is the current time as a TIME value; `now.sec` is the Unix epoch seconds as a string.

**Example:**
```vcl
set resp.http.X-Now = now;
```

### time.start, time.elapsed, time.end

Request timing variables, each with `.sec`, `.msec`, `.usec`, `.msec_frac`, and `.usec_frac` accessors. `time.to_first_byte` is also recognized.

### fastly.error

The last error raised by a builtin function (for example `EPARSENUM` from `std.atoi`, or `EINVAL` from `time.units`). Empty when no error has occurred.

**Example:**
```vcl
set var.i = std.atoi(req.http.X-Count);
if (fastly.error == "EPARSENUM") {
  set var.i = 0;
}
```

### fastly_info.state

The current request state (e.g. set to `"error"` after an `error` statement). Other `fastly_info.*` fields (`is_h2`, `is_h3`, `host_header`, `request_id`, ...) are recognized with local defaults.

### Other runtime variables

- `LF`: a newline character, for use in string concatenation
- `workspace.bytes_total`, `workspace.bytes_free`, `workspace.overflowed`: request workspace accounting
- `tls.client.*`: TLS session data (`protocol`, `cipher`, `servername`, `ja3_md5`, `ja4`, cipher/extension lists, `tls.client.certificate.*`); populated with synthetic defaults locally
- `waf.*`: WAF state (`waf.executed`, `waf.blocked`, `waf.passed`, `waf.logged`, `waf.anomaly_score`, and the per-category scores)
- `transport.type`, `quic.*`, `segmented_caching.*`, `backend.socket.*`, `backend.conn.*`: recognized with local defaults
- `stale.exists`, `req.enable_segmented_caching`, `req.enable_range_on_pass`: recognized, inert locally

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
set var.is_mobile = (req.http.user-agent ~ "Mobile");
set var.device_type = if(var.is_mobile, "mobile", "desktop");
set var.request_count = 1;
```

## Variable Types

VCL supports the following variable types:

- `STRING`: Text strings (locals start out not set)
- `INTEGER`: Integer numbers (`INT` is accepted as an alias; starts at 0)
- `FLOAT`: Floating-point numbers (starts at 0)
- `TIME`: Absolute time values
- `RTIME`: Relative time values (e.g., 3600s, 24h)
- `BOOL`: Boolean values (starts at false)
- `IP`: IP addresses (starts out not set)
- `BACKEND`: Backend references (assigning one to `req.backend` dereferences to the backend it holds)

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
if (req.http.user-agent ~ "Googlebot") {
  # Do something
}
```

### Modifying Variables

```vcl
set req.url = regsuball(req.url, "^/old/", "/new/");
```

### Unsetting Variables

```vcl
unset req.http.cookie;
```

## Conclusion

VCL variables provide a powerful way to access and manipulate request and response data during the request-response lifecycle. By understanding and using these variables effectively, you can implement complex caching strategies, security measures, and content transformation logic.

For more information on VCL functions, see the [VCL Functions Reference](./vcl-functions.md).
