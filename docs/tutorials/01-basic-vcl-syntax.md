# Basic VCL Syntax and Structure

This tutorial covers the basic syntax and structure of VCL (Varnish Configuration Language) as implemented in Fastly.JS.

## VCL File Structure

A VCL file consists of:

1. **Backend definitions**: Define the origin servers that Fastly.JS will proxy requests to
2. **ACL definitions**: Define access control lists for IP-based access control
3. **Table definitions**: Define key-value tables for lookups
4. **Subroutine definitions**: Define the behavior at different stages of the request lifecycle
5. **Director definitions**: Define load balancing across multiple backends

Here's a simple example of a VCL file structure:

```vcl
# Backend definition
backend default {
  .host = "example.com";
  .port = "80";
}

# ACL definition
acl internal {
  "127.0.0.1";
  "192.168.0.0"/24;
}

# Table definition
table example_table {
  "key1": "value1",
  "key2": "value2",
}

# Subroutine definition
sub vcl_recv {
  # Subroutine code here
}

# Director definition
director main_director random {
  .quorum = 50%;
  { .backend = default; .weight = 1; }
}
```

## Comments

VCL supports three comment styles: `#` and `//` for line comments, and `/* ... */` for block comments:

```vcl
# This is a comment
// This is also a comment
/* This is a
   block comment */
set req.http.X-Test = "value"; # Trailing comments work too
```

## Data Types

VCL supports the following data types:

- **STRING**: Text strings, e.g., `"Hello, World!"`
- **INTEGER**: Whole numbers, e.g., `42`
- **REAL**: Floating-point numbers, e.g., `3.14`
- **BOOL**: Boolean values, `true` or `false`
- **TIME**: Time durations, e.g., `10s`, `5m`, `1h`, `2d`
- **IP**: IP addresses, e.g., `127.0.0.1`, `2001:db8::/32`
- **BACKEND**: Backend definitions
- **ACL**: Access control lists
- **TABLE**: Key-value tables

## Variables

VCL provides several built-in variables for accessing and manipulating HTTP requests and responses:

- **req**: The client request
- **bereq**: The backend request
- **beresp**: The backend response
- **resp**: The client response
- **obj**: The cached object
- **client**: Client information
- **server**: Server information
- **local**: Local variables

Examples:

```vcl
# Accessing request properties
set req.http.host = "example.com";
set req.url = "/new-path";

# Accessing response properties
set resp.http.content-type = "text/html";
set resp.status = 200;
```

Note that header lookups are case-sensitive in Fastly.JS, and the proxy stores incoming request and backend response header names in lowercase. Use lowercase names (`req.http.user-agent`, `beresp.http.content-type`) when reading or overriding headers that arrive from outside; headers your own VCL creates can use any casing, as long as you stay consistent.

## Variable Declaration

You can declare local variables using the `declare` statement:

```vcl
sub vcl_recv {
  # Declare a string variable
  declare local var.my_string STRING;
  
  # Declare an integer variable
  declare local var.my_int INTEGER;
  
  # Declare a boolean variable
  declare local var.my_bool BOOL;
  
  # Set variable values
  set var.my_string = "Hello, World!";
  set var.my_int = 42;
  set var.my_bool = true;
}
```

## Operators

VCL supports the following operators:

- **Arithmetic**: `+`, `-`, `*`, `/`, `%`
- **Comparison**: `==`, `!=`, `<`, `>`, `<=`, `>=`
- **Logical**: `&&`, `||`, `!`
- **Regular expression**: `~`, `!~`
- **Assignment**: `=`
- **Concatenation**: `+` (for strings)

Examples:

```vcl
# Arithmetic
set var.result = 5 + 3 * 2;

# Comparison
if (req.http.user-agent == "Mozilla/5.0") {
  # Do something
}

# Logical
if (req.url ~ "^/api/" && req.method == "POST") {
  # Do something
}

# Regular expression
if (req.url ~ "^/static/") {
  # Do something
}

# Assignment
set req.http.X-Test = "value";

# Concatenation
set req.http.X-Full-URL = "https://" + req.http.host + req.url;
```

## Control Structures

VCL supports the following control structures:

### If-Else Statements

```vcl
if (condition) {
  # Code to execute if condition is true
} else if (another_condition) {
  # Code to execute if another_condition is true
} else {
  # Code to execute if all conditions are false
}
```

Example:

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

### Switch Statements

Fastly.JS supports native switch statements. The control expression is stringified and compared against the case values; `case ~` matches a regular expression, and `default` runs when nothing else matched:

```vcl
switch (req.http.X-Action) {
  case "cache":
    set req.http.X-Result = "lookup";
    break;
  case "pass":
    set req.http.X-Result = "pass";
    break;
  case ~ "^err":
    set req.http.X-Result = "error";
    break;
  default:
    set req.http.X-Result = "default";
    break;
}
```

## Subroutines

Subroutines are the building blocks of VCL. They define the behavior at different stages of the request lifecycle.

### Defining a Subroutine

```vcl
sub subroutine_name {
  # Subroutine code here
}
```

### Built-in Subroutines

Fastly.JS implements the following built-in subroutines:

- **vcl_recv**: Executed when a request is received
- **vcl_hash**: Executed to create a hash key for the request
- **vcl_hit**: Executed when the request is found in cache
- **vcl_miss**: Executed when the request is not found in cache
- **vcl_pass**: Executed when the request is passed to the backend
- **vcl_fetch**: Executed when the response is received from the backend
- **vcl_deliver**: Executed before the response is delivered to the client
- **vcl_error**: Executed when an error occurs
- **vcl_log**: Executed after the response is delivered to the client

### Return Statements

A subroutine can end with a return statement that determines the next step in the request flow:

```vcl
return(action);
```

A return statement is not required: if a built-in subroutine finishes without one, Fastly.JS applies a default (`lookup` for `vcl_recv`, `fetch` for `vcl_miss` and `vcl_pass`, `deliver` for `vcl_hit` and `vcl_fetch`).

The actions honored by the request pipeline depend on the subroutine:

- **vcl_recv**: `lookup`, `pass`, `error`, `restart` (`pipe` and `purge` are accepted by the parser, but currently behave like `pass`)
- **vcl_hash**: `hash`
- **vcl_hit**: `deliver` serves the cached object; any other action (such as `pass` or `fetch`) refetches from the backend
- **vcl_miss**: `fetch`, `pass`
- **vcl_pass**: `fetch`
- **vcl_fetch**: `deliver` caches the response (if cacheable) and delivers it; `pass` delivers it without caching
- **vcl_deliver**: the return value is currently ignored; the response is always delivered
- **vcl_error**: `deliver`
- **vcl_log**: No return value required

## Next Steps

Now that you understand the basic syntax and structure of VCL, you can move on to the next tutorial: [Request and Response Handling](./02-request-response-handling.md).
