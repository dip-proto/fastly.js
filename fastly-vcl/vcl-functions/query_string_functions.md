# Query String Functions

This file demonstrates comprehensive examples of Query String Functions in VCL.
These functions help manipulate URL query strings, enabling powerful URL
transformations, parameter extraction, and query string normalization.

Note that all of these functions operate on a full URL (for example `req.url`),
not on a bare query string. The query string is the part of the URL after the
first `?`. Functions that transform the query string return the whole URL with
the query string modified.

## querystring.get

Extracts the value of a specific parameter from the query string of a URL.

### Syntax

```vcl
STRING querystring.get(STRING url, STRING name)
```

### Parameters

- `url`: The URL whose query string to extract from
- `name`: The name of the parameter to extract

### Return Value

The value of the first occurrence of the named parameter, or not set if the
parameter is not present

### Examples

#### Basic parameter extraction

```vcl
declare local var.url STRING;
declare local var.product_id STRING;
declare local var.category STRING;
declare local var.sort_by STRING;

# Set a sample URL
set var.url = "/catalog?product_id=12345&category=electronics&sort_by=price";

# Extract specific parameters
set var.product_id = querystring.get(var.url, "product_id");
set var.category = querystring.get(var.url, "category");
set var.sort_by = querystring.get(var.url, "sort_by");

# Log the extracted values
log "Product ID: " + var.product_id;  # "12345"
log "Category: " + var.category;      # "electronics"
log "Sort By: " + var.sort_by;        # "price"
```

#### Extracting from the request URL

```vcl
declare local var.page STRING;
declare local var.limit STRING;

# Extract parameters directly from the request URL
set var.page = querystring.get(req.url, "page");
set var.limit = querystring.get(req.url, "limit");

# Set default values if parameters are missing
if (!var.page) {
  set var.page = "1";  # Default to page 1
}

if (!var.limit) {
  set var.limit = "20";  # Default to 20 items per page
}

# Store the values in request headers for backend use
set req.http.X-Page = var.page;
set req.http.X-Limit = var.limit;
```

#### Handling URL-encoded values

```vcl
declare local var.search_query STRING;

# Extract a potentially URL-encoded search query
set var.search_query = querystring.get(req.url, "q");

# URL-decode the search query if needed
if (var.search_query != "") {
  set var.search_query = urldecode(var.search_query);
  set req.http.X-Search-Query = var.search_query;
}
```

#### Extracting multiple values for the same parameter

```vcl
declare local var.tags STRING;

# For a URL like "/items?tags=red&tags=blue&tags=green"
set var.tags = querystring.get(req.url, "tags");

# var.tags will contain only "red" (the first value)
# To handle multiple values, you would need to use other techniques
# such as custom parsing or backend processing
```

#### Parameter presence check

```vcl
declare local var.has_debug BOOL;

# Check if a parameter exists and has a value
# querystring.get returns not set when the parameter is absent
set var.has_debug = (querystring.get(req.url, "debug") != "");
```

## querystring.add

Adds a parameter to the query string of a URL.

### Syntax

```vcl
STRING querystring.add(STRING url, STRING name, STRING value)
```

### Parameters

- `url`: The URL to add the parameter to
- `name`: The name of the parameter to add
- `value`: The value to set for the parameter

### Return Value

The URL with the new parameter appended to its query string

### Examples

#### Adding a parameter to a URL without a query string

```vcl
declare local var.url STRING;
declare local var.result1 STRING;

set var.url = "/catalog";
set var.result1 = querystring.add(var.url, "page", "1");

# var.result1 is now "/catalog?page=1"
log "Result 1: " + var.result1;
```

#### Adding a parameter to an existing query string

```vcl
declare local var.existing_url STRING;
declare local var.result2 STRING;

set var.existing_url = "/catalog?category=electronics&sort=price";
set var.result2 = querystring.add(var.existing_url, "limit", "20");

# var.result2 is now "/catalog?category=electronics&sort=price&limit=20"
log "Result 2: " + var.result2;
```

#### Adding a parameter that already exists

