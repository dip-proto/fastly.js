# Query String Functions

This file demonstrates comprehensive examples of Query String Functions in VCL.
These functions help manipulate URL query strings, enabling powerful URL
transformations, parameter extraction, and query string normalization.

## querystring.get

Extracts the value of a specific parameter from a query string.

### Syntax

```vcl
STRING querystring.get(STRING query_string, STRING parameter_name)
```

### Parameters

- `query_string`: The query string to extract from
- `parameter_name`: The name of the parameter to extract

### Return Value

The value of the specified parameter, or an empty string if not found

### Examples

#### Basic parameter extraction

```vcl
declare local var.query_string STRING;
declare local var.product_id STRING;
declare local var.category STRING;
declare local var.sort_by STRING;

# Set a sample query string
set var.query_string = "product_id=12345&category=electronics&sort_by=price";

# Extract specific parameters
set var.product_id = querystring.get(var.query_string, "product_id");
set var.category = querystring.get(var.query_string, "category");
set var.sort_by = querystring.get(var.query_string, "sort_by");

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
set var.page = querystring.get(req.url.qs, "page");
set var.limit = querystring.get(req.url.qs, "limit");

# Set default values if parameters are missing
if (var.page == "") {
  set var.page = "1";  # Default to page 1
}

if (var.limit == "") {
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
set var.search_query = querystring.get(req.url.qs, "q");

# URL-decode the search query if needed
if (var.search_query != "") {
  set var.search_query = urldecode(var.search_query);
  set req.http.X-Search-Query = var.search_query;
}
```

#### Extracting multiple values for the same parameter

```vcl
declare local var.tags STRING;

# For a query string like "tags=red&tags=blue&tags=green"
set var.tags = querystring.get(req.url.qs, "tags");

# var.tags will contain only "red" (the first value)
# To handle multiple values, you would need to use other techniques
# such as custom parsing or backend processing
```

#### Parameter presence check

```vcl
declare local var.has_debug BOOL;

# Check if a parameter exists, regardless of its value
set var.has_debug = (querystring.get(req.url.qs, "debug") != "");
## querystring.add

Adds a parameter to a query string.

### Syntax

```vcl
STRING querystring.add(STRING query_string, STRING parameter_name, STRING parameter_value)
```

### Parameters

- `query_string`: The query string to add to
- `parameter_name`: The name of the parameter to add
- `parameter_value`: The value to set for the parameter

### Return Value

The modified query string with the new parameter added

### Examples

#### Adding a parameter to an empty query string

```vcl
declare local var.empty_qs STRING;
declare local var.result1 STRING;

set var.empty_qs = "";
set var.result1 = querystring.add(var.empty_qs, "page", "1");

# var.result1 is now "page=1"
log "Result 1: " + var.result1;
```

#### Adding a parameter to an existing query string

```vcl
declare local var.existing_qs STRING;
declare local var.result2 STRING;

set var.existing_qs = "category=electronics&sort=price";
set var.result2 = querystring.add(var.existing_qs, "limit", "20");

# var.result2 is now "category=electronics&sort=price&limit=20"
log "Result 2: " + var.result2;
```

#### Adding a parameter that already exists

```vcl
declare local var.result3 STRING;

set var.result3 = querystring.add(var.result2, "category", "computers");

# var.result3 is now "category=electronics&sort=price&limit=20&category=computers"
# Note: This will add a duplicate parameter, not replace the existing one
log "Result 3: " + var.result3;
```

#### Adding a parameter with URL encoding

```vcl
declare local var.result4 STRING;

# URL-encode the value before adding it
set var.result4 = querystring.add(var.existing_qs, "q", urlencode("laptop & tablet"));

# var.result4 is now "category=electronics&sort=price&q=laptop%20%26%20tablet"
log "Result 4: " + var.result4;
```

#### Building a query string from scratch

```vcl
declare local var.built_qs STRING;

# Start with an empty string and add parameters one by one
set var.built_qs = "";
set var.built_qs = querystring.add(var.built_qs, "product", "laptop");
set var.built_qs = querystring.add(var.built_qs, "brand", "acme");
set var.built_qs = querystring.add(var.built_qs, "price", "500-1000");

