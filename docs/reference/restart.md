# Restart Functionality

The `restart` statement in VCL allows you to restart the request processing from the beginning. This is useful for various scenarios such as URL normalization, authentication, and failover.

## Syntax

```vcl
restart;
```

## Description

When a `restart` statement is executed, the request processing is restarted from the beginning, and the `vcl_recv` subroutine is called again. The `req.restarts` counter is incremented each time a restart occurs, allowing you to track the number of restarts and prevent infinite loops.

## Usage

The `restart` statement can be used in various scenarios:

### URL Normalization

```vcl
sub vcl_recv {
    # Add index.html to URLs ending with /
    if (req.restarts == 0 && req.url ~ "/$") {
        set req.url = req.url + "index.html";
        restart;
    }
}
```

### Authentication

```vcl
sub vcl_recv {
    # Extract auth token from cookie and set Authorization header
    if (req.restarts == 0 && !req.http.Authorization && req.http.Cookie ~ "auth_token=([^;]+)") {
        set req.http.Authorization = "Bearer " + re.group.1;
        restart;
    }
}
```

### Failover

```vcl
sub vcl_recv {
    # Try a different backend if the primary backend returns a 5xx error
    if (req.restarts < 3 && req.http.X-Backend-Status ~ "5\d\d") {
        set req.backend = "fallback_backend";
        restart;
    }
}
```

## Preventing Infinite Loops

To prevent infinite loops, always check the `req.restarts` counter and set a maximum number of restarts:

```vcl
sub vcl_recv {
    # Prevent infinite loops
    if (req.restarts >= 3) {
        error 503 "Maximum number of restarts reached";
    }
}
```

## Best Practices

1. **Always check the restart counter**: Use `req.restarts` to track the number of restarts and prevent infinite loops.
2. **Set a reason for the restart**: Use a custom header like `X-Restart-Reason` to track why a restart occurred.
3. **Limit the number of restarts**: Set a maximum number of restarts (usually 3-5) to prevent infinite loops.
4. **Use restarts sparingly**: Restarts can impact performance, so use them only when necessary.

## Example

Here's a complete example that demonstrates URL normalization, authentication, and failover using restarts:

```vcl
sub vcl_recv {
    # Add a header to track restarts
    set req.http.X-Restart-Count = req.restarts;
    
    # URL normalization
    if (req.restarts == 0 && req.url ~ "/$") {
        set req.url = req.url + "index.html";
        set req.http.X-Restart-Reason = "url_normalization";
        restart;
    }
    
    # Authentication
    if (req.restarts == 1 && !req.http.Authorization && req.http.Cookie ~ "auth_token=([^;]+)") {
        set req.http.Authorization = "Bearer " + re.group.1;
        set req.http.X-Restart-Reason = "auth";
        restart;
    }
    
    # Failover
    if (req.restarts == 2 && req.http.X-Backend-Status ~ "5\d\d") {
        set req.backend = "fallback_backend";
        set req.http.X-Restart-Reason = "failover";
        restart;
    }
    
    # Prevent infinite loops
    if (req.restarts >= 3) {
        error 503 "Maximum number of restarts reached";
    }
    
    return(lookup);
}
```

## See Also

- [VCL Subroutines](vcl-subroutines.md)
- [Error Handling](error-handling.md)
- [Request Processing](../fastly-vcl/02-request-pipeline.md)