```vcl
declare local var.result3 STRING;

set var.result3 = querystring.add(var.result2, "category", "computers");

# var.result3 is now "/catalog?category=electronics&sort=price&limit=20&category=computers"
# Note: This will add a duplicate parameter, not replace the existing one
log "Result 3: " + var.result3;
```

#### Adding a parameter with URL encoding

```vcl
declare local var.result4 STRING;

# URL-encode the value before adding it
set var.result4 = querystring.add(var.existing_url, "q", urlencode("laptop & tablet"));

# var.result4 is now "/catalog?category=electronics&sort=price&q=laptop%20%26%20tablet"
log "Result 4: " + var.result4;
```

#### Building a query string from scratch

```vcl
declare local var.built_url STRING;

# Start with a bare path and add parameters one by one
set var.built_url = "/search";
set var.built_url = querystring.add(var.built_url, "product", "laptop");
set var.built_url = querystring.add(var.built_url, "brand", "acme");
set var.built_url = querystring.add(var.built_url, "price", "500-1000");

# var.built_url is now "/search?product=laptop&brand=acme&price=500-1000"
log "Built URL: " + var.built_url;
```

## querystring.set

Sets or replaces a parameter in the query string of a URL.

### Syntax

```vcl
STRING querystring.set(STRING url, STRING name, STRING value)
```

### Parameters

- `url`: The URL to modify
- `name`: The name of the parameter to set
- `value`: The value to set for the parameter

### Return Value

The URL with the parameter set or replaced in its query string

### Examples

#### Setting a parameter on a URL without a query string

```vcl
declare local var.url STRING;
declare local var.result1 STRING;

set var.url = "/catalog";
set var.result1 = querystring.set(var.url, "page", "1");

# var.result1 is now "/catalog?page=1"
log "Result 1: " + var.result1;
```

#### Setting a new parameter in an existing query string

```vcl
declare local var.existing_url STRING;
declare local var.result2 STRING;

set var.existing_url = "/catalog?category=electronics&sort=price";
set var.result2 = querystring.set(var.existing_url, "limit", "20");

# var.result2 is now "/catalog?category=electronics&sort=price&limit=20"
log "Result 2: " + var.result2;
```

#### Replacing an existing parameter

```vcl
declare local var.result3 STRING;

set var.result3 = querystring.set(var.existing_url, "category", "computers");

# var.result3 is now "/catalog?category=computers&sort=price"
# Note: This replaces the existing "category" parameter
log "Result 3: " + var.result3;
```

#### Setting a parameter with URL encoding

```vcl
declare local var.result4 STRING;

# URL-encode the value before setting it
set var.result4 = querystring.set(var.existing_url, "q", urlencode("laptop & tablet"));

# var.result4 is now "/catalog?category=electronics&sort=price&q=laptop%20%26%20tablet"
log "Result 4: " + var.result4;
```

#### Practical application - normalizing pagination parameters

```vcl
declare local var.page STRING;
declare local var.limit STRING;

# Get current pagination parameters
set var.page = querystring.get(req.url, "page");
set var.limit = querystring.get(req.url, "limit");

# Set default values if missing or invalid
if (!var.page || std.atoi(var.page) < 1) {
  set var.page = "1";
}

if (!var.limit || std.atoi(var.limit) < 1 || std.atoi(var.limit) > 100) {
  set var.limit = "20";
}

# Normalize the request URL
set req.url = querystring.set(req.url, "page", var.page);
set req.url = querystring.set(req.url, "limit", var.limit);
```

## querystring.remove

Removes the entire query string from a URL. Note that this function removes
the whole query string, including the `?`; to remove individual parameters,
use `querystring.filter` (by name) or `querystring.regfilter` (by pattern).

### Syntax

```vcl
STRING querystring.remove(STRING url)
```

### Parameters

- `url`: The URL to strip the query string from

### Return Value

The URL without its query string

### Examples

#### Removing the query string from a URL

```vcl
declare local var.original_url STRING;
declare local var.result1 STRING;

set var.original_url = "/catalog?category=electronics&sort=price&page=1";
set var.result1 = querystring.remove(var.original_url);

# var.result1 is now "/catalog"
log "Result 1: " + var.result1;
```