# var.built_qs is now "product=laptop&brand=acme&price=500-1000"
log "Built query string: " + var.built_qs;
```

## querystring.set

Sets or replaces a parameter in a query string.

### Syntax

```vcl
STRING querystring.set(STRING query_string, STRING parameter_name, STRING parameter_value)
```

### Parameters

- `query_string`: The query string to modify
- `parameter_name`: The name of the parameter to set
- `parameter_value`: The value to set for the parameter

### Return Value

The modified query string with the parameter set or replaced

### Examples

#### Setting a parameter in an empty query string

```vcl
declare local var.empty_qs STRING;
declare local var.result1 STRING;

set var.empty_qs = "";
set var.result1 = querystring.set(var.empty_qs, "page", "1");

# var.result1 is now "page=1"
log "Result 1: " + var.result1;
```

#### Setting a new parameter in an existing query string

```vcl
declare local var.existing_qs STRING;
declare local var.result2 STRING;

set var.existing_qs = "category=electronics&sort=price";
set var.result2 = querystring.set(var.existing_qs, "limit", "20");

# var.result2 is now "category=electronics&sort=price&limit=20"
log "Result 2: " + var.result2;
```

#### Replacing an existing parameter

```vcl
declare local var.result3 STRING;

set var.result3 = querystring.set(var.existing_qs, "category", "computers");

# var.result3 is now "category=computers&sort=price"
# Note: This replaces the existing "category" parameter
log "Result 3: " + var.result3;
```

#### Setting a parameter with URL encoding

```vcl
declare local var.result4 STRING;

# URL-encode the value before setting it
set var.result4 = querystring.set(var.existing_qs, "q", urlencode("laptop & tablet"));

# var.result4 is now "category=electronics&sort=price&q=laptop%20%26%20tablet"
log "Result 4: " + var.result4;
```

#### Practical application - normalizing pagination parameters

```vcl
declare local var.normalized_qs STRING;
declare local var.page STRING;
declare local var.limit STRING;

# Get current pagination parameters
set var.page = querystring.get(req.url.qs, "page");
set var.limit = querystring.get(req.url.qs, "limit");

# Set default values if missing or invalid
if (var.page == "" || std.atoi(var.page) < 1) {
  set var.page = "1";
}

if (var.limit == "" || std.atoi(var.limit) < 1 || std.atoi(var.limit) > 100) {
  set var.limit = "20";
}

# Normalize the query string
set var.normalized_qs = req.url.qs;
set var.normalized_qs = querystring.set(var.normalized_qs, "page", var.page);
set var.normalized_qs = querystring.set(var.normalized_qs, "limit", var.limit);

# Update the request URL with the normalized query string
set req.url = req.url.path + "?" + var.normalized_qs;
```
## querystring.remove

Removes a parameter from a query string.

### Syntax

```vcl
STRING querystring.remove(STRING query_string, STRING parameter_name)
```

### Parameters

- `query_string`: The query string to modify
- `parameter_name`: The name of the parameter to remove

### Return Value

The modified query string with the parameter removed

### Examples

#### Removing a parameter from a query string

```vcl
declare local var.original_qs STRING;
declare local var.result1 STRING;

set var.original_qs = "category=electronics&sort=price&page=1";
set var.result1 = querystring.remove(var.original_qs, "sort");

# var.result1 is now "category=electronics&page=1"
log "Result 1: " + var.result1;
```

#### Removing a parameter that appears multiple times

```vcl
declare local var.multi_param_qs STRING;
declare local var.result2 STRING;

set var.multi_param_qs = "tag=red&tag=blue&tag=green&category=colors";
set var.result2 = querystring.remove(var.multi_param_qs, "tag");

# var.result2 is now "category=colors"
# Note: All instances of the parameter are removed
log "Result 2: " + var.result2;
```

#### Removing a parameter that doesn't exist

```vcl
declare local var.result3 STRING;

set var.result3 = querystring.remove(var.original_qs, "nonexistent");

# var.result3 is unchanged: "category=electronics&sort=price&page=1"
log "Result 3: " + var.result3;
```

#### Removing all parameters (one by one)

```vcl
declare local var.result4 STRING;

