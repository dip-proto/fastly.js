# Goto Statements in VCL

This document describes the implementation and usage of `goto` statements in VCL (Varnish Configuration Language).

## Overview

The `goto` statement allows you to jump forward to a labeled section of code within the same subroutine. This can be useful for implementing complex flow control logic that would be difficult to express using only `if` statements. Jumps are forward-only: the label must appear after the `goto` that targets it.

## Syntax

```vcl
# Jump forward to a label
goto label_name;

# Code between the goto and the label is skipped
set req.http.X-Skipped = "true";

# Define the label; execution continues here
label_name:
  set req.http.X-Label = "label_name";
```

## Usage Examples

### Basic Usage

Note that header lookups are case-sensitive and incoming request header names
are stored in lowercase, so client headers such as `host` and `cookie` are
read with lowercase names in these examples.

```vcl
sub vcl_recv {
  if (req.http.host == "admin.example.com") {
    # Jump to the admin processing section
    goto admin_processing;
  }

  # Regular request processing
  set req.http.X-Request-Type = "regular";

  # Skip the admin processing section
  goto request_end;

  # Admin processing section
  admin_processing:
    set req.http.X-Request-Type = "admin";
    set req.http.X-Admin-Access = "true";

  # End of request processing
  request_end:
    set req.http.X-Processing-Complete = "true";

  return(lookup);
}
```

### Complex Flow Control

```vcl
sub vcl_recv {
  if (req.http.cookie ~ "logged_in=true") {
    # Jump to logged-in user processing
    goto logged_in_user;
  } else {
    # Jump to anonymous user processing
    goto anonymous_user;
  }

  # Logged-in user processing
  logged_in_user:
    set req.http.X-User-Type = "logged_in";
    
    if (req.http.cookie ~ "user_role=admin") {
      # Jump to admin user processing
      goto admin_user;
    } else {
      # Jump to regular user processing
      goto regular_user;
    }

  # Anonymous user processing
  anonymous_user:
    set req.http.X-User-Type = "anonymous";
    goto user_end;

  # Admin user processing
  admin_user:
    set req.http.X-User-Role = "admin";
    goto user_end;

  # Regular user processing
  regular_user:
    set req.http.X-User-Role = "regular";

  # End of user processing
  user_end:
    set req.http.X-User-Processing-Complete = "true";

  return(lookup);
}
```

## Best Practices

1. **Use Sparingly**: While `goto` statements can be useful, they can also make code harder to understand and maintain. Use them only when necessary.

2. **Clear Labels**: Use descriptive label names that clearly indicate the purpose of the labeled section.

3. **Structured Flow**: Try to structure your code so that the flow is clear, even with `goto` statements. Use comments to explain the purpose of each jump.

4. **Keep Labels at the Top Level**: Labels inside conditional blocks or other control structures are not valid jump destinations; define them at the top level of the subroutine.

## Implementation Details

The `goto` statement is implemented in the VCL compiler as follows:

1. The parser recognizes `goto` statements and label declarations in the VCL code.
2. When the VCL is loaded, every `goto` is validated: its label must exist in the same subroutine, at the top level, and after the `goto`. A missing label or a backward jump is a load-time error.
3. During execution, when a `goto` statement is encountered, execution jumps to the statement immediately after the label, skipping everything in between.

## Limitations

1. Labels are only visible within the same subroutine. You cannot jump from one subroutine to another.
2. Jumps are forward-only. A `goto` targeting an earlier label is rejected when the VCL is loaded, so loops cannot be built with `goto`.
3. Only labels at the top level of a subroutine are valid destinations. A `goto` inside an `if`, `switch`, or nested block may jump out to a later top-level label, but it is not possible to jump into a block.
4. Label names should be unique within a subroutine; Fastly.JS does not currently reject duplicates, and a duplicated label makes the jump destination ambiguous.

## Testing

The `goto` functionality has been thoroughly tested with a comprehensive test suite that covers various use cases, including:

- Basic goto usage
- Regular request flow
- Complex flow control with multiple labels and conditional jumps

All tests are passing, ensuring that the `goto` implementation is working correctly.
