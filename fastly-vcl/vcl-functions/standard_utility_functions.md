# Standard Utility Functions

This file demonstrates comprehensive examples of Standard Utility Functions in VCL.
These functions provide general-purpose utilities for string manipulation, type conversion,
and other common operations needed in VCL scripts.

## String Case Manipulation Functions

The following functions help manipulate the case of strings.

### std.tolower

Converts a string to lowercase.

#### Syntax

```vcl
STRING std.tolower(STRING string)
```

#### Parameters

- `string`: The string to convert to lowercase

#### Return Value

The input string converted to lowercase

### std.toupper

Converts a string to uppercase.

#### Syntax

```vcl
STRING std.toupper(STRING string)
```

#### Parameters

- `string`: The string to convert to uppercase

#### Return Value

The input string converted to uppercase

### std.strcasecmp

Compares two strings case-insensitively.

#### Syntax

```vcl
INTEGER std.strcasecmp(STRING string1, STRING string2)
```

#### Parameters

- `string1`: The first string to compare
- `string2`: The second string to compare

#### Return Value

- 0 if the strings are equal (ignoring case)
- Negative value if string1 is less than string2
- Positive value if string1 is greater than string2

#### Examples

##### Basic case conversion

```vcl
declare local var.original STRING;
declare local var.lowercase STRING;
declare local var.uppercase STRING;

set var.original = "Hello World";
set var.lowercase = std.tolower(var.original);
set var.uppercase = std.toupper(var.original);

# var.lowercase is now "hello world"
# var.uppercase is now "HELLO WORLD"
log "Original: " + var.original;
log "Lowercase: " + var.lowercase;
log "Uppercase: " + var.uppercase;
```

##### Case-insensitive header normalization

```vcl
declare local var.content_type STRING;
declare local var.normalized_content_type STRING;

# Get Content-Type header (might have inconsistent case)
set var.content_type = req.http.Content-Type;

# Normalize to lowercase for consistent processing
set var.normalized_content_type = std.tolower(var.content_type);

# Now we can do case-insensitive matching
if (var.normalized_content_type == "application/json") {
  set req.http.X-Content-Type = "JSON";
} else if (var.normalized_content_type == "text/html") {
  set req.http.X-Content-Type = "HTML";
}
##### Case-insensitive string comparison

```vcl
declare local var.string1 STRING;
declare local var.string2 STRING;
declare local var.comparison INTEGER;

set var.string1 = "example";
set var.string2 = "EXAMPLE";

# Compare strings case-insensitively
set var.comparison = std.strcasecmp(var.string1, var.string2);

# var.comparison will be 0 because the strings are equal when ignoring case
if (var.comparison == 0) {
  log "Strings are equal (case-insensitive)";
} else {
  log "Strings are different (case-insensitive)";
}
```

##### Case-insensitive URL path handling

```vcl
declare local var.path STRING;
declare local var.lowercase_path STRING;

set var.path = req.url.path;
set var.lowercase_path = std.tolower(var.path);

# Now we can do case-insensitive path matching
if (var.lowercase_path ~ "^/api/v1/") {
  set req.http.X-API-Version = "v1";
} else if (var.lowercase_path ~ "^/api/v2/") {
  set req.http.X-API-Version = "v2";
}
```

##### Normalizing query parameters

```vcl
declare local var.sort_param STRING;
declare local var.normalized_sort STRING;

# Get sort parameter from query string
set var.sort_param = querystring.get(req.url.qs, "sort");

# Normalize to lowercase
set var.normalized_sort = std.tolower(var.sort_param);