set var.result4 = var.original_qs;
set var.result4 = querystring.remove(var.result4, "category");
set var.result4 = querystring.remove(var.result4, "sort");
set var.result4 = querystring.remove(var.result4, "page");

# var.result4 is now an empty string ""
log "Result 4: '" + var.result4 + "'";
```

#### Practical application - removing tracking parameters

```vcl
declare local var.cleaned_qs STRING;

# Remove common tracking parameters
set var.cleaned_qs = req.url.qs;
set var.cleaned_qs = querystring.remove(var.cleaned_qs, "utm_source");
set var.cleaned_qs = querystring.remove(var.cleaned_qs, "utm_medium");
set var.cleaned_qs = querystring.remove(var.cleaned_qs, "utm_campaign");
set var.cleaned_qs = querystring.remove(var.cleaned_qs, "utm_term");
set var.cleaned_qs = querystring.remove(var.cleaned_qs, "utm_content");
set var.cleaned_qs = querystring.remove(var.cleaned_qs, "fbclid");
set var.cleaned_qs = querystring.remove(var.cleaned_qs, "gclid");

# Update the request URL with the cleaned query string
if (var.cleaned_qs == "") {
  set req.url = req.url.path;
} else {
  set req.url = req.url.path + "?" + var.cleaned_qs;
}
```

## querystring.filter

Removes parameters that match a regular expression pattern.

### Syntax

```vcl
STRING querystring.filter(STRING query_string, STRING pattern)
```

### Parameters

- `query_string`: The query string to filter
- `pattern`: A regular expression pattern to match parameter names against

### Return Value

The filtered query string with matching parameters removed

### Examples

#### Removing parameters with a simple pattern

```vcl
declare local var.original_qs STRING;
declare local var.result1 STRING;

set var.original_qs = "id=123&debug=true&test=abc&prod=xyz";
set var.result1 = querystring.filter(var.original_qs, "^(debug|test)$");

# var.result1 is now "id=123&prod=xyz"
# Note: Parameters "debug" and "test" are removed
log "Result 1: " + var.result1;
```

#### Removing parameters with a pattern prefix

```vcl
declare local var.result2 STRING;

set var.original_qs = "utm_source=google&utm_medium=cpc&utm_campaign=spring&id=123";
set var.result2 = querystring.filter(var.original_qs, "^utm_");

# var.result2 is now "id=123"
# Note: All parameters starting with "utm_" are removed
log "Result 2: " + var.result2;
```

#### Removing parameters with a pattern suffix

```vcl
declare local var.result3 STRING;

set var.original_qs = "id=123&sort_by=price&filter_by=brand&order_by=asc";
set var.result3 = querystring.filter(var.original_qs, "_by$");

# var.result3 is now "id=123"
# Note: All parameters ending with "_by" are removed
log "Result 3: " + var.result3;
```

#### Removing parameters with a complex pattern

```vcl
declare local var.result4 STRING;

set var.original_qs = "p=1&page=1&pg=1&id=123&debug=true";
set var.result4 = querystring.filter(var.original_qs, "^p(age)?$|^pg$|^debug$");

# var.result4 is now "id=123"
# Note: Parameters "p", "page", "pg", and "debug" are removed
log "Result 4: " + var.result4;
```

#### Practical application - removing all tracking and debug parameters

```vcl
declare local var.cleaned_qs STRING;

# Define a pattern for tracking and debug parameters
declare local var.tracking_pattern STRING;
set var.tracking_pattern = "^utm_|^fb_|^ga_|^msclkid$|^fbclid$|^gclid$|^dclid$|^debug$|^test$";

# Remove tracking parameters
set var.cleaned_qs = querystring.filter(req.url.qs, var.tracking_pattern);

# Update the request URL with the cleaned query string
if (var.cleaned_qs == "") {
  set req.url = req.url.path;
} else {
  set req.url = req.url.path + "?" + var.cleaned_qs;
}
```
## querystring.filter_except

Keeps only parameters that match a regular expression pattern.

### Syntax

```vcl
STRING querystring.filter_except(STRING query_string, STRING pattern)
```

### Parameters

- `query_string`: The query string to filter
- `pattern`: A regular expression pattern to match parameter names against

### Return Value

The filtered query string with only matching parameters kept

### Examples

#### Keeping parameters with a simple pattern

```vcl
declare local var.original_qs STRING;
declare local var.result1 STRING;