#### Removing a query string that isn't there

```vcl
declare local var.result2 STRING;

set var.result2 = querystring.remove("/catalog");

# var.result2 is unchanged: "/catalog"
log "Result 2: " + var.result2;
```

#### Practical application - ignoring query strings for static assets

```vcl
if (req.url.ext == "css" || req.url.ext == "js" || req.url.ext == "png") {
  # Static assets don't vary on query string parameters
  set req.url = querystring.remove(req.url);
}
```

## querystring.filter

Removes the named parameters from the query string of a URL. The parameter
names are given as a list separated by `querystring.filtersep()`. For
pattern-based filtering, see `querystring.regfilter` and
`querystring.globfilter`.

### Syntax

```vcl
STRING querystring.filter(STRING url, STRING filter_list)
```

### Parameters

- `url`: The URL to filter
- `filter_list`: Parameter names to remove, separated by `querystring.filtersep()`

### Return Value

The URL with the named parameters removed from its query string

### Examples

#### Removing a single parameter

```vcl
declare local var.original_url STRING;
declare local var.result1 STRING;

set var.original_url = "/item?id=123&debug=true&prod=xyz";
set var.result1 = querystring.filter(var.original_url, "debug");

# var.result1 is now "/item?id=123&prod=xyz"
log "Result 1: " + var.result1;
```

#### Removing several parameters

```vcl
declare local var.result2 STRING;

set var.original_url = "/item?id=123&debug=true&test=abc&prod=xyz";
set var.result2 = querystring.filter(var.original_url,
    "debug" + querystring.filtersep() + "test");

# var.result2 is now "/item?id=123&prod=xyz"
# Note: Parameters "debug" and "test" are removed
log "Result 2: " + var.result2;
```

#### Practical application - removing tracking parameters

```vcl
# Remove common tracking parameters from the request URL
set req.url = querystring.filter(req.url,
    "utm_source" + querystring.filtersep() +
    "utm_medium" + querystring.filtersep() +
    "utm_campaign" + querystring.filtersep() +
    "utm_term" + querystring.filtersep() +
    "utm_content" + querystring.filtersep() +
    "fbclid" + querystring.filtersep() +
    "gclid");
```

## querystring.filter_except

Keeps only the named parameters in the query string of a URL. The parameter
names are given as a list separated by `querystring.filtersep()`.

### Syntax

```vcl
STRING querystring.filter_except(STRING url, STRING filter_list)
```

### Parameters

- `url`: The URL to filter
- `filter_list`: Parameter names to keep, separated by `querystring.filtersep()`

### Return Value

The URL with only the named parameters kept in its query string

### Examples

#### Keeping specific parameters

```vcl
declare local var.original_url STRING;
declare local var.result1 STRING;

set var.original_url = "/item?id=123&debug=true&test=abc&prod=xyz";
set var.result1 = querystring.filter_except(var.original_url,
    "id" + querystring.filtersep() + "prod");

# var.result1 is now "/item?id=123&prod=xyz"
# Note: Only parameters "id" and "prod" are kept
log "Result 1: " + var.result1;
```

#### Practical application - keeping only essential parameters

```vcl
# Keep only the parameters that affect the response
set req.url = querystring.filter_except(req.url,
    "id" + querystring.filtersep() +
    "category" + querystring.filtersep() +
    "page" + querystring.filtersep() +
    "limit" + querystring.filtersep() +
    "sort");
```

## querystring.filtersep

Returns the separator string used to build the parameter name lists consumed
by `querystring.filter` and `querystring.filter_except`. Using this separator
instead of a literal character avoids ambiguity when parameter names could
contain the separator themselves.

### Syntax

```vcl
STRING querystring.filtersep()
```

### Parameters

None

### Return Value

The separator string for filter lists

### Examples

#### Building a filter list

```vcl
declare local var.filtered_url STRING;

set var.filtered_url = querystring.filter(req.url,
    "utm_source" + querystring.filtersep() +
    "utm_medium" + querystring.filtersep() +
    "utm_campaign");

# All three tracking parameters are removed in a single call
```

## querystring.regfilter

Removes parameters whose names match a regular expression from the query
string of a URL.

