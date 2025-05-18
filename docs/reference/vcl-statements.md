# VCL Statements Reference

VCL (Varnish Configuration Language) statements control the flow of execution and manipulate data during the request-response lifecycle. This document provides a reference for the standard VCL statements supported by Fastly.JS.

## Overview

VCL statements are organized into several categories:

1. **Assignment Statements**: Set values of variables
2. **Control Flow Statements**: Control the flow of execution
3. **Subroutine Statements**: Define and call subroutines
4. **Return Statements**: Return values from subroutines
5. **Error Statements**: Generate error responses
6. **Synthetic Statements**: Generate synthetic responses
7. **Declaration Statements**: Declare local variables

## Assignment Statements

### set

Sets the value of a variable.

**Syntax:**
```vcl
set variable = expression;
```

**Example:**
```vcl
set req.http.X-Custom = "value";
set var.count = 42;
set req.backend = my_backend;
```

### unset

Removes a variable.

**Syntax:**
```vcl
unset variable;
```

**Example:**
```vcl
unset req.http.Cookie;
unset resp.http.Server;
```

### add

Adds a value to a header, creating it if it doesn't exist.

**Syntax:**
```vcl
add variable = expression;
```

**Example:**
```vcl
add req.http.X-Custom = "value";
```

## Control Flow Statements

### if / else if / else

Conditionally executes code based on a condition.

**Syntax:**
```vcl
if (condition) {
  # Code to execute if condition is true
} else if (another_condition) {
  # Code to execute if another_condition is true
} else {
  # Code to execute if all conditions are false
}
```

**Example:**
```vcl
if (req.url ~ "^/api/") {
  set req.http.X-API = "true";
  return(pass);
} else if (req.url ~ "^/static/") {
  set req.http.X-Static = "true";
  return(lookup);
} else {
  set req.http.X-Default = "true";
  return(lookup);
}
```

### for

Iterates over a list of items.

**Syntax:**
```vcl
for (variable in list) {
  # Code to execute for each item
}
```

**Example:**
```vcl
for (backend in backends) {
  if (backend.healthy) {
    set req.backend = backend;
    break;
  }
}
```

### break

Exits a loop.

**Syntax:**
```vcl
break;
```

**Example:**
```vcl
for (backend in backends) {
  if (backend.healthy) {
    set req.backend = backend;
    break;
  }
}
```

### continue

Skips to the next iteration of a loop.

**Syntax:**
```vcl
continue;
```

**Example:**
```vcl
for (backend in backends) {
  if (!backend.healthy) {
    continue;
  }
  set req.backend = backend;
  break;
}
```

### goto

Jumps to a labeled section of code.

**Syntax:**
```vcl
goto label_name;
```

**Example:**
```vcl
if (req.http.Host == "admin.example.com") {
  goto admin_processing;
}

# Regular processing
set req.http.X-Request-Type = "regular";
goto request_end;

# Admin processing
admin_processing:
  set req.http.X-Request-Type = "admin";
  set req.http.X-Admin-Access = "true";

# End of processing
request_end:
  set req.http.X-Processing-Complete = "true";
```

## Subroutine Statements

### sub

Defines a subroutine.

**Syntax:**
```vcl
sub name {
  # Code to execute
}
```

**Example:**
```vcl
sub vcl_recv {
  set req.backend = default;
  return(lookup);
}
```

### call

Calls a subroutine.

**Syntax:**
```vcl
call name;
```

**Example:**
```vcl
call check_auth;
```

## Return Statements

### return

Returns a value from a subroutine.

**Syntax:**
```vcl
return(action);
```

**Example:**
```vcl
return(lookup);
return(pass);
return(pipe);
return(deliver);
return(error);
return(restart);
```

## Error Statements

### error

Generates an error response.

**Syntax:**
```vcl
error status_code "message";
```

**Example:**
```vcl
error 403 "Forbidden";
error 404 "Not Found";
error 500 "Internal Server Error";
```

## Synthetic Statements

### synthetic

Generates a synthetic response body.

**Syntax:**
```vcl
synthetic "body";
```

**Example:**
```vcl
synthetic {"
  <!DOCTYPE html>
  <html>
    <head>
      <title>Error</title>
    </head>
    <body>
      <h1>Error</h1>
      <p>An error occurred.</p>
    </body>
  </html>
"};
```

### synthetic.base64

Generates a synthetic response body from base64-encoded data.

**Syntax:**
```vcl
synthetic.base64 "base64_encoded_body";
```

**Example:**
```vcl
synthetic.base64 "PGgxPkVycm9yPC9oMT4=";
```

## Declaration Statements

### declare local

Declares a local variable with a specific type.

**Syntax:**
```vcl
declare local var.name TYPE;
```

**Example:**
```vcl
declare local var.is_mobile BOOL;
declare local var.device_type STRING;
declare local var.request_count INT;
```

## Backend Declaration

### backend

Defines a backend server.

**Syntax:**
```vcl
backend name {
  .host = "hostname";
  .port = "port";
  .connect_timeout = timeout;
  .first_byte_timeout = timeout;
  .between_bytes_timeout = timeout;
  .probe = {
    .url = "url";
    .interval = interval;
    .timeout = timeout;
    .window = window;
    .threshold = threshold;
  }
}
```

**Example:**
```vcl
backend default {
  .host = "example.com";
  .port = "80";
  .connect_timeout = 1s;
  .first_byte_timeout = 15s;
  .between_bytes_timeout = 10s;
  .probe = {
    .url = "/health";
    .interval = 5s;
    .timeout = 1s;
    .window = 5;
    .threshold = 3;
  }
}
```

## ACL Declaration

### acl

Defines an access control list.

**Syntax:**
```vcl
acl name {
  "ip_address";
  "ip_range";
}
```

**Example:**
```vcl
acl internal_ips {
  "192.168.1.0"/24;
  "10.0.0.1";
  "2001:db8::/32";
}
```

## Table Declaration

### table

Defines a lookup table.

**Syntax:**
```vcl
table name {
  "key": "value",
  "key": "value"
}
```

**Example:**
```vcl
table redirects {
  "/old-page": "/new-page",
  "/deprecated": "/current"
}
```

## Import Statement

### import

Imports a VCL module.

**Syntax:**
```vcl
import module;
```

**Example:**
```vcl
import std;
import directors;
import crypto;
```

## Include Statement

### include

Includes another VCL file.

**Syntax:**
```vcl
include "file";
```

**Example:**
```vcl
include "common.vcl";
include "backends.vcl";
```

## Restart Statement

### restart

Restarts the request processing.

**Syntax:**
```vcl
restart;
```

**Example:**
```vcl
if (req.restarts < 3) {
  restart;
}
```

## Hash Statement

### hash_data

Adds data to the cache hash.

**Syntax:**
```vcl
hash_data(data);
```

**Example:**
```vcl
hash_data(req.url);
hash_data(req.http.host);
```

## Logging Statement

### log

Logs a message.

**Syntax:**
```vcl
log "message";
```

**Example:**
```vcl
log "Request received: " + req.url;
```

## Conclusion

VCL statements provide a powerful way to control the flow of execution and manipulate data during the request-response lifecycle. By understanding and using these statements effectively, you can implement complex caching strategies, security measures, and content transformation logic.

For more information on VCL operators, see the [VCL Operators Reference](./vcl-operators.md).