# Handle different sort options consistently
if (var.normalized_sort == "asc" || var.normalized_sort == "ascending") {
  set req.http.X-Sort-Order = "asc";
} else if (var.normalized_sort == "desc" || var.normalized_sort == "descending") {
  set req.http.X-Sort-Order = "desc";
} else {
  set req.http.X-Sort-Order = "default";
}
```

## String Search and Manipulation Functions

The following functions help search within strings and manipulate string content.

### std.strstr

Finds the first occurrence of a substring.

#### Syntax

```vcl
INTEGER std.strstr(STRING haystack, STRING needle)
```

#### Parameters

- `haystack`: The string to search in
- `needle`: The substring to search for

#### Return Value

- The 0-based index of the first occurrence of needle in haystack
- -1 if needle is not found in haystack

### std.prefixof

Checks if a string starts with a prefix.

#### Syntax

```vcl
BOOL std.prefixof(STRING prefix, STRING string)
```

#### Parameters

- `prefix`: The prefix to check for
- `string`: The string to check

#### Return Value

- TRUE if string starts with prefix
- FALSE otherwise

### std.suffixof

Checks if a string ends with a suffix.

#### Syntax

```vcl
BOOL std.suffixof(STRING suffix, STRING string)
```

#### Parameters

- `suffix`: The suffix to check for
- `string`: The string to check

#### Return Value

- TRUE if string ends with suffix
- FALSE otherwise
### std.replace

Replaces the first occurrence of a substring.

#### Syntax

```vcl
STRING std.replace(STRING string, STRING search, STRING replacement)
```

#### Parameters

- `string`: The string to modify
- `search`: The substring to search for
- `replacement`: The string to replace search with

#### Return Value

A new string with the first occurrence of search replaced by replacement

### std.replaceall

Replaces all occurrences of a substring.

#### Syntax

```vcl
STRING std.replaceall(STRING string, STRING search, STRING replacement)
```

#### Parameters

- `string`: The string to modify
- `search`: The substring to search for
- `replacement`: The string to replace search with

#### Return Value

A new string with all occurrences of search replaced by replacement

### std.replace_prefix

Replaces the prefix of a string.

#### Syntax

```vcl
STRING std.replace_prefix(STRING string, STRING prefix, STRING replacement)
```

#### Parameters

- `string`: The string to modify
- `prefix`: The prefix to replace
- `replacement`: The string to replace prefix with

#### Return Value

- A new string with prefix replaced by replacement if string starts with prefix
- The original string otherwise

### std.replace_suffix

Replaces the suffix of a string.

#### Syntax

```vcl
STRING std.replace_suffix(STRING string, STRING suffix, STRING replacement)
```

#### Parameters

- `string`: The string to modify
- `suffix`: The suffix to replace
- `replacement`: The string to replace suffix with

#### Return Value

- A new string with suffix replaced by replacement if string ends with suffix
- The original string otherwise

### std.strrev

Reverses a string.

#### Syntax

```vcl
STRING std.strrev(STRING string)
```

#### Parameters

- `string`: The string to reverse

#### Return Value

A new string with the characters in reverse order

### std.strpad

Pads a string to a specified length.

#### Syntax

```vcl
STRING std.strpad(STRING string, INTEGER length, STRING pad, STRING direction)
```

#### Parameters

- `string`: The string to pad
- `length`: The desired length of the result
- `pad`: The character(s) to use for padding
- `direction`: The direction to pad ("left", "right", or "both")

#### Return Value

A new string padded to the specified length

### std.strrep

Repeats a string a specified number of times.

#### Syntax

```vcl
STRING std.strrep(STRING string, INTEGER count)
```

#### Parameters

- `string`: The string to repeat
- `count`: The number of times to repeat the string

#### Return Value

A new string consisting of string repeated count times

#### Examples

##### Finding substrings

```vcl
declare local var.haystack STRING;
declare local var.needle STRING;
declare local var.position INTEGER;

set var.haystack = "This is a test string for demonstration";
set var.needle = "test";

# Find the position of "test" in the haystack
set var.position = std.strstr(var.haystack, var.needle);

# var.position is 10 (0-based index)
log "Position of '" + var.needle + "' in haystack: " + var.position;

# Check if needle was found
if (var.position >= 0) {
  log "Substring found at position " + var.position;
} else {
  log "Substring not found";
}
```

##### Checking prefixes and suffixes

```vcl
declare local var.url STRING;
declare local var.has_api_prefix BOOL;
declare local var.has_json_suffix BOOL;

set var.url = "/api/users.json";

# Check if URL starts with "/api/"
set var.has_api_prefix = std.prefixof("/api/", var.url);

# Check if URL ends with ".json"
set var.has_json_suffix = std.suffixof(".json", var.url);

if (var.has_api_prefix) {
  log "URL has API prefix";
}

if (var.has_json_suffix) {
  log "URL has JSON suffix";
}
```
##### Replacing substrings

```vcl
declare local var.original STRING;
declare local var.replaced_first STRING;
declare local var.replaced_all STRING;

set var.original = "The quick brown fox jumps over the lazy dog. The fox is quick.";

