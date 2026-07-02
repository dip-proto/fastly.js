# Edge Side Includes (ESI)

Edge Side Includes (ESI) is a markup language that allows you to include dynamic content in otherwise static pages. Fastly.JS supports a practical subset of ESI for local testing: it processes `<esi:include>`, `<esi:remove>`, `<esi:comment>`, and `<esi:choose>`/`<esi:when>`/`<esi:otherwise>` tags in HTML responses.

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
  # Enable ESI processing for HTML content (origin response header
  # names are stored lowercase, and header lookups are case-sensitive)
  if (beresp.http.content-type ~ "text/html") {
    set beresp.do_esi = true;
  }
  return(deliver);
}
```

ESI tags are processed when `vcl_deliver` runs, and only if the response's `Content-Type` includes `text/html`. Responses with any other content type are passed through untouched even when `beresp.do_esi` is set.

## ESI Tags

Fastly.JS supports the following ESI tags:

### Include Tag

The `<esi:include>` tag marks a spot where content from another URL should be inserted:

```html
<esi:include src="/header" />
```

Note that Fastly.JS does not issue a real subrequest to the backend for includes. Include resolution is simulated locally: the `/header` and `/footer` URLs resolve to small built-in HTML fragments (used by the test suite), and any other URL is replaced with an HTML comment placeholder of the form `<!-- ESI include for /url -->`. This lets you verify that your VCL enables ESI and that include tags are found and substituted, but the included content itself will not come from your origin.

The tag must be self-closing (`<esi:include src="..." />`), and ESI variables inside the `src` attribute are not expanded.

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

Variable support is limited to `test` conditions on `<esi:when>` tags, and to a single form: comparing a request cookie against a literal value.

```html
<esi:when test="$(HTTP_COOKIE{user_type}) == 'premium'">
```

The condition is true when the named cookie in the request's `Cookie` header equals the quoted value. Any other expression — including `$(HTTP_HEADER{...})`, `$(QUERY_STRING{...})`, negation, or comparisons other than `==` — evaluates to false, so the `<esi:otherwise>` branch is taken.

## Combining ESI Tags

A page can freely mix the supported tags — for example, an `<esi:choose>` block whose branches contain `<esi:include>` tags:

```html
<esi:choose>
  <esi:when test="$(HTTP_COOKIE{user_type}) == 'premium'">
    <esi:include src="/premium-content" />
  </esi:when>
  <esi:otherwise>
    <esi:include src="/standard-content" />
  </esi:otherwise>
</esi:choose>
```

Comments and remove blocks are stripped first, then choose blocks are resolved, then includes are substituted, so includes inside a chosen branch are processed. Deeper nesting — such as a `<esi:choose>` inside another `<esi:choose>`, or an `<esi:include>` written as a paired tag with children — is not supported.

## Performance Considerations

On the real Fastly platform, ESI processing can impact performance, especially if you include content from multiple URLs. Here are some tips to keep in mind for production:

1. **Cache included content**: Make sure that the included content is cacheable
2. **Limit the number of includes**: On Fastly, each include requires a separate request (in Fastly.JS includes are resolved locally, so this cost only shows up in production)
3. **Use conditional includes**: Only include content that is actually needed
4. **Consider using stale-while-revalidate**: This allows you to serve stale content while fetching fresh content

## Example: Dynamic Page Assembly

Here's a complete example that demonstrates how to use ESI for dynamic page assembly:

```vcl
sub vcl_recv {
  return(lookup);
}

sub vcl_fetch {
  # Enable ESI processing for HTML responses
  if (beresp.http.content-type ~ "text/html") {
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

ESI is a powerful feature that allows you to assemble dynamic content at the edge. With Fastly.JS, you can verify locally that your VCL enables ESI and that your pages' ESI tags are recognized and processed, before deploying them to your production Fastly service where includes are resolved against your real origins.

For more information on ESI, see the [ESI Language Specification](https://www.w3.org/TR/esi-lang).