set var.original_qs = "id=123&debug=true&test=abc&prod=xyz";
set var.result1 = querystring.filter_except(var.original_qs, "^(id|prod)$");

# var.result1 is now "id=123&prod=xyz"
# Note: Only parameters "id" and "prod" are kept
log "Result 1: " + var.result1;
```

#### Keeping parameters with a pattern prefix

```vcl
declare local var.result2 STRING;

set var.original_qs = "utm_source=google&utm_medium=cpc&utm_campaign=spring&id=123";
set var.result2 = querystring.filter_except(var.original_qs, "^utm_");

# var.result2 is now "utm_source=google&utm_medium=cpc&utm_campaign=spring"
# Note: Only parameters starting with "utm_" are kept
log "Result 2: " + var.result2;
```

#### Keeping parameters with a pattern suffix

```vcl
declare local var.result3 STRING;

set var.original_qs = "id=123&sort_by=price&filter_by=brand&order_by=asc";
set var.result3 = querystring.filter_except(var.original_qs, "_by$");

# var.result3 is now "sort_by=price&filter_by=brand&order_by=asc"
# Note: Only parameters ending with "_by" are kept
log "Result 3: " + var.result3;
```

#### Keeping parameters with a complex pattern

```vcl
declare local var.result4 STRING;

set var.original_qs = "p=1&page=1&pg=1&id=123&debug=true";
set var.result4 = querystring.filter_except(var.original_qs, "^p(age)?$|^pg$");

# var.result4 is now "p=1&page=1&pg=1"
# Note: Only parameters "p", "page", and "pg" are kept
log "Result 4: " + var.result4;
```

#### Practical application - keeping only essential parameters

```vcl
declare local var.essential_qs STRING;

# Define a pattern for essential parameters
declare local var.essential_pattern STRING;
set var.essential_pattern = "^(id|category|page|limit|sort)$";

# Keep only essential parameters
set var.essential_qs = querystring.filter_except(req.url.qs, var.essential_pattern);

# Update the request URL with the essential query string
if (var.essential_qs == "") {
  set req.url = req.url.path;
} else {
  set req.url = req.url.path + "?" + var.essential_qs;
}
```

## querystring.globfilter

Removes parameters that match a glob pattern.

### Syntax

```vcl
STRING querystring.globfilter(STRING query_string, STRING pattern)
```

### Parameters

- `query_string`: The query string to filter
- `pattern`: A glob pattern to match parameter names against

### Return Value

The filtered query string with matching parameters removed

### Examples

#### Removing parameters with a simple glob pattern

```vcl
declare local var.original_qs STRING;
declare local var.result1 STRING;

set var.original_qs = "id=123&debug=true&test=abc&prod=xyz";
set var.result1 = querystring.globfilter(var.original_qs, "debug");

# var.result1 is now "id=123&test=abc&prod=xyz"
# Note: Parameter "debug" is removed
log "Result 1: " + var.result1;
```

#### Removing parameters with a wildcard glob pattern

```vcl
declare local var.result2 STRING;

set var.original_qs = "utm_source=google&utm_medium=cpc&utm_campaign=spring&id=123";
set var.result2 = querystring.globfilter(var.original_qs, "utm_*");

# var.result2 is now "id=123"
# Note: All parameters starting with "utm_" are removed
log "Result 2: " + var.result2;
```

#### Removing parameters with multiple glob patterns

```vcl
declare local var.result3 STRING;

set var.original_qs = "id=123&sort_by=price&filter_by=brand&order_by=asc";

# Remove multiple patterns one by one
set var.result3 = var.original_qs;
set var.result3 = querystring.globfilter(var.result3, "sort_*");
set var.result3 = querystring.globfilter(var.result3, "filter_*");

# var.result3 is now "id=123&order_by=asc"
log "Result 3: " + var.result3;
```

#### Removing parameters with question mark wildcard

```vcl
declare local var.result4 STRING;

set var.original_qs = "p=1&page=1&pg=1&id=123&debug=true";
set var.result4 = querystring.globfilter(var.original_qs, "p?");