# Replace the first occurrence of "fox" with "cat"
set var.replaced_first = std.replace(var.original, "fox", "cat");

# Replace all occurrences of "fox" with "cat"
set var.replaced_all = std.replaceall(var.original, "fox", "cat");

log "Original: " + var.original;
log "Replaced first: " + var.replaced_first;
log "Replaced all: " + var.replaced_all;
```

##### Replacing prefixes and suffixes

```vcl
declare local var.path STRING;
declare local var.new_prefix_path STRING;
declare local var.new_suffix_path STRING;

set var.path = "/v1/api/users.json";

# Replace "/v1/api" prefix with "/v2/api"
set var.new_prefix_path = std.replace_prefix(var.path, "/v1/api", "/v2/api");

# Replace ".json" suffix with ".xml"
set var.new_suffix_path = std.replace_suffix(var.path, ".json", ".xml");

log "Original path: " + var.path;
log "New prefix path: " + var.new_prefix_path;
log "New suffix path: " + var.new_suffix_path;
```

##### String padding and repetition

```vcl
declare local var.short_string STRING;
declare local var.padded_left STRING;
declare local var.padded_right STRING;
declare local var.repeated STRING;

set var.short_string = "42";

# Pad left with zeros to length 5
set var.padded_left = std.strpad(var.short_string, 5, "0", "left");

# Pad right with spaces to length 10
set var.padded_right = std.strpad(var.short_string, 10, " ", "right");

# Repeat a string 3 times
set var.repeated = std.strrep("-=", 3);

log "Original: '" + var.short_string + "'";
log "Padded left: '" + var.padded_left + "'";
log "Padded right: '" + var.padded_right + "'";
log "Repeated: '" + var.repeated + "'";
```

##### String reversal

```vcl
declare local var.forward STRING;
declare local var.reversed STRING;

set var.forward = "abcdefg";
set var.reversed = std.strrev(var.forward);

# var.reversed is now "gfedcba"
log "Forward: " + var.forward;
log "Reversed: " + var.reversed;
```

## Type Conversion Functions

The following functions help convert between different data types.

### std.atoi

Converts a string to an integer.

#### Syntax

```vcl
INTEGER std.atoi(STRING string)
```

#### Parameters

- `string`: The string to convert to an integer

#### Return Value

The integer value of the string

### std.atof

Converts a string to a float.

#### Syntax

```vcl
FLOAT std.atof(STRING string)
```

#### Parameters

- `string`: The string to convert to a float

#### Return Value

The float value of the string

### std.strtol

Converts a string to a long integer with a specified base.

#### Syntax

```vcl
INTEGER std.strtol(STRING string, INTEGER base)
```

#### Parameters

- `string`: The string to convert
- `base`: The numeric base to use (e.g., 10 for decimal, 16 for hexadecimal)

#### Return Value

The integer value of the string in the specified base
### std.strtof

Converts a string to a float with additional control.

#### Syntax

```vcl
FLOAT std.strtof(STRING string)
```

#### Parameters

- `string`: The string to convert to a float

#### Return Value

The float value of the string

### std.itoa

Converts an integer to a string.

#### Syntax

```vcl
STRING std.itoa(INTEGER value)
```

#### Parameters

- `value`: The integer to convert

#### Return Value

The string representation of the integer

### std.itoa_charset

Converts an integer to a string using a custom character set.

#### Syntax

```vcl
STRING std.itoa_charset(INTEGER value, STRING charset)
```

#### Parameters

- `value`: The integer to convert
- `charset`: The character set to use for the conversion

#### Return Value

The string representation of the integer using the specified character set

### std.integer2time

Converts an integer to a time value.

#### Syntax

```vcl
TIME std.integer2time(INTEGER timestamp)
```

#### Parameters

- `timestamp`: The Unix timestamp (seconds since epoch)

#### Return Value

The corresponding TIME value

#### Examples

##### Basic string to number conversion

```vcl
declare local var.num_string STRING;
declare local var.num_int INTEGER;
declare local var.num_float FLOAT;

set var.num_string = "42";

# Convert string to integer
set var.num_int = std.atoi(var.num_string);

# Convert string to float
set var.num_float = std.atof(var.num_string);

# Now we can perform arithmetic operations
set var.num_int = var.num_int + 10;  # 52
set var.num_float = var.num_float * 1.5;  # 63.0

