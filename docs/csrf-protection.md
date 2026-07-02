# CSRF Protection

Cross-Site Request Forgery (CSRF) is a type of attack that tricks a user's browser into making unwanted requests to a website where the user is authenticated. This document explains how to implement CSRF protection in your VCL code.

## What is CSRF?

CSRF attacks exploit the trust that a website has in a user's browser. When a user is authenticated to a website, the browser typically includes authentication cookies with every request to that site. A CSRF attack tricks the user's browser into making a request to the target site without the user's knowledge or consent.

For example, an attacker might include an image tag in a malicious website that actually makes a request to your bank's website to transfer money:

```html
<img src="https://bank.example.com/transfer?to=attacker&amount=1000" style="display:none" />
```

If you're logged into your bank in another tab, your browser will include your authentication cookies with this request, potentially allowing the transfer to go through.

## CSRF Protection in VCL

VCL provides several mechanisms to protect against CSRF attacks:

1. **Token-based protection**: Generate a unique token for each user session and require it to be included in all state-changing requests.
2. **Same-origin verification**: Check that the request's Referer or Origin header matches your site.
3. **Custom headers**: Require a custom header that can only be set by your JavaScript, not by a form submission from another site.

## Implementing Token-based CSRF Protection

The most robust protection is token-based CSRF protection. Here's how to implement it in VCL:

### 1. Generate a CSRF Token

In your `vcl_recv` subroutine, generate a token for GET requests. The token binds the client IP, the User-Agent, a secret salt, and the current date, so it rotates daily and cannot be reused from another client:

```vcl
sub vcl_recv {
  # For GET requests, generate a CSRF token
  if (req.method == "GET") {
    set req.http.X-CSRF-Token = digest.hash_sha256(
      client.ip + 
      req.http.user-agent + 
      "secret-salt" + 
      strftime({"%Y%m%d"}, now)
    );
  }
  
  # Continue processing the request
  return(lookup);
}
```

Note that header lookups are case-sensitive and incoming request header names
are stored in lowercase, so headers sent by the client (`user-agent`,
`referer`, and the `x-csrf-token` the browser sends back) are read with
lowercase names. The `X-CSRF-Token` header the VCL sets itself keeps the
casing it was written with.

### 2. Include the Token in Responses

In your `vcl_deliver` subroutine, include the token in the response headers:

```vcl
sub vcl_deliver {
  # Add the CSRF token to the response headers for GET requests
  if (req.method == "GET" && req.http.X-CSRF-Token) {
    set resp.http.X-CSRF-Token = req.http.X-CSRF-Token;
  }
  
  return(deliver);
}
```

### 3. Validate the Token for State-changing Requests

In your `vcl_recv` subroutine, validate the token for POST, PUT, DELETE, and PATCH requests:

```vcl
sub vcl_recv {
  # For GET requests, generate a token (as shown above)
  
  # For POST, PUT, DELETE, PATCH requests, validate the token
  if (req.method ~ "^(POST|PUT|DELETE|PATCH)$") {
    # Generate the expected token
    declare local var.expected_token STRING;
    set var.expected_token = digest.hash_sha256(
      client.ip + 
      req.http.user-agent + 
      "secret-salt" + 
      strftime({"%Y%m%d"}, now)
    );
    
    # Check if the token is valid (the client-sent header arrives lowercase)
    if (req.http.x-csrf-token != var.expected_token) {
      error 403 "CSRF token validation failed";
    }
  }
  
  return(lookup);
}
```

### 4. Include the Token in Forms and AJAX Requests

In your HTML forms, include the CSRF token as a hidden field:

```html
<form method="POST" action="/submit">
  <input type="hidden" name="csrf_token" value="{{ CSRF_TOKEN }}" />
  <!-- Other form fields -->
  <button type="submit">Submit</button>
</form>
```

For AJAX requests, include the token in the headers:

```javascript
fetch('/api/data', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-CSRF-Token': csrfToken
  },
  body: JSON.stringify(data)
});
```

## Additional Protection Measures

### Same-Origin Verification

You can also check the Referer or Origin header to ensure the request is coming from your site:

```vcl
sub vcl_recv {
  # For state-changing requests, verify the origin
  if (req.method ~ "^(POST|PUT|DELETE|PATCH)$") {
    # Check if the Referer header is present and from our domain
    if (!req.http.referer || req.http.referer !~ "^https?://([^/]+\.)?example\.com/") {
      error 403 "Invalid request origin";
    }
  }
  
  return(lookup);
}
```

### SameSite Cookies

Modern browsers support the SameSite attribute for cookies, which can prevent CSRF attacks. You can set this attribute in your Set-Cookie headers:

```vcl
sub vcl_deliver {
  # Set SameSite attribute for cookies (origin response header names
  # are stored lowercase)
  if (resp.http.set-cookie) {
    set resp.http.set-cookie = resp.http.set-cookie + "; SameSite=Strict";
  }
  
  return(deliver);
}
```

## Complete CSRF Protection Example

Here's a complete example that combines token-based protection with same-origin verification:

```vcl
sub vcl_recv {
  # For GET requests, generate a CSRF token
  if (req.method == "GET") {
    set req.http.X-CSRF-Token = digest.hash_sha256(
      client.ip + 
      req.http.user-agent + 
      "secret-salt" + 
      strftime({"%Y%m%d"}, now)
    );
  } 
  # For other methods, validate the token and origin
  else {
    # Verify the origin
    if (!req.http.referer || req.http.referer !~ "^https?://([^/]+\.)?example\.com/") {
      error 403 "Invalid request origin";
    }
    
    # Validate the CSRF token
    declare local var.expected_token STRING;
    set var.expected_token = digest.hash_sha256(
      client.ip + 
      req.http.user-agent + 
      "secret-salt" + 
      strftime({"%Y%m%d"}, now)
    );
    
    if (req.http.x-csrf-token != var.expected_token) {
      error 403 "CSRF token validation failed";
    }
  }
  
  return(lookup);
}

sub vcl_deliver {
  # Add the CSRF token to the response headers for GET requests
  if (req.method == "GET" && req.http.X-CSRF-Token) {
    set resp.http.X-CSRF-Token = req.http.X-CSRF-Token;
  }
  
  # Set SameSite attribute for cookies
  if (resp.http.set-cookie) {
    set resp.http.set-cookie = resp.http.set-cookie + "; SameSite=Strict";
  }
  
  return(deliver);
}
```

By implementing these measures, you can protect your application from CSRF attacks.

## TypeScript Helpers

If you are driving the engine from JavaScript or TypeScript rather than pure VCL, `src/csrf-protection.ts` ships the same logic as a small module:

- `generateCSRFToken(context, secret)`: Computes the SHA-256 token from the client IP, User-Agent, secret, and current time.
- `validateCSRFToken(context, token, secret)`: Recomputes the expected token and compares it to the supplied one.
- `protectAgainstCSRF(context, secret)`: For GET requests, generates a token and stores it in `req.http.X-CSRF-Token`; for all other methods, validates the incoming `X-CSRF-Token` header and returns `false` if it is missing or invalid.
- `addCSRFTokenToResponse(context)`: Copies the token from `req.http.X-CSRF-Token` to `resp.http.X-CSRF-Token` on GET requests.

The module also exports `csrfProtectionVCL`, a ready-made VCL snippet implementing the token scheme described above.