### Syntax

```vcl
STRING querystring.regfilter(STRING url, STRING regex)
```

### Parameters

- `url`: The URL to filter
- `regex`: A regular expression to match parameter names against

### Return Value

The URL with matching parameters removed from its query string

### Examples

#### Removing parameters with a pattern prefix

```vcl
declare local var.original_url STRING;
declare local var.result1 STRING;

set var.original_url = "/landing?utm_source=google&utm_medium=cpc&id=123";
set var.result1 = querystring.regfilter(var.original_url, "^utm_");

# var.result1 is now "/landing?id=123"
# Note: All parameters starting with "utm_" are removed
log "Result 1: " + var.result1;
```

#### Removing parameters with a complex pattern

```vcl
declare local var.result2 STRING;

set var.original_url = "/item?p=1&page=1&pg=1&id=123&debug=true";
set var.result2 = querystring.regfilter(var.original_url, "^p(age)?$|^pg$|^debug$");

# var.result2 is now "/item?id=123"
# Note: Parameters "p", "page", "pg", and "debug" are removed
log "Result 2: " + var.result2;
```

#### Practical application - removing all tracking and debug parameters

```vcl
# Remove tracking and debug parameters in one pass
set req.url = querystring.regfilter(req.url,
    "^utm_|^fb_|^ga_|^msclkid$|^fbclid$|^gclid$|^dclid$|^debug$|^test$");
```

## querystring.regfilter_except

Keeps only parameters whose names match a regular expression in the query
string of a URL.

### Syntax

```vcl
STRING querystring.regfilter_except(STRING url, STRING regex)
```

### Parameters

- `url`: The URL to filter
- `regex`: A regular expression to match parameter names against

### Return Value

The URL with only matching parameters kept in its query string

### Examples

#### Keeping parameters with a simple pattern

```vcl
declare local var.original_url STRING;
declare local var.result1 STRING;

set var.original_url = "/item?id=123&debug=true&test=abc&prod=xyz";
set var.result1 = querystring.regfilter_except(var.original_url, "^(id|prod)$");

# var.result1 is now "/item?id=123&prod=xyz"
# Note: Only parameters "id" and "prod" are kept
log "Result 1: " + var.result1;
```

#### Practical application - keeping only essential parameters

```vcl
# Keep only the parameters that should be part of the cache key
set req.url = querystring.regfilter_except(req.url,
    "^(id|category|page|limit|sort)$");
```

## querystring.globfilter

Removes parameters whose names match a glob pattern from the query string of
a URL.

### Syntax

```vcl
STRING querystring.globfilter(STRING url, STRING glob)
```

### Parameters

- `url`: The URL to filter
- `glob`: A glob pattern to match parameter names against

### Return Value

The URL with matching parameters removed from its query string

### Examples

#### Removing parameters with a simple glob pattern

```vcl
declare local var.original_url STRING;
declare local var.result1 STRING;

set var.original_url = "/item?id=123&debug=true&test=abc&prod=xyz";
set var.result1 = querystring.globfilter(var.original_url, "debug");

# var.result1 is now "/item?id=123&test=abc&prod=xyz"
# Note: Parameter "debug" is removed
log "Result 1: " + var.result1;
```

#### Removing parameters with a wildcard glob pattern

```vcl
declare local var.result2 STRING;

set var.original_url = "/landing?utm_source=google&utm_medium=cpc&id=123";
set var.result2 = querystring.globfilter(var.original_url, "utm_*");

# var.result2 is now "/landing?id=123"
# Note: All parameters starting with "utm_" are removed
log "Result 2: " + var.result2;
```

#### Removing parameters with multiple glob patterns

```vcl
declare local var.result3 STRING;

set var.original_url = "/item?id=123&sort_by=price&filter_by=brand&order_by=asc";

# Remove multiple patterns one by one
set var.result3 = var.original_url;
set var.result3 = querystring.globfilter(var.result3, "sort_*");
set var.result3 = querystring.globfilter(var.result3, "filter_*");

# var.result3 is now "/item?id=123&order_by=asc"
log "Result 3: " + var.result3;
```