log "Integer: " + var.num_int;
log "Float: " + var.num_float;
```

##### Advanced string to number conversion

```vcl
declare local var.hex_string STRING;
declare local var.hex_value INTEGER;
declare local var.binary_string STRING;
declare local var.binary_value INTEGER;

set var.hex_string = "1A";
set var.binary_string = "1010";

# Convert hexadecimal string to integer (base 16)
set var.hex_value = std.strtol(var.hex_string, 16);

# Convert binary string to integer (base 2)
set var.binary_value = std.strtol(var.binary_string, 2);

# var.hex_value is 26 (decimal value of 1A in hex)
# var.binary_value is 10 (decimal value of 1010 in binary)
log "Hex value: " + var.hex_value;
log "Binary value: " + var.binary_value;
```

##### Number to string conversion

```vcl
declare local var.number INTEGER;
declare local var.number_string STRING;

set var.number = 42;

# Convert integer to string
set var.number_string = std.itoa(var.number);

# Now we can concatenate with other strings
set var.number_string = "The answer is " + var.number_string;

log var.number_string;
```

##### Custom base conversion

```vcl
declare local var.decimal INTEGER;
declare local var.base36 STRING;

set var.decimal = 12345;

# Convert to base 36 (0-9, a-z)
set var.base36 = std.itoa_charset(var.decimal, "0123456789abcdefghijklmnopqrstuvwxyz");

log "Decimal: " + var.decimal;
log "Base 36: " + var.base36;
```
##### Handling query parameters

```vcl
declare local var.page_param STRING;
declare local var.page INTEGER;
declare local var.limit_param STRING;
declare local var.limit INTEGER;

# Get pagination parameters from query string
set var.page_param = querystring.get(req.url.qs, "page");
set var.limit_param = querystring.get(req.url.qs, "limit");

# Convert to integers with default values
if (var.page_param == "") {
  set var.page = 1;  # Default page
} else {
  set var.page = std.atoi(var.page_param);
  # Ensure page is at least 1
  if (var.page < 1) {
    set var.page = 1;
  }
}

if (var.limit_param == "") {
  set var.limit = 20;  # Default limit
} else {
  set var.limit = std.atoi(var.limit_param);
  # Ensure limit is between 1 and 100
  if (var.limit < 1) {
    set var.limit = 1;
  } else if (var.limit > 100) {
    set var.limit = 100;
  }
}

# Set normalized pagination parameters
set req.http.X-Page = var.page;
set req.http.X-Limit = var.limit;
```

##### Time conversion

```vcl
declare local var.timestamp INTEGER;
declare local var.time TIME;

# Unix timestamp (seconds since epoch)
set var.timestamp = 1609459200;  # 2021-01-01 00:00:00 UTC

# Convert to TIME type
set var.time = std.integer2time(var.timestamp);

# Now we can use time functions
set req.http.X-Formatted-Time = strftime("%Y-%m-%d %H:%M:%S", var.time);
```

## IP Address Functions

The following functions help work with IP addresses.

### std.ip

Converts a string to an IP address.

#### Syntax

```vcl
IP std.ip(STRING string)
```

#### Parameters

- `string`: The string representation of an IP address

#### Return Value

The IP address object

### std.str2ip

Converts a string to an IPv4 address.

#### Syntax

```vcl
IP std.str2ip(STRING string)
```

#### Parameters

- `string`: The string representation of an IPv4 address

#### Return Value

The IPv4 address object

### std.anystr2ip

Converts a string to an IP address (IPv4 or IPv6).

#### Syntax

```vcl
IP std.anystr2ip(STRING string)
```

#### Parameters

- `string`: The string representation of an IP address (IPv4 or IPv6)

#### Return Value

The IP address object

### std.ip2str

Converts an IP address to a string.

#### Syntax

```vcl
STRING std.ip2str(IP ip)
```

#### Parameters

- `ip`: The IP address object

#### Return Value

The string representation of the IP address

#### Examples

##### String to IP conversion

```vcl
declare local var.ip_string STRING;
declare local var.ip_addr IP;

set var.ip_string = "192.168.1.1";

# Convert string to IP address
set var.ip_addr = std.ip(var.ip_string);

