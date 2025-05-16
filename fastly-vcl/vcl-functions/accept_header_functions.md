# Accept Header Functions

This file demonstrates comprehensive examples of Accept Header Functions in VCL.
These functions help parse and work with HTTP Accept headers according to RFC standards.

## accept.language_lookup

Selects the best match from an Accept-Language header value against available languages.

### Syntax

```vcl
STRING accept.language_lookup(STRING available_languages, STRING default_language, STRING accept_language_header)
```

### Parameters

- `available_languages`: Colon-separated list of languages available for the resource
- `default_language`: Fallback language if no match is found
- `accept_language_header`: The Accept-Language header value to parse

### Return Value

The best matching language from the available list, or the default if no match.

### RFC Compliance

Conforms to RFC 4647, Section 3.4

### Examples

#### Basic language selection

This example selects the best language match from the Accept-Language header:

```vcl
declare local var.selected_language STRING;
set var.selected_language = accept.language_lookup(
  "en:fr:de:es:it:ja", # Available languages
  "en",                # Default language
  req.http.Accept-Language
);

# Use the selected language for content negotiation
set req.http.X-Language = var.selected_language;
```

#### Language-based backend routing

This example demonstrates how to route to different backends based on language:

```vcl
if (var.selected_language == "ja") {
  # Route Japanese users to a Japan-specific backend
  set req.backend = F_japan_backend;
} else if (var.selected_language == "de" || var.selected_language == "fr") {
  # Route German and French users to European backend
  set req.backend = F_europe_backend;
} else {
  # Default backend for other languages
  set req.backend = F_default_backend;
}
```

#### Language-based URL rewriting

This example shows how to rewrite URLs based on the selected language:

```vcl
if (var.selected_language == "en") {
  # No rewriting needed for English (default)
} else if (req.url !~ "^/" + var.selected_language + "/") {
  # Rewrite URL to include language prefix
  set req.url = "/" + var.selected_language + req.url;
}
```

## accept.charset_lookup

Selects the best match from an Accept-Charset header value against available charsets.

### Syntax

```vcl
STRING accept.charset_lookup(STRING available_charsets, STRING default_charset, STRING accept_charset_header)
```

### Parameters

- `available_charsets`: Colon-separated list of charsets available for the resource
- `default_charset`: Fallback charset if no match is found
- `accept_charset_header`: The Accept-Charset header value to parse

### Return Value

The best matching charset from the available list, or the default if no match.

### RFC Compliance

Conforms to RFC 7231, Section 5.3.3

### Examples

#### Basic charset selection

This example selects the best charset match from the Accept-Charset header:

```vcl
declare local var.selected_charset STRING;
set var.selected_charset = accept.charset_lookup(
  "utf-8:iso-8859-1:us-ascii", # Available charsets
  "utf-8",                     # Default charset
  req.http.Accept-Charset
);

# Use the selected charset for content negotiation
set req.http.X-Charset = var.selected_charset;
```

## accept.encoding_lookup

Selects the best match from an Accept-Encoding header value against available encodings.

### Syntax

```vcl
STRING accept.encoding_lookup(STRING available_encodings, STRING default_encoding, STRING accept_encoding_header)
```

### Parameters

- `available_encodings`: Colon-separated list of encodings available for the resource
- `default_encoding`: Fallback encoding if no match is found
- `accept_encoding_header`: The Accept-Encoding header value to parse

### Return Value

The best matching encoding from the available list, or the default if no match.

### RFC Compliance

Conforms to RFC 7231, Section 5.3.4

### Examples

#### Basic encoding selection

This example selects the best encoding match from the Accept-Encoding header:

```vcl
declare local var.selected_encoding STRING;
set var.selected_encoding = accept.encoding_lookup(
  "br:gzip:deflate:identity", # Available encodings
  "identity",                 # Default encoding (no compression)
  req.http.Accept-Encoding
);

# Use the selected encoding for content negotiation
set req.http.X-Encoding = var.selected_encoding;
```

#### Compression-based cache variation

This example demonstrates how to vary cache based on the selected encoding:

```vcl
if (var.selected_encoding == "br" || var.selected_encoding == "gzip") {
  # Set Vary header to ensure proper caching
  set beresp.http.Vary = "Accept-Encoding";
  
  # Set the Content-Encoding header
  set beresp.http.Content-Encoding = var.selected_encoding;
}
```

## accept.media_lookup

Selects the best match from an Accept header value against available media types.

### Syntax

```vcl
STRING accept.media_lookup(STRING available_media_types, STRING default_media_type, STRING media_type_patterns, STRING accept_header)
```

### Parameters

- `available_media_types`: Colon-separated list of media types available for the resource
- `default_media_type`: Fallback media type if no match is found
- `media_type_patterns`: Colon-separated list of media types corresponding to media type patterns
- `accept_header`: The Accept header value to parse

### Return Value

The best matching media type from the available list, or the default if no match.

### RFC Compliance

Conforms to RFC 7231, Section 5.3.2

### Examples