#### Practical application - removing tracking parameters

```vcl
# Remove tracking parameters using glob patterns
set req.url = querystring.globfilter(req.url, "utm_*");
set req.url = querystring.globfilter(req.url, "fb*");
set req.url = querystring.globfilter(req.url, "gclid");
set req.url = querystring.globfilter(req.url, "msclkid");
```

## querystring.globfilter_except

Keeps only parameters whose names match a glob pattern in the query string of
a URL.

### Syntax

```vcl
STRING querystring.globfilter_except(STRING url, STRING glob)
```

### Parameters

- `url`: The URL to filter
- `glob`: A glob pattern to match parameter names against

### Return Value

The URL with only matching parameters kept in its query string

### Examples

#### Keeping parameters with a simple glob pattern

```vcl
declare local var.original_url STRING;
declare local var.result1 STRING;

set var.original_url = "/item?id=123&debug=true&test=abc&prod=xyz";
set var.result1 = querystring.globfilter_except(var.original_url, "id");

# var.result1 is now "/item?id=123"
# Note: Only parameter "id" is kept
log "Result 1: " + var.result1;
```

#### Keeping parameters with a wildcard glob pattern

```vcl
declare local var.result2 STRING;

set var.original_url = "/landing?utm_source=google&utm_medium=cpc&id=123";
set var.result2 = querystring.globfilter_except(var.original_url, "utm_*");

# var.result2 is now "/landing?utm_source=google&utm_medium=cpc"
# Note: Only parameters starting with "utm_" are kept
log "Result 2: " + var.result2;
```

#### Keeping parameters matching several patterns

```vcl
# globfilter_except only accepts one pattern; to keep parameters matching
# several distinct patterns, use querystring.regfilter_except with an
# alternation instead
set req.url = querystring.regfilter_except(req.url, "^id$|^page$|^sort");
```

## querystring.clean

Removes parameters with no value (empty parameters) from the query string of
a URL.

### Syntax

```vcl
STRING querystring.clean(STRING url)
```

### Parameters

- `url`: The URL to clean

### Return Value

The URL with empty parameters removed from its query string

### Examples

#### Cleaning a query string with empty parameters

```vcl
declare local var.original_url STRING;
declare local var.result1 STRING;

set var.original_url = "/item?id=123&empty=&blank=&valid=yes";
set var.result1 = querystring.clean(var.original_url);

# var.result1 is now "/item?id=123&valid=yes"
# Note: Parameters "empty" and "blank" are removed
log "Result 1: " + var.result1;
```

#### Cleaning a query string with no empty parameters

```vcl
declare local var.result2 STRING;

set var.original_url = "/item?id=123&category=electronics&sort=price";
set var.result2 = querystring.clean(var.original_url);

# var.result2 is unchanged: "/item?id=123&category=electronics&sort=price"
log "Result 2: " + var.result2;
```

#### Practical application - cleaning user-submitted query strings

```vcl
# Clean the request URL to remove empty parameters
set req.url = querystring.clean(req.url);
```

## querystring.sort

Sorts the parameters in the query string of a URL alphabetically.

### Syntax

```vcl
STRING querystring.sort(STRING url [, BOOL only_unique_keys])
```

### Parameters

- `url`: The URL whose query string to sort
- `only_unique_keys`: Optional; when true, duplicate parameter names are
  reduced to a single occurrence

### Return Value

The URL with its query string parameters sorted

### Examples

#### Sorting a query string

```vcl
declare local var.original_url STRING;
declare local var.result1 STRING;

set var.original_url = "/item?z=last&a=first&m=middle";
set var.result1 = querystring.sort(var.original_url);

# var.result1 is now "/item?a=first&m=middle&z=last"
# Note: Parameters are sorted alphabetically by name
log "Result 1: " + var.result1;
```

#### Sorting a query string with duplicate parameters

```vcl
declare local var.result2 STRING;

set var.original_url = "/item?tag=blue&id=123&tag=red";
set var.result2 = querystring.sort(var.original_url);

# var.result2 is now "/item?id=123&tag=blue&tag=red"
# Note: Duplicate parameters maintain their relative order
log "Result 2: " + var.result2;
```