# Now we can use IP-specific operations
if (var.ip_addr ~ 192.168.0.0/16) {
  log "IP is in the 192.168.0.0/16 subnet";
}
```
##### Different IP conversion functions

```vcl
declare local var.ipv4_string STRING;
declare local var.ipv6_string STRING;
declare local var.ipv4_addr IP;
declare local var.ipv6_addr IP;

set var.ipv4_string = "10.0.0.1";
set var.ipv6_string = "2001:db8::1";

# Convert IPv4 string to IP
set var.ipv4_addr = std.str2ip(var.ipv4_string);

# Convert any IP string (IPv4 or IPv6) to IP
set var.ipv6_addr = std.anystr2ip(var.ipv6_string);

# Check IP versions
if (addr.is_ipv4(var.ipv4_addr)) {
  log var.ipv4_string + " is an IPv4 address";
}

if (addr.is_ipv6(var.ipv6_addr)) {
  log var.ipv6_string + " is an IPv6 address";
}
```

##### IP to string conversion

```vcl
declare local var.client_ip IP;
declare local var.client_ip_str STRING;

set var.client_ip = client.ip;

# Convert IP to string
set var.client_ip_str = std.ip2str(var.client_ip);

# Now we can use string operations
set req.http.X-Client-IP = var.client_ip_str;
```

##### IP address manipulation

```vcl
declare local var.original_ip STRING;
declare local var.ip_obj IP;
declare local var.modified_ip STRING;

set var.original_ip = "192.168.1.1";

# Convert to IP object
set var.ip_obj = std.ip(var.original_ip);

# Perform IP-specific operations
if (var.ip_obj ~ 192.168.1.0/24) {
  # Convert back to string
  set var.modified_ip = std.ip2str(var.ip_obj);
  set req.http.X-Internal-IP = var.modified_ip;
}
```

##### Working with X-Forwarded-For header

```vcl
declare local var.xff STRING;
declare local var.client_real_ip STRING;
declare local var.client_real_ip_obj IP;

# Get X-Forwarded-For header
set var.xff = req.http.X-Forwarded-For;

# Extract the original client IP (first IP in the list)
if (var.xff ~ "^([^,]+)") {
  set var.client_real_ip = re.group.1;
  
  # Convert to IP object for validation
  set var.client_real_ip_obj = std.anystr2ip(var.client_real_ip);
  
  # Check if it's a valid IP
  if (addr.is_ipv4(var.client_real_ip_obj) || addr.is_ipv6(var.client_real_ip_obj)) {
    set req.http.X-Real-Client-IP = var.client_real_ip;
  }
}
```

## Path Manipulation Functions

The following functions help work with file paths.

### std.basename

Gets the filename part of a path.

#### Syntax

```vcl
STRING std.basename(STRING path)
```

#### Parameters

- `path`: The file path

#### Return Value

The filename part of the path

### std.dirname

Gets the directory part of a path.

#### Syntax

```vcl
STRING std.dirname(STRING path)
```

#### Parameters

- `path`: The file path

#### Return Value

The directory part of the path

#### Examples

##### Basic path manipulation

```vcl
declare local var.full_path STRING;
declare local var.directory STRING;
declare local var.filename STRING;

set var.full_path = "/path/to/file.txt";

# Get directory part
set var.directory = std.dirname(var.full_path);

# Get filename part
set var.filename = std.basename(var.full_path);

# var.directory is "/path/to"
# var.filename is "file.txt"
log "Full path: " + var.full_path;
log "Directory: " + var.directory;
log "Filename: " + var.filename;
```
##### URL path manipulation

```vcl
declare local var.url_path STRING;
declare local var.url_dir STRING;
declare local var.url_file STRING;

set var.url_path = req.url.path;

# Get directory and file parts
set var.url_dir = std.dirname(var.url_path);
set var.url_file = std.basename(var.url_path);

# Set headers for debugging
set req.http.X-URL-Directory = var.url_dir;
set req.http.X-URL-Filename = var.url_file;
```

##### File extension extraction

```vcl
declare local var.filename STRING;
declare local var.extension STRING;

set var.filename = std.basename(req.url.path);

# Extract extension using regular expression
if (var.filename ~ "\.([^.]+)$") {
  set var.extension = re.group.1;
  set req.http.X-File-Extension = var.extension;
}
```

##### Content type based on file extension

```vcl
declare local var.content_type STRING;

