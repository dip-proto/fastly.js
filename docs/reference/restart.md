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
5. **Update req.url when normalizing URLs**: When using restart for URL normalization, make sure to update `req.url` with the normalized version before restarting.

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

## Advanced Examples

We've created several advanced examples that demonstrate real-world use cases for the restart functionality:

### URL Normalization Example

The URL normalization example demonstrates how to use restarts to:

- Remove double slashes from URLs
- Add trailing slashes to directory URLs
- Add index.html to URLs ending with a slash
- Convert URLs to lowercase for consistency

**Important Note**: When using restart for URL normalization, always update `req.url` with the normalized version before restarting. For example:

```vcl
# Store the normalized URL in a header
set req.http.X-Current-URL = regsub(req.url, "//", "/");

# Update the actual URL with the normalized version
set req.url = req.http.X-Current-URL;

# Then restart
restart;
```

Failing to update `req.url` can lead to infinite restart loops.

### Authentication with Token Validation Example

The authentication example demonstrates how to use restarts to:

- Extract authentication tokens from different sources (query parameters, cookies)
- Validate and normalize tokens
- Assign user roles based on token validation
- Apply role-based access control

### Backend Failover with Health Checking Example

The backend failover example demonstrates how to use restarts to:

- Select backends based on request type
- Failover to secondary backends when primary is unhealthy
- Handle 5xx errors from backends by retrying with different backends
- Implement a multi-tier failover strategy

### A/B Testing with Traffic Splitting Example

The A/B testing example demonstrates how to use restarts to:

- Assign users to test groups based on cookies, user IDs, or random assignment
- Route requests to different backends based on test group
- Modify URLs or add parameters based on test version
- Track test assignments for analytics

## Integration Tests

We've also created integration tests for each of these examples to demonstrate how they work in practice:

- [URL Normalization Test](../../test/integration/restart_url_normalization_test.ts)
- [Authentication Test](../../test/integration/restart_auth_token_test.ts)
- [Backend Failover Test](../../test/integration/restart_backend_failover_test.ts)
- [A/B Testing Test](../../test/integration/restart_ab_testing_test.ts)

You can run all the integration tests with the following command:

```bash
./test/integration/run_restart_tests.sh
```

## Troubleshooting Restart Issues

### Infinite Restart Loops

If you're experiencing infinite restart loops, check for these common issues:

1. **Not updating req.url**: When normalizing URLs, make sure to update `req.url` with the normalized version before restarting.
2. **Missing restart counter check**: Always check `req.restarts` to prevent infinite loops.
3. **Condition always evaluates to true**: Ensure your restart conditions can eventually become false.
4. **Maximum restart limit too high**: Set a reasonable maximum restart limit (3-5 is usually sufficient).

### Debugging Restart Flows

To debug restart flows, add headers to track the restart count and reason:

```vcl
# Track restart count
set req.http.X-Restart-Count = req.restarts;

# Track restart reason
if (req.http.X-Restart-Reason) {
    set resp.http.X-Restart-Reason = req.http.X-Restart-Reason;
}
```

## See Also

- [VCL Subroutines](vcl-subroutines.md)
- [Error Handling](error-handling.md)
- [Request Processing](../fastly-vcl/02-request-pipeline.md)