#### Practical application - normalizing cache keys

```vcl
# Sort the query string so equivalent URLs share a cache object
set req.url = querystring.sort(req.url);
```

## boltsort.sort

A legacy alias of `querystring.sort`. New code should use `querystring.sort`.

### Syntax

```vcl
STRING boltsort.sort(STRING url [, BOOL only_unique_keys])
```

### Parameters

- `url`: The URL whose query string to sort
- `only_unique_keys`: Optional; when true, duplicate parameter names are
  reduced to a single occurrence

### Return Value

The URL with its query string parameters sorted

### Examples

```vcl
set req.url = boltsort.sort(req.url);
# Equivalent to: set req.url = querystring.sort(req.url);
```

## Integrated Example: Complete Query String Management System

This example demonstrates how multiple query string functions can work together to create a comprehensive query string management system.

```vcl
sub vcl_recv {
  # Step 1: Extract and normalize essential parameters

  # Get pagination parameters with defaults
  declare local var.page STRING;
  declare local var.limit STRING;

  set var.page = querystring.get(req.url, "page");
  set var.limit = querystring.get(req.url, "limit");

  # Set default values if missing or invalid
  if (!var.page || std.atoi(var.page) < 1) {
    set var.page = "1";
  }

  if (!var.limit || std.atoi(var.limit) < 1 || std.atoi(var.limit) > 100) {
    set var.limit = "20";
  }

  # Get sorting parameters
  declare local var.sort_field STRING;
  declare local var.sort_dir STRING;

  set var.sort_field = querystring.get(req.url, "sort");
  set var.sort_dir = querystring.get(req.url, "dir");

  # Set default values if missing or invalid
  if (!var.sort_field) {
    set var.sort_field = "date";
  }

  if (var.sort_dir != "asc" && var.sort_dir != "desc") {
    set var.sort_dir = "desc";
  }

  # Step 2: Remove empty parameters
  set req.url = querystring.clean(req.url);

  # Step 3: Remove tracking and debug parameters
  set req.url = querystring.regfilter(req.url,
      "^utm_|^fb_|^ga_|^msclkid$|^fbclid$|^gclid$|^dclid$|^debug$|^test$");

  # Step 4: Keep only essential parameters
  set req.url = querystring.regfilter_except(req.url,
      "^(id|category|page|limit|sort|dir|q|filter)$");

  # Step 5: Set normalized parameters
  set req.url = querystring.set(req.url, "page", var.page);
  set req.url = querystring.set(req.url, "limit", var.limit);
  set req.url = querystring.set(req.url, "sort", var.sort_field);
  set req.url = querystring.set(req.url, "dir", var.sort_dir);

  # Step 6: Sort the parameters so equivalent URLs share a cache object
  set req.url = querystring.sort(req.url);
}
```

## Best Practices for Query String Functions

1. Parameter Extraction:
   - Always check if parameters exist before using them (querystring.get
     returns not set for missing parameters)
   - Provide default values for missing parameters
   - Consider URL-decoding values when needed

2. Parameter Modification:
   - Use querystring.set to replace existing parameters
   - Use querystring.add to add new parameters (be aware it can create duplicates)
   - URL-encode parameter values before adding them

3. Query String Cleaning:
   - Remove tracking parameters to improve cache hit ratios
   - Remove debug parameters in production environments
   - Use querystring.clean to remove empty parameters

4. Caching Considerations:
   - Keep only essential parameters for cache keys
   - Sort parameters for consistent cache keys
   - Consider normalizing parameter values for better cache efficiency

5. Security Considerations:
   - Filter out potentially dangerous parameters
   - Validate and sanitize parameter values
   - Be cautious with parameters that might contain sensitive information

6. Performance Optimization:
   - Minimize the number of query string operations
   - Use the most specific function for each task: querystring.filter for
     fixed names, querystring.globfilter for globs, querystring.regfilter
     for regular expressions
   - Consider the performance impact of complex regex patterns

7. URL Normalization:
   - Normalize URLs for consistent behavior
   - Sort parameters for canonical URLs
   - Remove unnecessary parameters for cleaner URLs