# Set content type based on extension
if (var.extension == "jpg" || var.extension == "jpeg") {
  set var.content_type = "image/jpeg";
} else if (var.extension == "png") {
  set var.content_type = "image/png";
} else if (var.extension == "gif") {
  set var.content_type = "image/gif";
} else if (var.extension == "css") {
  set var.content_type = "text/css";
} else if (var.extension == "js") {
  set var.content_type = "application/javascript";
} else if (var.extension == "html" || var.extension == "htm") {
  set var.content_type = "text/html";
} else if (var.extension == "txt") {
  set var.content_type = "text/plain";
} else if (var.extension == "xml") {
  set var.content_type = "application/xml";
} else if (var.extension == "json") {
  set var.content_type = "application/json";
} else {
  set var.content_type = "application/octet-stream";
}

set req.http.X-Content-Type = var.content_type;
```

##### Path-based routing

```vcl
declare local var.path_directory STRING;

set var.path_directory = std.dirname(req.url.path);

# Route requests based on directory
if (var.path_directory == "/api") {
  set req.backend = F_api_backend;
} else if (var.path_directory == "/admin") {
  set req.backend = F_admin_backend;
} else if (var.path_directory ~ "^/static") {
  set req.backend = F_static_backend;
} else {
  set req.backend = F_default_backend;
}
```

## Collection and Counting Functions

The following functions help work with collections of values.

### std.collect

Collects multiple values into a string.

#### Syntax

```vcl
STRING std.collect(STRING value1, STRING value2, ...)
```

#### Parameters

- `value1`, `value2`, ...: The values to collect

#### Return Value

A comma-separated string containing all the values

### std.count

Counts the number of values in a string.

#### Syntax

```vcl
INTEGER std.count(STRING string)
```

#### Parameters

- `string`: The comma-separated string to count values in

#### Return Value

The number of values in the string

#### Examples

##### Collecting multiple values

```vcl
declare local var.values STRING;

# Collect multiple values into a single string
set var.values = std.collect("value1", "value2", "value3");

# var.values is now "value1,value2,value3"
log "Collected values: " + var.values;
```

##### Counting values in a string

```vcl
declare local var.count INTEGER;

# Count the number of values in the string
set var.count = std.count(var.values);

# var.count is 3
log "Number of values: " + var.count;
```

##### Collecting and counting header values

```vcl
declare local var.accept_header STRING;
declare local var.accept_count INTEGER;

# Get Accept header
set var.accept_header = req.http.Accept;

# Count the number of accepted content types
set var.accept_count = std.count(var.accept_header);

set req.http.X-Accept-Count = var.accept_count;
```

##### Building a list of values

```vcl
declare local var.tags STRING;

# Start with an empty list
set var.tags = "";

# Add tags based on conditions
if (req.url ~ "/api/") {
  set var.tags = std.collect(var.tags, "api");
}

if (req.method == "POST") {
  set var.tags = std.collect(var.tags, "write");
} else {
  set var.tags = std.collect(var.tags, "read");
}

if (req.http.Cookie:logged_in) {
  set var.tags = std.collect(var.tags, "authenticated");
}

# Set the tags in a header
set req.http.X-Request-Tags = var.tags;
```

##### Processing comma-separated values

```vcl
declare local var.csv_string STRING;
declare local var.item_count INTEGER;

set var.csv_string = "apple,banana,cherry,date";
set var.item_count = std.count(var.csv_string);

