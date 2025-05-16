# Edge Side Includes (ESI)

Edge Side Includes (ESI) is a markup language that allows you to include dynamic content in otherwise static pages. Fastly.JS fully supports ESI processing, enabling you to assemble dynamic content at the edge.

## What is ESI?

ESI is a simple markup language that allows you to:

- Include content from other URLs
- Remove content conditionally
- Add comments that are removed from the output
- Include content conditionally based on variables

ESI processing happens at the edge, which means that the client receives a fully assembled page without having to make additional requests for the included content.

## Enabling ESI Processing

To enable ESI processing, set the `beresp.do_esi` variable to `true` in your VCL:

```vcl
sub vcl_fetch {
  # Enable ESI processing for HTML content
  if (beresp.http.Content-Type ~ "text/html") {
    set beresp.do_esi = true;
  }
  return(deliver);
}
```

## ESI Tags

Fastly.JS supports the following ESI tags:

### Include Tag

The `<esi:include>` tag allows you to include content from another URL:

```html
<esi:include src="/header" />
```

This will fetch the content from the `/header` URL and include it in the response.

You can also include content with variables:

```html
<esi:include src="/user/$(HTTP_COOKIE{user_id})" />
```

### Remove Tag

The `<esi:remove>` tag allows you to remove content from the response:

```html
<esi:remove>
  <div class="debug">
    Debug information that should be removed in production
  </div>
</esi:remove>
```

The content inside the `<esi:remove>` tag will be removed from the response.

### Comment Tag

The `<esi:comment>` tag allows you to add comments that will be removed from the response:

```html
<esi:comment text="This comment will be removed from the output" />
```

### Choose/When/Otherwise Tags

The `<esi:choose>`, `<esi:when>`, and `<esi:otherwise>` tags allow you to include content conditionally:

```html
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
```

This will include different content based on the value of the `user_type` cookie.

## ESI Variables

ESI supports variables that can be used in tag attributes. The following variables are supported:

- `$(HTTP_COOKIE{name})`: The value of the cookie with the specified name
- `$(HTTP_HEADER{name})`: The value of the HTTP header with the specified name
- `$(QUERY_STRING{name})`: The value of the query parameter with the specified name

## Nested ESI Tags

ESI tags can be nested, allowing for complex content assembly:

```html
<esi:include src="/layout">
  <esi:remove>
    <div class="debug">Debug info</div>
  </esi:remove>
  <esi:choose>
    <esi:when test="$(HTTP_COOKIE{user_type}) == 'premium'">
      <esi:include src="/premium-content" />
    </esi:when>
    <esi:otherwise>
      <esi:include src="/standard-content" />
    </esi:otherwise>
  </esi:choose>
</esi:include>
```

## Performance Considerations

ESI processing can impact performance, especially if you include content from multiple URLs. Here are some tips to optimize ESI performance:

1. **Cache included content**: Make sure that the included content is cacheable
2. **Limit the number of includes**: Each include requires a separate request
3. **Use conditional includes**: Only include content that is actually needed
4. **Consider using stale-while-revalidate**: This allows you to serve stale content while fetching fresh content

## Example: Dynamic Page Assembly

Here's a complete example that demonstrates how to use ESI for dynamic page assembly:

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
  
  return(deliver);
}
```

With this VCL, you can create HTML pages that use ESI tags:

```html
<!DOCTYPE html>
<html>
  <head>
    <title>My Website</title>
    <esi:include src="/css" />
  </head>
  <body>
    <header>
      <esi:include src="/header" />
    </header>
    
    <main>
      <esi:choose>
        <esi:when test="$(HTTP_COOKIE{user_type}) == 'premium'">
          <esi:include src="/premium-content" />
        </esi:when>
        <esi:otherwise>
          <esi:include src="/standard-content" />
        </esi:otherwise>
      </esi:choose>
    </main>
    
    <footer>
      <esi:include src="/footer" />
    </footer>
  </body>
</html>
```

## Conclusion

ESI is a powerful feature that allows you to assemble dynamic content at the edge. With Fastly.JS, you can test and develop ESI-enabled pages locally before deploying them to your production Fastly service.

For more information on ESI, see the [ESI Language Specification](https://www.w3.org/TR/esi-lang).