#### Content type negotiation

This example selects the best media type match from the Accept header:

```vcl
declare local var.selected_media_type STRING;
set var.selected_media_type = accept.media_lookup(
  "application/json:application/xml:text/html:text/plain", # Available media types
  "application/json",                                      # Default media type
  "application/json:application/xml:text/html:text/plain", # Media type patterns
  req.http.Accept
);
```

#### API version content negotiation

This example demonstrates how to handle API versioning through content negotiation:

```vcl
if (req.url ~ "^/api/") {
  declare local var.api_media_types STRING;
  set var.api_media_types = "application/vnd.company.api.v2+json:" +
                           "application/vnd.company.api.v1+json:" +
                           "application/json";
  
  set var.selected_media_type = accept.media_lookup(
    var.api_media_types,
    "application/json", # Default to latest version
    var.api_media_types, # Media type patterns
    req.http.Accept
  );
  
  # Set API version based on selected media type
  if (var.selected_media_type == "application/vnd.company.api.v2+json") {
    set req.http.X-API-Version = "v2";
  } else if (var.selected_media_type == "application/vnd.company.api.v1+json") {
    set req.http.X-API-Version = "v1";
  } else {
    set req.http.X-API-Version = "v2"; # Default to latest
  }
}
```

#### Format-based URL rewriting

This example shows how to rewrite URLs based on preferred format:

```vcl
if (req.url !~ "\.(json|xml|html|txt)$") {
  if (var.selected_media_type == "application/json") {
    set req.url = req.url + ".json";
  } else if (var.selected_media_type == "application/xml") {
    set req.url = req.url + ".xml";
  } else if (var.selected_media_type == "text/html") {
    set req.url = req.url + ".html";
  } else if (var.selected_media_type == "text/plain") {
    set req.url = req.url + ".txt";
  }
}
```

## Integrated Example: Complete Content Negotiation System

This example demonstrates how all accept header functions can work together to create a comprehensive content negotiation system.

```vcl
sub vcl_recv {
  # Step 1: Determine the client's preferred language
  declare local var.language STRING;
  set var.language = accept.language_lookup(
    "en:fr:de:ja:es",
    "en",
    req.http.Accept-Language
  );
  
  # Step 2: Determine the client's preferred media type
  declare local var.format STRING;
  set var.format = accept.media_lookup(
    "application/json:application/xml:text/html",
    "text/html",
    "application/json:application/xml:text/html", # Media type patterns
    req.http.Accept
  );
  
  # Step 3: Determine the client's preferred charset
  declare local var.charset STRING;
  set var.charset = accept.charset_lookup(
    "utf-8:iso-8859-1",
    "utf-8",
    req.http.Accept-Charset
  );
  
  # Step 4: Determine the client's preferred encoding
  declare local var.encoding STRING;
  set var.encoding = accept.encoding_lookup(
    "br:gzip:identity",
    "identity",
    req.http.Accept-Encoding
  );
  
  # Step 5: Set headers for backend to use
  set req.http.X-Content-Language = var.language;
  set req.http.X-Content-Type = var.format;
  set req.http.X-Content-Charset = var.charset;
  set req.http.X-Content-Encoding = var.encoding;
  
  # Step 6: Implement content-based routing
  # Route to different backends based on content negotiation results
  if (var.format == "application/json") {
    # JSON API backend
    set req.backend = F_api_backend;
  } else if (var.format == "text/html") {
    # HTML website backend
    if (var.language == "ja") {
      # Japanese-specific backend
      set req.backend = F_japan_website_backend;
    } else {
      # Default website backend
      set req.backend = F_website_backend;
    }
  }
  
  # Step 7: Set appropriate Vary headers in vcl_deliver
  # This ensures proper caching based on content negotiation
}

sub vcl_deliver {
  # Set appropriate Vary headers based on content negotiation
  declare local var.vary_headers STRING;
  set var.vary_headers = "";
  
  if (resp.http.Content-Language) {
    set var.vary_headers = "Accept-Language";
  }
  
  if (resp.http.Content-Type) {
    if (var.vary_headers != "") {
      set var.vary_headers = var.vary_headers + ", Accept";
    } else {
      set var.vary_headers = "Accept";
    }
  }
  
  if (resp.http.Content-Encoding && resp.http.Content-Encoding != "identity") {
    if (var.vary_headers != "") {
      set var.vary_headers = var.vary_headers + ", Accept-Encoding";
    } else {
      set var.vary_headers = "Accept-Encoding";
    }
  }
  
  if (var.vary_headers != "") {
    set resp.http.Vary = var.vary_headers;
  }
}
```

## Best Practices for Accept Header Functions

1. Always provide a sensible default value as the second parameter
2. Handle missing Accept headers gracefully
3. Keep the list of available options reasonably small for performance
4. Set appropriate Vary headers when using content negotiation
5. Consider caching implications when implementing content negotiation
6. Use these functions for routing to different backends based on client preferences
7. Combine with other VCL functions for comprehensive content delivery strategies