log "CSV string: " + var.csv_string;
log "Item count: " + var.item_count;
```

## Integrated Example: Complete String Processing System

This example demonstrates how multiple standard utility functions can work together to create a comprehensive string processing system.

```vcl
sub vcl_recv {
  # Step 1: Extract and normalize URL components
  declare local var.url_path STRING;
  declare local var.url_directory STRING;
  declare local var.url_filename STRING;
  declare local var.url_extension STRING;
  
  # Get URL path and normalize to lowercase
  set var.url_path = std.tolower(req.url.path);
  
  # Extract directory and filename
  set var.url_directory = std.dirname(var.url_path);
  set var.url_filename = std.basename(var.url_path);
  
  # Extract file extension if present
  if (var.url_filename ~ "\.([^.]+)$") {
    set var.url_extension = re.group.1;
  } else {
    set var.url_extension = "";
  }
  
  # Step 2: Process query parameters
  declare local var.page_param STRING;
  declare local var.limit_param STRING;
  declare local var.sort_param STRING;
  declare local var.page INTEGER;
  declare local var.limit INTEGER;
  
  # Get and normalize query parameters
  set var.page_param = querystring.get(req.url.qs, "page");
  set var.limit_param = querystring.get(req.url.qs, "limit");
  set var.sort_param = std.tolower(querystring.get(req.url.qs, "sort"));
  
  # Convert page and limit to integers with validation
  set var.page = var.page_param != "" ? std.atoi(var.page_param) : 1;
  set var.limit = var.limit_param != "" ? std.atoi(var.limit_param) : 20;
  
  # Validate and normalize values
  if (var.page < 1) { set var.page = 1; }
  if (var.limit < 1) { set var.limit = 1; }
  if (var.limit > 100) { set var.limit = 100; }
  
  # Step 3: Process client information
  declare local var.client_ip_str STRING;
  declare local var.xff STRING;
  declare local var.real_client_ip STRING;
  
  # Convert client IP to string
  set var.client_ip_str = std.ip2str(client.ip);
  
  # Process X-Forwarded-For header if present
  set var.xff = req.http.X-Forwarded-For;
  if (var.xff) {
    # Extract the original client IP (first IP in the list)
    if (var.xff ~ "^([^,]+)") {
      set var.real_client_ip = re.group.1;
    } else {
      set var.real_client_ip = var.client_ip_str;
    }
  } else {
    set var.real_client_ip = var.client_ip_str;
  }
  
  # Step 4: Build request tags for analytics
  declare local var.request_tags STRING;
  
  # Start with an empty list
  set var.request_tags = "";
  
  # Add tags based on request properties
  # Method type
  set var.request_tags = std.collect(var.request_tags, std.tolower(req.method));
  
  # Content type
  if (var.url_extension != "") {
    set var.request_tags = std.collect(var.request_tags, var.url_extension);
  }
  
  # API version
  if (var.url_directory ~ "^/api/v([0-9]+)") {
    set var.request_tags = std.collect(var.request_tags, "api-v" + re.group.1);
  } else if (var.url_directory ~ "^/api") {
    set var.request_tags = std.collect(var.request_tags, "api");
  }
  
  # Authentication status
  if (req.http.Cookie:session || req.http.Authorization) {
    set var.request_tags = std.collect(var.request_tags, "auth");
  } else {
    set var.request_tags = std.collect(var.request_tags, "anon");
  }
  
  # Step 5: Set normalized request headers
  set req.http.X-URL-Directory = var.url_directory;
  set req.http.X-URL-Filename = var.url_filename;
  set req.http.X-URL-Extension = var.url_extension;
  set req.http.X-Page = var.page;
  set req.http.X-Limit = var.limit;
  set req.http.X-Sort = var.sort_param;
  set req.http.X-Client-IP = var.client_ip_str;
  set req.http.X-Real-Client-IP = var.real_client_ip;
  set req.http.X-Request-Tags = var.request_tags;
  set req.http.X-Tag-Count = std.count(var.request_tags);
}
```

## Best Practices for Standard Utility Functions

1. String Case Handling:
   - Normalize strings to lowercase for case-insensitive comparisons
   - Use std.strcasecmp for direct case-insensitive comparisons
   - Be consistent with case normalization throughout your code

2. String Manipulation:
   - Use std.replace_prefix and std.replace_suffix for URL path manipulation
   - Use std.strpad for consistent formatting of numeric values
   - Consider performance implications of string operations on large strings

3. Type Conversion:
   - Always validate string inputs before conversion to numbers
   - Provide default values for missing or invalid parameters
   - Use appropriate base for std.strtol when parsing non-decimal values

4. IP Address Handling:
   - Convert between string and IP types as needed for different operations
   - Use std.anystr2ip for handling both IPv4 and IPv6 addresses
   - Validate IP addresses before using them in critical operations

5. Path Manipulation:
   - Use std.basename and std.dirname for consistent path handling
   - Extract file extensions for content type determination
   - Consider URL normalization for consistent caching and routing

6. Collection Handling:
   - Use std.collect to build comma-separated lists
   - Use std.count to determine the number of items in a list
   - Consider the performance impact of large collections

7. General Best Practices:
   - Normalize inputs early in the request flow
   - Use descriptive variable names for clarity
   - Add comments for complex operations
   - Group related operations together
   - Consider performance implications of complex operations