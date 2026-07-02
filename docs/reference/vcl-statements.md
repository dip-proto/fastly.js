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

Sets the value of a variable. Besides plain assignment, `set` accepts the
compound assignment operators listed in the
[VCL Operators Reference](./vcl-operators.md#assignment-operators).

**Syntax:**
```vcl
set variable = expression;
set variable += expression;
```

**Example:**
```vcl
set req.http.X-Custom = "value";
set var.count = 42;
set req.backend = my_backend;
```

### unset

Removes a header or local variable. `remove` is accepted as an alias. A
trailing `*` wildcard removes every matching header.

**Syntax:**
```vcl
unset variable;
remove variable;
```

**Example:**
```vcl
unset req.http.cookie;
unset resp.http.server;
unset req.http.X-Debug-*;
```

Note that header lookups are case-sensitive and Fastly.JS stores incoming
request and origin response header names in lowercase, so client and origin
headers (`cookie`, `server`, `content-type`, ...) are written in lowercase in
the examples below. Headers your own VCL sets keep the casing you write.

### add

Adds another line of a header, keeping any existing lines. Only HTTP headers
(`req.http.*`, `bereq.http.*`, `beresp.http.*`, `resp.http.*`, `obj.http.*`)
can be targets.

**Syntax:**
```vcl
add variable = expression;
```

**Example:**
```vcl
add resp.http.Set-Cookie = "a=1";
add resp.http.Set-Cookie = "b=2";
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

### switch

Compares a subject expression against a series of cases. Cases compare as
strings; a case prefixed with `~` performs a regular expression match instead.
Every case body must end with `break;` or `fallthrough;` (fallthrough continues
into the next case in source order). At most one `default:` case is allowed,
and it runs only when no case matches.

**Syntax:**
```vcl
switch (expression) {
  case "value":
    # statements
    break;
  case ~"pattern":
    # statements
    fallthrough;
  default:
    # statements
    break;
}
```

**Example:**
```vcl
switch (req.url.ext) {
  case "jpg":
    fallthrough;
  case ~"^(png|gif|webp)$":
    set req.http.X-Type = "image";
    break;
  default:
    set req.http.X-Type = "other";
    break;
}
```

Note: VCL has no loops; `break` and `fallthrough` are only valid inside a
`switch` case body.

### goto

Jumps forward to a labeled section of code. Jumps are forward-only: the label
must be defined after the `goto` and at the top level of the same subroutine,
or loading the VCL fails. See [Goto Statements](../goto.md) for details.

**Syntax:**
```vcl
goto label_name;
```

**Example:**
```vcl
if (req.http.host == "admin.example.com") {
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

Defines a subroutine. Custom subroutines can optionally declare typed
parameters and a return type; a subroutine with a return type can be invoked
like a function inside expressions.

**Syntax:**
```vcl
sub name {
  # Code to execute
}

sub name(TYPE param1, TYPE param2) TYPE {
  return expression;
}
```

**Example:**
```vcl
sub vcl_recv {
  set req.backend = origin;
  return(lookup);
}

sub double(INTEGER n) INTEGER {
  return n * 2;
}
```

### call

Calls a subroutine. Arguments may be passed to subroutines declared with
parameters. If the called subroutine returns a lifecycle action (such as
`pass` or `error`), the action propagates to the caller.

**Syntax:**
```vcl
call name;
call name(arguments);
```

**Example:**
```vcl
call check_auth;
```

## Return Statements

### return

Ends the current subroutine, optionally handing a lifecycle action to the
state machine. The recognized actions are `lookup`, `pass`, `pipe`, `error`,
`restart`, `hash`, `deliver`, `deliver_stale`, `fetch`, `purge`, and
`hit_for_pass`. Parentheses around the action are optional, and a bare
`return;` exits a custom subroutine without an action. In a subroutine
declared with a return type, `return expression;` yields the subroutine's
value instead.

**Syntax:**
```vcl
return(action);
return action;
return;
return expression;   # typed subroutines only
```

**Example:**
```vcl
return(lookup);
return(pass);
return(deliver);
return(restart);
return lookup;
```

## Error Statements

### error

Generates an error response and transfers control to `vcl_error`. The status
code and response text are both optional: a bare `error;` re-raises with the
current `obj.status`. The status may be an integer literal, identifier, or
function call, and the response text may be any string expression. The
statement is only allowed while executing `vcl_recv`, `vcl_hit`, `vcl_miss`,
`vcl_pass`, or `vcl_fetch`.

**Syntax:**
```vcl
error;
error status_code;
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

Generates a synthetic response body. Only allowed inside `vcl_error`. The body
is a full string expression, so `{"..."}` long strings can be concatenated
with variables.

**Syntax:**
```vcl
synthetic "body";
synthetic {"long body"} + obj.status + {" more"};
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

Generates a synthetic response body from base64-encoded data. Like
`synthetic`, it is only allowed inside `vcl_error`.

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

Declares a local variable with a specific type. Variable names must be
prefixed with `var.`. Supported types are `STRING`, `INTEGER`, `FLOAT`,
`BOOL`, `TIME`, `RTIME`, and `IP`. Variables start out with the type's zero
value; as an extension, Fastly.JS also accepts an inline initializer.

**Syntax:**
```vcl
declare local var.name TYPE;
```

**Example:**
```vcl
declare local var.is_mobile BOOL;
declare local var.device_type STRING;
declare local var.request_count INTEGER;
declare local var.limit INTEGER = 10;  # Fastly.JS extension
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
  !"192.168.1.13";
}
```

Entries prefixed with `!` are negated. CIDR masks may be written inside or
outside the quoted address.

## Table Declaration

### table

Defines a lookup table. An optional value type may follow the table name
(the default is STRING).

**Syntax:**
```vcl
table name {
  "key": "value",
  "key": "value",
}
```

**Example:**
```vcl
table redirects {
  "/old-page": "/new-page",
  "/deprecated": "/current"
}

table limits INTEGER {
  "burst": 100,
}
```

## Director Declaration

### director

Defines a director that distributes traffic across backends. Supported types
are `random`, `hash`, `client`, `fallback`, and `chash`.

**Syntax:**
```vcl
director name type {
  .property = value;
  { .backend = backend_name; .weight = weight; }
}
```

**Example:**
```vcl
director my_pool random {
  .quorum = 50%;
  { .backend = origin_a; .weight = 2; }
  { .backend = origin_b; .weight = 1; }
}
```

## Rate Limiting Declarations

### penaltybox

Declares a penalty box for use with the `ratelimit.*` functions.

**Syntax:**
```vcl
penaltybox name {}
```

### ratecounter

Declares a rate counter for use with the `ratelimit.*` functions.

**Syntax:**
```vcl
ratecounter name {}
```

## Import Statement

### import

Imports a VCL module. All modules are built into Fastly.JS, so the statement
is accepted for compatibility but has no effect.

**Syntax:**
```vcl
import module;
```

**Example:**
```vcl
import std;
```

## Include Statement

### include

Includes another VCL file. Fastly.JS parses and records `include` statements
but does not resolve them to files: combine your VCL into a single input
before loading it.

**Syntax:**
```vcl
include "file";
```

## Restart Statement

### restart

Restarts the request processing from `vcl_recv`. Only allowed while executing
`vcl_recv`, `vcl_hit`, `vcl_fetch`, `vcl_error`, or `vcl_deliver`; the runtime
enforces a maximum number of restarts (3) and fails the request with a 503
once it is exceeded. See [Restart Functionality](./restart.md).

**Syntax:**
```vcl
restart;
```

**Example:**
```vcl
if (req.restarts == 0) {
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

## ESI Statement

### esi

Enables Edge Side Includes processing for the response. Only allowed in
`vcl_fetch` (it sets `beresp.do_esi`).

**Syntax:**
```vcl
esi;
```

**Example:**
```vcl
sub vcl_fetch {
  if (beresp.http.content-type ~ "text/html") {
    esi;
  }
}
```

## Conclusion

VCL statements provide a powerful way to control the flow of execution and manipulate data during the request-response lifecycle. By understanding and using these statements effectively, you can implement complex caching strategies, security measures, and content transformation logic.

For more information on VCL operators, see the [VCL Operators Reference](./vcl-operators.md).
