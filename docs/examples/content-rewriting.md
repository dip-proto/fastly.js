# Content Rewriting with Fastly.JS

Content rewriting is a powerful feature that allows you to modify the content of HTTP responses before they are delivered to the client. This can be useful for a variety of purposes, such as:

- Inserting or modifying HTML, CSS, or JavaScript
- Replacing text or URLs
- Adding or removing HTTP headers
- Implementing edge-side includes (ESI)
- Performing A/B testing or feature flagging

This guide demonstrates how to use Fastly.JS to implement content rewriting in your VCL configurations.

## Basic Text Replacement

The simplest form of content rewriting is replacing text in the response body. Here's an example that replaces all occurrences of "Product" with "Solution" in HTML responses:

```vcl
sub vcl_fetch {
  # Only process HTML responses
  if (beresp.http.Content-Type ~ "text/html") {
    # Enable ESI processing
    set beresp.do_esi = true;
    
    # Set a flag to indicate that we want to modify the response
    set beresp.http.X-Modify-Content = "true";
  }
  
  return(deliver);
}

sub vcl_deliver {
  # Check if we need to modify the content
  if (resp.http.X-Modify-Content == "true") {
    # Replace "Product" with "Solution"
    set resp.body = regsuball(resp.body, "Product", "Solution");
    
    # Remove the flag header
    unset resp.http.X-Modify-Content;
  }
  
  return(deliver);
}
```

## Dynamic Content Insertion

You can also insert dynamic content into the response body. This example inserts a banner at the top of HTML pages:

```vcl
sub vcl_deliver {
  # Only process HTML responses
  if (resp.http.Content-Type ~ "text/html") {
    # Define the banner HTML
    declare local var.banner STRING;
    set var.banner = "<div class='banner'>Special offer: 20% off all items today!</div>";
    
    # Insert the banner after the opening body tag
    set resp.body = regsuball(resp.body, "<body>", "<body>" + var.banner);
  }
  
  return(deliver);
}
```

## URL Rewriting

URL rewriting allows you to modify URLs in the response body. This is useful for changing resource paths or domains:

```vcl
sub vcl_deliver {
  # Only process HTML and CSS responses
  if (resp.http.Content-Type ~ "text/html" || resp.http.Content-Type ~ "text/css") {
    # Replace all references to the old domain with the new domain
    set resp.body = regsuball(resp.body, "old-domain.com", "new-domain.com");
    
    # Replace all references to the old path with the new path
    set resp.body = regsuball(resp.body, "/old-path/", "/new-path/");
  }
  
  return(deliver);
}
```

## Edge Side Includes (ESI)

Edge Side Includes (ESI) is a markup language that allows you to include dynamic content in otherwise static pages. Fastly.JS supports ESI processing:

```vcl
sub vcl_fetch {
  # Enable ESI processing for HTML responses
  if (beresp.http.Content-Type ~ "text/html") {
    set beresp.do_esi = true;
  }
  
  return(deliver);
}
```

With ESI enabled, you can include dynamic content in your HTML using ESI tags:

```html
<html>
  <head>
    <title>My Website</title>
  </head>
  <body>
    <h1>Welcome to My Website</h1>
    
    <!-- Include dynamic content -->
    <esi:include src="/api/user-profile" />
    
    <!-- Conditional inclusion -->
    <esi:choose>
      <esi:when test="$(HTTP_COOKIE{user_type}) == 'premium'">
        <div class="premium-content">
          Premium content here
        </div>
      </esi:when>
      <esi:otherwise>
        <div class="standard-content">
          Standard content here
        </div>
      </esi:otherwise>
    </esi:choose>
  </body>
</html>
```

## Content Compression

You can also modify the compression settings for responses:

```vcl
sub vcl_fetch {
  # Enable gzip compression for text-based responses
  if (beresp.http.Content-Type ~ "text|application/json|application/javascript") {
    set beresp.do_gzip = true;
  }
  
  return(deliver);
}
```

## Complete Example

Here's a complete example that combines several content rewriting techniques:

```vcl
sub vcl_recv {
  # Set the default backend
  set req.backend = default;
  
  return(lookup);
}

sub vcl_fetch {
  # Enable ESI processing for HTML responses
  if (beresp.http.Content-Type ~ "text/html") {
    set beresp.do_esi = true;
  }
  
  # Enable gzip compression for text-based responses
  if (beresp.http.Content-Type ~ "text|application/json|application/javascript") {
    set beresp.do_gzip = true;
  }
  
  return(deliver);
}

sub vcl_deliver {
  # Only process HTML responses
  if (resp.http.Content-Type ~ "text/html") {
    # Define the banner HTML
    declare local var.banner STRING;
    set var.banner = "<div class='banner'>Special offer: 20% off all items today!</div>";
    
    # Insert the banner after the opening body tag
    set resp.body = regsuball(resp.body, "<body>", "<body>" + var.banner);
    
    # Replace all references to the old domain with the new domain
    set resp.body = regsuball(resp.body, "old-domain.com", "new-domain.com");
    
    # Add a custom footer
    set resp.body = regsuball(resp.body, "</body>", "<footer>© 2023 My Company</footer></body>");
  }
  
  # Add custom headers
  set resp.http.X-Powered-By = "Fastly.JS";
  
  return(deliver);
}
```

## Running the Example

Save the above VCL to a file named `content-rewriting.vcl` and run it with Fastly.JS:

```bash
bun run index.ts content-rewriting.vcl
```

This will start a local HTTP proxy server that applies the content rewriting rules to all responses.

## Conclusion

Content rewriting is a powerful feature that allows you to modify HTTP responses at the edge. With Fastly.JS, you can test and develop content rewriting rules locally before deploying them to your production Fastly service.

For more information on the VCL functions used in this example, see the [VCL Functions Reference](../reference/vcl-functions.md).