# var.result4 is now "page=1&id=123&debug=true"
# Note: Parameter "pg" is removed (matches "p?" pattern)
log "Result 4: " + var.result4;
```

#### Practical application - removing tracking parameters

```vcl
declare local var.cleaned_qs STRING;

# Remove tracking parameters using glob patterns
set var.cleaned_qs = req.url.qs;
set var.cleaned_qs = querystring.globfilter(var.cleaned_qs, "utm_*");
set var.cleaned_qs = querystring.globfilter(var.cleaned_qs, "fb*");
set var.cleaned_qs = querystring.globfilter(var.cleaned_qs, "gclid");
set var.cleaned_qs = querystring.globfilter(var.cleaned_qs, "msclkid");

# Update the request URL with the cleaned query string
if (var.cleaned_qs == "") {
  set req.url = req.url.path;
} else {
  set req.url = req.url.path + "?" + var.cleaned_qs;
}
```
## querystring.globfilter_except

Keeps only parameters that match a glob pattern.

### Syntax

```vcl
STRING querystring.globfilter_except(STRING query_string, STRING pattern)
```

### Parameters

- `query_string`: The query string to filter
- `pattern`: A glob pattern to match parameter names against

### Return Value

The filtered query string with only matching parameters kept

### Examples

#### Keeping parameters with a simple glob pattern

```vcl
declare local var.original_qs STRING;
declare local var.result1 STRING;

set var.original_qs = "id=123&debug=true&test=abc&prod=xyz";
set var.result1 = querystring.globfilter_except(var.original_qs, "id");

# var.result1 is now "id=123"
# Note: Only parameter "id" is kept
log "Result 1: " + var.result1;
```

#### Keeping parameters with a wildcard glob pattern

```vcl
declare local var.result2 STRING;

set var.original_qs = "utm_source=google&utm_medium=cpc&utm_campaign=spring&id=123";
set var.result2 = querystring.globfilter_except(var.original_qs, "utm_*");

# var.result2 is now "utm_source=google&utm_medium=cpc&utm_campaign=spring"
# Note: Only parameters starting with "utm_" are kept
log "Result 2: " + var.result2;
```

#### Keeping parameters with multiple glob patterns

```vcl
declare local var.result3 STRING;

set var.original_qs = "id=123&sort_by=price&filter_by=brand&order_by=asc";

# Keep parameters matching either pattern
# Note: This requires multiple steps since globfilter_except only accepts one pattern
declare local var.temp1 STRING;
declare local var.temp2 STRING;

set var.temp1 = querystring.globfilter_except(var.original_qs, "id");
set var.temp2 = querystring.globfilter_except(var.original_qs, "sort_*");

# Combine the results (this is a simplified approach)
set var.result3 = var.temp1;

if (var.temp2 != "") {
  if (var.result3 != "") {
    set var.result3 = var.result3 + "&" + var.temp2;
  } else {
    set var.result3 = var.temp2;
  }
}

# var.result3 will contain parameters matching either pattern
log "Result 3: " + var.result3;
```

#### Keeping parameters with question mark wildcard

```vcl
declare local var.result4 STRING;

set var.original_qs = "p=1&page=1&pg=1&id=123&debug=true";
set var.result4 = querystring.globfilter_except(var.original_qs, "p?");

# var.result4 is now "pg=1"
# Note: Only parameter "pg" is kept (matches "p?" pattern)
log "Result 4: " + var.result4;
```

#### Practical application - keeping only essential parameters

```vcl
declare local var.essential_qs STRING;

# Keep only essential parameters
# Note: For multiple patterns, we need a more complex approach
declare local var.id_qs STRING;
declare local var.page_qs STRING;
declare local var.sort_qs STRING;

set var.id_qs = querystring.globfilter_except(req.url.qs, "id");
set var.page_qs = querystring.globfilter_except(req.url.qs, "page");
set var.sort_qs = querystring.globfilter_except(req.url.qs, "sort*");

# Combine the results (simplified approach)
set var.essential_qs = "";

if (var.id_qs != "") {
  set var.essential_qs = var.id_qs;
}

if (var.page_qs != "") {
  if (var.essential_qs != "") {
    set var.essential_qs = var.essential_qs + "&" + var.page_qs;
  } else {
    set var.essential_qs = var.page_qs;
  }
}

