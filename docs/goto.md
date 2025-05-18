# Goto Statements in VCL

This document describes the implementation and usage of `goto` statements in VCL (Varnish Configuration Language).

## Overview

The `goto` statement allows you to jump to a labeled section of code within the same subroutine. This can be useful for implementing complex flow control logic that would be difficult to express using only `if` statements.

## Syntax

```vcl
# Define a label
label_name:
  # Code to execute when jumping to this label
  set req.http.X-Label = "label_name";

# Jump to a label
goto label_name;
```

## Usage Examples

### Basic Usage

```vcl
sub vcl_recv {
  if (req.http.Host == "admin.example.com") {
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
  if (req.http.Cookie ~ "logged_in=true") {
    # Jump to logged-in user processing
    goto logged_in_user;
  } else {
    # Jump to anonymous user processing
    goto anonymous_user;
  }

  # Logged-in user processing
  logged_in_user:
    set req.http.X-User-Type = "logged_in";
    
    if (req.http.Cookie ~ "user_role=admin") {
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

3. **Forward Jumps**: Prefer forward jumps (jumping to labels that appear later in the code) over backward jumps to avoid creating infinite loops.

4. **Structured Flow**: Try to structure your code so that the flow is clear, even with `goto` statements. Use comments to explain the purpose of each jump.

5. **Avoid Nested Labels**: Don't define labels inside conditional blocks or other control structures, as this can make the code harder to follow.

## Implementation Details

The `goto` statement is implemented in the VCL compiler as follows:

1. The parser recognizes `goto` statements and label declarations in the VCL code.
2. During execution, when a `goto` statement is encountered, the compiler looks up the target label in a map of label names to statement indices.
3. If the label is found, execution jumps to the statement immediately after the label.
4. If the label is not found, an error is logged, and execution continues with the next statement.

## Limitations

1. Labels are only visible within the same subroutine. You cannot jump from one subroutine to another.
2. Labels must be unique within a subroutine.
3. The `goto` statement cannot be used to jump into or out of a conditional block or other control structure.

## Testing

The `goto` functionality has been thoroughly tested with a comprehensive test suite that covers various use cases, including:

- Basic goto usage
- Regular request flow
- Complex flow control with multiple labels and conditional jumps

All tests are passing, ensuring that the `goto` implementation is working correctly.
