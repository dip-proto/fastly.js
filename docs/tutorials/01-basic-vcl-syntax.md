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

Comments in VCL start with a hash symbol (`#`) and continue to the end of the line:

```vcl
# This is a comment
set req.http.X-Test = "value"; # This is also a comment
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
set req.http.Host = "example.com";
set req.url = "/new-path";

# Accessing response properties
set resp.http.Content-Type = "text/html";
set resp.status = 200;
```

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
if (req.http.User-Agent == "Mozilla/5.0") {
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
set req.http.X-Full-URL = "https://" + req.http.Host + req.url;
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

VCL doesn't have a native switch statement, but you can simulate one using if-else chains:

```vcl
if (req.http.X-Action == "cache") {
  return(lookup);
} else if (req.http.X-Action == "pass") {
  return(pass);
} else if (req.http.X-Action == "error") {
  error 403 "Forbidden";
} else {
  return(lookup);
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

Each subroutine must end with a return statement that determines the next step in the request flow:

```vcl
return(action);
```

The available actions depend on the subroutine:

- **vcl_recv**: `lookup`, `pass`, `pipe`, `error`, `hash`, `purge`
- **vcl_hash**: `hash`
- **vcl_hit**: `deliver`, `pass`, `restart`, `error`
- **vcl_miss**: `fetch`, `pass`, `error`
- **vcl_pass**: `fetch`, `error`
- **vcl_fetch**: `deliver`, `pass`, `error`, `restart`
- **vcl_deliver**: `deliver`, `restart`, `error`
- **vcl_error**: `deliver`, `restart`
- **vcl_log**: No return value required

## Next Steps

Now that you understand the basic syntax and structure of VCL, you can move on to the next tutorial: [Request and Response Handling](./02-request-response-handling.md).