if (var.sort_qs != "") {
  if (var.essential_qs != "") {
    set var.essential_qs = var.essential_qs + "&" + var.sort_qs;
  } else {
    set var.essential_qs = var.sort_qs;
  }
}

# Update the request URL with the essential query string
if (var.essential_qs == "") {
  set req.url = req.url.path;
} else {
  set req.url = req.url.path + "?" + var.essential_qs;
}
```

## querystring.clean

Removes empty parameters from a query string.

### Syntax

```vcl
STRING querystring.clean(STRING query_string)
```

### Parameters

- `query_string`: The query string to clean

### Return Value

The cleaned query string with empty parameters removed

### Examples

#### Cleaning a query string with empty parameters

```vcl
declare local var.original_qs STRING;
declare local var.result1 STRING;

set var.original_qs = "id=123&empty=&blank=&valid=yes";
set var.result1 = querystring.clean(var.original_qs);

# var.result1 is now "id=123&valid=yes"
# Note: Parameters "empty" and "blank" are removed
log "Result 1: " + var.result1;
```

#### Cleaning a query string with no empty parameters

```vcl
declare local var.result2 STRING;

set var.original_qs = "id=123&category=electronics&sort=price";
set var.result2 = querystring.clean(var.original_qs);

# var.result2 is unchanged: "id=123&category=electronics&sort=price"
log "Result 2: " + var.result2;
```

#### Practical application - cleaning user-submitted query strings

```vcl
declare local var.cleaned_qs STRING;

# Clean the query string to remove empty parameters
set var.cleaned_qs = querystring.clean(req.url.qs);

# Update the request URL with the cleaned query string
if (var.cleaned_qs == "") {
  set req.url = req.url.path;
} else {
  set req.url = req.url.path + "?" + var.cleaned_qs;
}
```

## querystring.sort

Sorts the parameters in a query string alphabetically.

### Syntax

```vcl
STRING querystring.sort(STRING query_string)
```

### Parameters

- `query_string`: The query string to sort

### Return Value

The sorted query string

### Examples

#### Sorting a query string

```vcl
declare local var.original_qs STRING;
declare local var.result1 STRING;

set var.original_qs = "z=last&a=first&m=middle";
set var.result1 = querystring.sort(var.original_qs);

# var.result1 is now "a=first&m=middle&z=last"
# Note: Parameters are sorted alphabetically by name
log "Result 1: " + var.result1;
```

#### Sorting a query string with duplicate parameters

```vcl
declare local var.result2 STRING;

set var.original_qs = "tag=blue&id=123&tag=red";
set var.result2 = querystring.sort(var.original_qs);

# var.result2 is now "id=123&tag=blue&tag=red"
# Note: Duplicate parameters maintain their relative order
log "Result 2: " + var.result2;
```

#### Practical application - normalizing cache keys

```vcl
declare local var.cache_key STRING;

# Sort the query string to create a consistent cache key
set var.cache_key = querystring.sort(req.url.qs);

# Use the sorted query string as part of the cache key
set req.http.X-Cache-Key = req.url.path + "?" + var.cache_key;
```

## querystring.filtersep

Removes parameters with a specific separator from a query string.

### Syntax

```vcl
STRING querystring.filtersep(STRING query_string, STRING pattern, STRING separator)
```

### Parameters

- `query_string`: The query string to filter
- `pattern`: A regular expression pattern to match parameter names against
- `separator`: The separator character to use

### Return Value

The filtered query string with matching parameters removed

### Examples

#### Filtering parameters with a separator

```vcl
declare local var.original_qs STRING;
declare local var.result1 STRING;

set var.original_qs = "user.id=123&user.name=john&product.id=456";
set var.result1 = querystring.filtersep(var.original_qs, "^user", ".");

# var.result1 is now "product.id=456"
# Note: Parameters with prefix "user" and separator "." are removed
log "Result 1: " + var.result1;
```

#### Filtering with a different separator

```vcl
declare local var.result2 STRING;

set var.original_qs = "data[user]=john&data[product]=laptop&id=123";
set var.result2 = querystring.filtersep(var.original_qs, "^data", "[");

# var.result2 is now "id=123"
# Note: Parameters with prefix "data" and separator "[" are removed
log "Result 2: " + var.result2;
```

#### Practical application - filtering nested parameters

```vcl
declare local var.filtered_qs STRING;

# Filter out all nested user parameters
set var.filtered_qs = querystring.filtersep(req.url.qs, "^user", ".");

# Update the request URL with the filtered query string
if (var.filtered_qs == "") {
  set req.url = req.url.path;
} else {
  set req.url = req.url.path + "?" + var.filtered_qs;
}
```

## Integrated Example: Complete Query String Management System

This example demonstrates how multiple query string functions can work together to create a comprehensive query string management system.

```vcl
sub vcl_recv {
  # Step 1: Extract and normalize essential parameters
  
  # Get pagination parameters with defaults
  declare local var.page STRING;
  declare local var.limit STRING;
  
  set var.page = querystring.get(req.url.qs, "page");
  set var.limit = querystring.get(req.url.qs, "limit");
  
  # Set default values if missing or invalid
  if (var.page == "" || std.atoi(var.page) < 1) {
    set var.page = "1";
  }
  
  if (var.limit == "" || std.atoi(var.limit) < 1 || std.atoi(var.limit) > 100) {
    set var.limit = "20";
  }
  
  # Get sorting parameters
  declare local var.sort_field STRING;
  declare local var.sort_dir STRING;
  
  set var.sort_field = querystring.get(req.url.qs, "sort");
  set var.sort_dir = querystring.get(req.url.qs, "dir");
  
  # Set default values if missing or invalid
  if (var.sort_field == "") {
    set var.sort_field = "date";
  }
  
  if (var.sort_dir == "" || (var.sort_dir != "asc" && var.sort_dir != "desc")) {
    set var.sort_dir = "desc";
  }
  
  # Step 2: Clean the query string
  declare local var.cleaned_qs STRING;
  
  # Remove empty parameters
  set var.cleaned_qs = querystring.clean(req.url.qs);
  
  # Step 3: Remove tracking and debug parameters
  declare local var.tracking_pattern STRING;
  set var.tracking_pattern = "^utm_|^fb_|^ga_|^msclkid$|^fbclid$|^gclid$|^dclid$|^debug$|^test$";
  
  set var.cleaned_qs = querystring.filter(var.cleaned_qs, var.tracking_pattern);
  
  # Step 4: Keep only essential parameters for caching
  declare local var.cache_qs STRING;
  declare local var.essential_pattern STRING;
  
  set var.essential_pattern = "^(id|category|page|limit|sort|dir|q|filter)$";
  set var.cache_qs = querystring.filter_except(var.cleaned_qs, var.essential_pattern);
  
  # Step 5: Sort the parameters for consistent cache keys
  set var.cache_qs = querystring.sort(var.cache_qs);
  
  # Step 6: Set normalized parameters
  declare local var.normalized_qs STRING;
  
  set var.normalized_qs = var.cleaned_qs;
  set var.normalized_qs = querystring.set(var.normalized_qs, "page", var.page);
  set var.normalized_qs = querystring.set(var.normalized_qs, "limit", var.limit);
  set var.normalized_qs = querystring.set(var.normalized_qs, "sort", var.sort_field);
  set var.normalized_qs = querystring.set(var.normalized_qs, "dir", var.sort_dir);
  
  # Step 7: Update the request URL with the normalized query string
  if (var.normalized_qs == "") {
    set req.url = req.url.path;
  } else {
    set req.url = req.url.path + "?" + var.normalized_qs;
  }
  
  # Step 8: Set cache key based on essential parameters
  set req.http.X-Cache-Key = req.url.path + "?" + var.cache_qs;
  
  # Step 9: Store original and normalized query strings for debugging
  set req.http.X-Original-QueryString = req.url.qs;
  set req.http.X-Normalized-QueryString = var.normalized_qs;
  set req.http.X-Cache-QueryString = var.cache_qs;
}
```

## Best Practices for Query String Functions

1. Parameter Extraction:
   - Always check if parameters exist before using them
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
   - Use the most specific function for each task
   - Consider the performance impact of complex regex patterns

7. URL Normalization:
   - Normalize URLs for consistent behavior
   - Sort parameters for canonical URLs
   - Remove unnecessary parameters for cleaner URLs