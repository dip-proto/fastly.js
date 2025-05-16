# UUID Functions

This file demonstrates comprehensive examples of UUID Functions in VCL.
These functions help generate and validate Universally Unique Identifiers (UUIDs)
for various use cases such as request tracking, content identification, and more.

## uuid.version4

Generates a random UUID (version 4).

### Syntax

```vcl
STRING uuid.version4()
```

### Parameters

None

### Return Value

A randomly generated UUID version 4 string

### Examples

#### Basic UUID generation

```vcl
declare local var.uuid STRING;

# Generate a random UUID
set var.uuid = uuid.version4();

# Log the generated UUID
log "Generated UUID: " + var.uuid;
```

#### Setting a request ID header

```vcl
declare local var.request_id STRING;

# Generate a UUID for request tracking
set var.request_id = uuid.version4();

# Set the request ID in a header
set req.http.X-Request-ID = var.request_id;
```

#### Generating multiple UUIDs

```vcl
declare local var.uuid1 STRING;
declare local var.uuid2 STRING;
declare local var.uuid3 STRING;

# Generate multiple UUIDs
set var.uuid1 = uuid.version4();
set var.uuid2 = uuid.version4();
set var.uuid3 = uuid.version4();

# Log the generated UUIDs
log "UUID 1: " + var.uuid1;
log "UUID 2: " + var.uuid2;
log "UUID 3: " + var.uuid3;
#### Creating a correlation ID for distributed tracing

```vcl
declare local var.correlation_id STRING;

# Check if a correlation ID already exists
if (req.http.X-Correlation-ID) {
  # Use the existing correlation ID
  set var.correlation_id = req.http.X-Correlation-ID;
} else {
  # Generate a new correlation ID
  set var.correlation_id = uuid.version4();
  set req.http.X-Correlation-ID = var.correlation_id;
}

# Log the correlation ID
log "Correlation ID: " + var.correlation_id;
```

#### Generating a cache key with UUID

```vcl
declare local var.cache_key STRING;

# Generate a UUID for the cache key
set var.cache_key = uuid.version4();

# Set the cache key in a header
set req.http.X-Cache-Key = var.cache_key;
```

## uuid.version3

Generates a name-based UUID (version 3) using MD5.

### Syntax

```vcl
STRING uuid.version3(STRING namespace, STRING name)
```

### Parameters

- `namespace`: The namespace UUID
- `name`: The name to generate the UUID from

### Return Value

A deterministic UUID version 3 string based on the namespace and name

### Examples

#### Basic name-based UUID generation

```vcl
declare local var.namespace STRING;
declare local var.name STRING;
declare local var.uuid STRING;

# Set namespace and name
set var.namespace = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";  # DNS namespace
set var.name = "example.com";

# Generate a name-based UUID
set var.uuid = uuid.version3(var.namespace, var.name);

# Log the generated UUID
log "Generated UUID v3: " + var.uuid;
```

#### Generating consistent UUIDs for the same input

```vcl
declare local var.name1 STRING;
declare local var.name2 STRING;
declare local var.uuid1 STRING;
declare local var.uuid2 STRING;

# Set different names
set var.name1 = "example.com";
set var.name2 = "example.com";

# Generate UUIDs for the same name
set var.uuid1 = uuid.version3(var.namespace, var.name1);
set var.uuid2 = uuid.version3(var.namespace, var.name2);

# Log the generated UUIDs (should be identical)
log "UUID 1: " + var.uuid1;
log "UUID 2: " + var.uuid2;
```
#### Generating UUIDs for different inputs

```vcl
declare local var.name3 STRING;
declare local var.uuid3 STRING;

# Set a different name
set var.name3 = "different.com";

# Generate a UUID for a different name
set var.uuid3 = uuid.version3(var.namespace, var.name3);

# Log the generated UUID (should be different from the previous ones)
log "UUID 3: " + var.uuid3;
```

#### Using a custom namespace

```vcl
declare local var.custom_namespace STRING;
declare local var.custom_uuid STRING;

# Set a custom namespace
set var.custom_namespace = uuid.version4();  # Generate a random namespace

# Generate a UUID with the custom namespace
set var.custom_uuid = uuid.version3(var.custom_namespace, var.name);

# Log the generated UUID
log "Custom namespace: " + var.custom_namespace;
log "Custom UUID: " + var.custom_uuid;
```

#### Generating a user-specific UUID

```vcl
declare local var.user_id STRING;
declare local var.user_uuid STRING;

# Get user ID from a cookie or header
set var.user_id = req.http.Cookie:user_id;

if (var.user_id) {
  # Generate a UUID for the user
  set var.user_uuid = uuid.version3(var.namespace, var.user_id);
  
  # Set the user UUID in a header
  set req.http.X-User-UUID = var.user_uuid;
}
```

## uuid.version5

Generates a name-based UUID (version 5) using SHA-1.

### Syntax

```vcl
STRING uuid.version5(STRING namespace, STRING name)
```

### Parameters

- `namespace`: The namespace UUID
- `name`: The name to generate the UUID from

### Return Value

A deterministic UUID version 5 string based on the namespace and name

### Examples

#### Basic name-based UUID generation with SHA-1

```vcl
declare local var.namespace STRING;
declare local var.name STRING;
declare local var.uuid STRING;

# Set namespace and name
set var.namespace = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";  # DNS namespace
set var.name = "example.com";

# Generate a name-based UUID using SHA-1
set var.uuid = uuid.version5(var.namespace, var.name);

# Log the generated UUID
log "Generated UUID v5: " + var.uuid;
```

#### Comparing version 3 (MD5) and version 5 (SHA-1) UUIDs

```vcl
declare local var.uuid_v3 STRING;
declare local var.uuid_v5 STRING;

# Generate both version 3 and version 5 UUIDs for the same input
set var.uuid_v3 = uuid.version3(var.namespace, var.name);
set var.uuid_v5 = uuid.version5(var.namespace, var.name);

# Log the generated UUIDs (should be different due to different hash algorithms)
log "UUID v3 (MD5): " + var.uuid_v3;
log "UUID v5 (SHA-1): " + var.uuid_v5;
```
#### Generating content identifiers

```vcl
declare local var.content_id STRING;
declare local var.content_url STRING;

# Set content URL
set var.content_url = req.url;

# Generate a content identifier
set var.content_id = uuid.version5(var.namespace, var.content_url);

# Set the content ID in a header
set req.http.X-Content-ID = var.content_id;
```

#### Generating UUIDs for different resources

```vcl
declare local var.resource1 STRING;
declare local var.resource2 STRING;
declare local var.uuid1 STRING;
declare local var.uuid2 STRING;

# Set different resources
set var.resource1 = "/api/users";
set var.resource2 = "/api/products";

# Generate UUIDs for different resources
set var.uuid1 = uuid.version5(var.namespace, var.resource1);
set var.uuid2 = uuid.version5(var.namespace, var.resource2);

# Log the generated UUIDs (should be different)
log "Resource 1 UUID: " + var.uuid1;
log "Resource 2 UUID: " + var.uuid2;
```

#### Generating a deterministic cache key

```vcl
declare local var.cache_key_base STRING;
declare local var.cache_key STRING;

# Set cache key base (e.g., URL + query parameters)
set var.cache_key_base = req.url + req.url.qs;

# Generate a deterministic cache key
set var.cache_key = uuid.version5(var.namespace, var.cache_key_base);

# Set the cache key in a header
set req.http.X-Cache-Key = var.cache_key;
```

## uuid.dns

Generates a name-based UUID (version 5) using the DNS namespace.

### Syntax

```vcl
STRING uuid.dns(STRING name)
```

### Parameters

- `name`: The name to generate the UUID from

### Return Value

A deterministic UUID version 5 string based on the DNS namespace and the provided name

### Examples

#### Basic DNS namespace UUID generation

```vcl
declare local var.domain STRING;
declare local var.uuid STRING;

# Set domain name
set var.domain = "example.com";

# Generate a UUID using the DNS namespace
set var.uuid = uuid.dns(var.domain);

# Log the generated UUID
log "DNS namespace UUID: " + var.uuid;
```

#### Generating UUIDs for different domains

```vcl
declare local var.domain1 STRING;
declare local var.domain2 STRING;
declare local var.uuid1 STRING;
declare local var.uuid2 STRING;

# Set different domains
set var.domain1 = "example.com";
set var.domain2 = "example.org";

# Generate UUIDs for different domains
set var.uuid1 = uuid.dns(var.domain1);
set var.uuid2 = uuid.dns(var.domain2);

# Log the generated UUIDs (should be different)
log "Domain 1 UUID: " + var.uuid1;
log "Domain 2 UUID: " + var.uuid2;
```
#### Generating UUIDs for subdomains

```vcl
declare local var.subdomain STRING;
declare local var.subdomain_uuid STRING;

# Set subdomain
set var.subdomain = "api.example.com";

# Generate a UUID for the subdomain
set var.subdomain_uuid = uuid.dns(var.subdomain);

# Log the generated UUID
log "Subdomain UUID: " + var.subdomain_uuid;
```

#### Using the host header as the domain

```vcl
declare local var.host STRING;
declare local var.host_uuid STRING;

# Get the host from the request
set var.host = req.http.Host;

# Generate a UUID for the host
set var.host_uuid = uuid.dns(var.host);

# Set the host UUID in a header
set req.http.X-Host-UUID = var.host_uuid;
```

#### Generating a service identifier

```vcl
declare local var.service_name STRING;
declare local var.service_uuid STRING;

# Set service name
set var.service_name = "auth.api.example.com";

# Generate a UUID for the service
set var.service_uuid = uuid.dns(var.service_name);

# Set the service UUID in a header
set req.http.X-Service-UUID = var.service_uuid;
```

## uuid.url

Generates a name-based UUID (version 5) using the URL namespace.

### Syntax

```vcl
STRING uuid.url(STRING name)
```

### Parameters

- `name`: The name to generate the UUID from

### Return Value

A deterministic UUID version 5 string based on the URL namespace and the provided name

### Examples

#### Basic URL namespace UUID generation

```vcl
declare local var.url STRING;
declare local var.uuid STRING;

# Set URL
set var.url = "https://example.com/path";

# Generate a UUID using the URL namespace
set var.uuid = uuid.url(var.url);

# Log the generated UUID
log "URL namespace UUID: " + var.uuid;
```

#### Generating UUIDs for different URLs

```vcl
declare local var.url1 STRING;
declare local var.url2 STRING;
declare local var.uuid1 STRING;
declare local var.uuid2 STRING;

# Set different URLs
set var.url1 = "https://example.com/path1";
set var.url2 = "https://example.com/path2";

# Generate UUIDs for different URLs
set var.uuid1 = uuid.url(var.url1);
set var.uuid2 = uuid.url(var.url2);

# Log the generated UUIDs (should be different)
log "URL 1 UUID: " + var.uuid1;
log "URL 2 UUID: " + var.uuid2;
```
#### Generating a UUID for the current request URL

```vcl
declare local var.request_url STRING;
declare local var.request_uuid STRING;

# Get the full request URL
set var.request_url = "https://" + req.http.Host + req.url;

# Generate a UUID for the request URL
set var.request_uuid = uuid.url(var.request_url);

# Set the request URL UUID in a header
set req.http.X-URL-UUID = var.request_uuid;
```

#### Generating content identifiers for different resources

```vcl
declare local var.resource_url1 STRING;
declare local var.resource_url2 STRING;
declare local var.resource_uuid1 STRING;
declare local var.resource_uuid2 STRING;

# Set different resource URLs
set var.resource_url1 = "https://example.com/api/users/123";
set var.resource_url2 = "https://example.com/api/products/456";

# Generate UUIDs for different resources
set var.resource_uuid1 = uuid.url(var.resource_url1);
set var.resource_uuid2 = uuid.url(var.resource_url2);

# Log the generated UUIDs
log "Resource 1 UUID: " + var.resource_uuid1;
log "Resource 2 UUID: " + var.resource_uuid2;
```

#### Generating a deterministic cache key for a URL

```vcl
declare local var.cache_url STRING;
declare local var.cache_key STRING;

# Set cache URL (full URL including query parameters)
set var.cache_url = "https://" + req.http.Host + req.url + "?" + req.url.qs;

# Generate a deterministic cache key
set var.cache_key = uuid.url(var.cache_url);

# Set the cache key in a header
set req.http.X-Cache-Key = var.cache_key;
```

## uuid.oid

Generates a name-based UUID (version 5) using the OID namespace.

### Syntax

```vcl
STRING uuid.oid(STRING name)
```

### Parameters

- `name`: The name to generate the UUID from

### Return Value

A deterministic UUID version 5 string based on the OID namespace and the provided name

### Examples

#### Basic OID namespace UUID generation

```vcl
declare local var.oid STRING;
declare local var.uuid STRING;

# Set OID
set var.oid = "1.3.6.1.4.1";  # Example OID

# Generate a UUID using the OID namespace
set var.uuid = uuid.oid(var.oid);

# Log the generated UUID
log "OID namespace UUID: " + var.uuid;
```

#### Generating UUIDs for different OIDs

```vcl
declare local var.oid1 STRING;
declare local var.oid2 STRING;
declare local var.uuid1 STRING;
declare local var.uuid2 STRING;

# Set different OIDs
set var.oid1 = "1.3.6.1.4.1.12345";
set var.oid2 = "1.3.6.1.4.1.67890";

# Generate UUIDs for different OIDs
set var.uuid1 = uuid.oid(var.oid1);
set var.uuid2 = uuid.oid(var.oid2);

# Log the generated UUIDs (should be different)
log "OID 1 UUID: " + var.uuid1;
log "OID 2 UUID: " + var.uuid2;
```
#### Generating UUIDs for enterprise-specific OIDs

```vcl
declare local var.enterprise_oid STRING;
declare local var.enterprise_uuid STRING;

# Set enterprise-specific OID
set var.enterprise_oid = "1.3.6.1.4.1.54321.1.2.3";

# Generate a UUID for the enterprise OID
set var.enterprise_uuid = uuid.oid(var.enterprise_oid);

# Log the generated UUID
log "Enterprise OID UUID: " + var.enterprise_uuid;
```

#### Using OID for service identification

```vcl
declare local var.service_oid STRING;
declare local var.service_uuid STRING;

# Set service OID
set var.service_oid = "1.3.6.1.4.1.54321.service.auth";

# Generate a UUID for the service OID
set var.service_uuid = uuid.oid(var.service_oid);

# Set the service UUID in a header
set req.http.X-Service-UUID = var.service_uuid;
```

#### Using OID for object identification

```vcl
declare local var.object_type STRING;
declare local var.object_id STRING;
declare local var.object_oid STRING;
declare local var.object_uuid STRING;

# Set object type and ID
set var.object_type = "user";
set var.object_id = "12345";

# Construct an OID for the object
set var.object_oid = "1.3.6.1.4.1.54321.object." + var.object_type + "." + var.object_id;

# Generate a UUID for the object OID
set var.object_uuid = uuid.oid(var.object_oid);

# Set the object UUID in a header
set req.http.X-Object-UUID = var.object_uuid;
```

## uuid.is_valid

Checks if a string is a valid UUID.

### Syntax

```vcl
BOOL uuid.is_valid(STRING uuid)
```

### Parameters

- `uuid`: The string to check

### Return Value

- TRUE if the string is a valid UUID
- FALSE otherwise

### Examples

#### Basic UUID validation

```vcl
declare local var.uuid STRING;
declare local var.is_valid BOOL;

# Set a UUID to validate
set var.uuid = "550e8400-e29b-41d4-a716-446655440000";

# Check if the UUID is valid
set var.is_valid = uuid.is_valid(var.uuid);

# Log the result
log "UUID: " + var.uuid;
log "Is valid: " + if(var.is_valid, "Yes", "No");
```

#### Validating a generated UUID

```vcl
declare local var.generated_uuid STRING;
declare local var.generated_is_valid BOOL;

# Generate a UUID
set var.generated_uuid = uuid.version4();

# Check if the generated UUID is valid
set var.generated_is_valid = uuid.is_valid(var.generated_uuid);

# Log the result
log "Generated UUID: " + var.generated_uuid;
log "Is valid: " + if(var.generated_is_valid, "Yes", "No");
```
#### Validating an invalid UUID

```vcl
declare local var.invalid_uuid STRING;
declare local var.invalid_is_valid BOOL;

# Set an invalid UUID
set var.invalid_uuid = "not-a-valid-uuid";

# Check if the invalid UUID is valid
set var.invalid_is_valid = uuid.is_valid(var.invalid_uuid);

# Log the result
log "Invalid UUID: " + var.invalid_uuid;
log "Is valid: " + if(var.invalid_is_valid, "Yes", "No");
```

#### Validating a UUID from a header

```vcl
declare local var.header_uuid STRING;
declare local var.header_is_valid BOOL;

# Get a UUID from a header
set var.header_uuid = req.http.X-Request-ID;

if (var.header_uuid) {
  # Check if the header UUID is valid
  set var.header_is_valid = uuid.is_valid(var.header_uuid);
  
  # Log the result
  log "Header UUID: " + var.header_uuid;
  log "Is valid: " + if(var.header_is_valid, "Yes", "No");
  
  # Set a validation header
  set req.http.X-UUID-Valid = if(var.header_is_valid, "true", "false");
}
```

#### Conditional logic based on UUID validity

```vcl
declare local var.input_uuid STRING;
declare local var.is_input_valid BOOL;

# Get an input UUID from a query parameter
set var.input_uuid = querystring.get(req.url.qs, "uuid");

if (var.input_uuid) {
  # Check if the input UUID is valid
  set var.is_input_valid = uuid.is_valid(var.input_uuid);
  
  if (var.is_input_valid) {
    # UUID is valid, proceed with the request
    set req.http.X-UUID-Status = "valid";
  } else {
    # UUID is invalid, return an error
    set req.http.X-UUID-Status = "invalid";
    error 400 "Invalid UUID";
  }
}
```

## uuid.is_version3

Checks if a string is a valid UUID version 3.

### Syntax

```vcl
BOOL uuid.is_version3(STRING uuid)
```

### Parameters

- `uuid`: The string to check

### Return Value

- TRUE if the string is a valid UUID version 3
- FALSE otherwise

### Examples

#### Basic UUID version 3 validation

```vcl
declare local var.uuid STRING;
declare local var.is_v3 BOOL;

# Set a UUID to validate
set var.uuid = "6fa459ea-ee8a-3ca4-894e-db77e160355e";  # Example UUID v3

# Check if the UUID is version 3
set var.is_v3 = uuid.is_version3(var.uuid);

# Log the result
log "UUID: " + var.uuid;
log "Is version 3: " + if(var.is_v3, "Yes", "No");
```

#### Validating a generated UUID version 3

```vcl
declare local var.namespace STRING;
declare local var.name STRING;
declare local var.generated_uuid STRING;
declare local var.generated_is_v3 BOOL;

# Set namespace and name
set var.namespace = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";  # DNS namespace
set var.name = "example.com";

# Generate a UUID version 3
set var.generated_uuid = uuid.version3(var.namespace, var.name);

# Check if the generated UUID is version 3
set var.generated_is_v3 = uuid.is_version3(var.generated_uuid);

# Log the result
log "Generated UUID: " + var.generated_uuid;
log "Is version 3: " + if(var.generated_is_v3, "Yes", "No");
```
#### Validating a UUID version 4 (should be false)

```vcl
declare local var.uuid_v4 STRING;
declare local var.is_v4_v3 BOOL;

# Generate a UUID version 4
set var.uuid_v4 = uuid.version4();

# Check if the UUID version 4 is version 3
set var.is_v4_v3 = uuid.is_version3(var.uuid_v4);

# Log the result
log "UUID v4: " + var.uuid_v4;
log "Is version 3: " + if(var.is_v4_v3, "Yes", "No");  # Should be "No"
```

#### Validating a UUID from a header

```vcl
declare local var.header_uuid STRING;
declare local var.header_is_v3 BOOL;

# Get a UUID from a header
set var.header_uuid = req.http.X-Request-ID;

if (var.header_uuid) {
  # Check if the header UUID is version 3
  set var.header_is_v3 = uuid.is_version3(var.header_uuid);
  
  # Log the result
  log "Header UUID: " + var.header_uuid;
  log "Is version 3: " + if(var.header_is_v3, "Yes", "No");
  
  # Set a validation header
  set req.http.X-UUID-Is-V3 = if(var.header_is_v3, "true", "false");
}
```

#### Checking multiple UUID versions

```vcl
declare local var.test_uuid STRING;
declare local var.is_valid BOOL;
declare local var.is_v3 BOOL;
declare local var.is_v4 BOOL;
declare local var.is_v5 BOOL;

# Set a UUID to test
set var.test_uuid = req.http.X-Test-UUID;

if (var.test_uuid) {
  # Check if the UUID is valid
  set var.is_valid = uuid.is_valid(var.test_uuid);
  
  if (var.is_valid) {
    # Check the UUID version
    set var.is_v3 = uuid.is_version3(var.test_uuid);
    set var.is_v4 = uuid.is_version4(var.test_uuid);
    set var.is_v5 = uuid.is_version5(var.test_uuid);
    
    # Set headers with the results
    set req.http.X-UUID-Valid = "true";
    set req.http.X-UUID-Version = 
      if(var.is_v3, "3", 
        if(var.is_v4, "4", 
          if(var.is_v5, "5", "unknown")));
  } else {
    set req.http.X-UUID-Valid = "false";
  }
}
```

## uuid.is_version4

Checks if a string is a valid UUID version 4.

### Syntax

```vcl
BOOL uuid.is_version4(STRING uuid)
```

### Parameters

- `uuid`: The string to check

### Return Value

- TRUE if the string is a valid UUID version 4
- FALSE otherwise

### Examples

#### Basic UUID version 4 validation

```vcl
declare local var.uuid STRING;
declare local var.is_v4 BOOL;

# Set a UUID to validate
set var.uuid = "550e8400-e29b-41d4-a716-446655440000";  # Example UUID v4

# Check if the UUID is version 4
set var.is_v4 = uuid.is_version4(var.uuid);

# Log the result
log "UUID: " + var.uuid;
log "Is version 4: " + if(var.is_v4, "Yes", "No");
```
#### Validating a generated UUID version 4

```vcl
declare local var.generated_uuid STRING;
declare local var.generated_is_v4 BOOL;

# Generate a UUID version 4
set var.generated_uuid = uuid.version4();

# Check if the generated UUID is version 4
set var.generated_is_v4 = uuid.is_version4(var.generated_uuid);

# Log the result
log "Generated UUID: " + var.generated_uuid;
log "Is version 4: " + if(var.generated_is_v4, "Yes", "No");
```

#### Validating a UUID version 3 (should be false)

```vcl
declare local var.namespace STRING;
declare local var.name STRING;
declare local var.uuid_v3 STRING;
declare local var.is_v3_v4 BOOL;

# Set namespace and name
set var.namespace = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";  # DNS namespace
set var.name = "example.com";

# Generate a UUID version 3
set var.uuid_v3 = uuid.version3(var.namespace, var.name);

# Check if the UUID version 3 is version 4
set var.is_v3_v4 = uuid.is_version4(var.uuid_v3);

# Log the result
log "UUID v3: " + var.uuid_v3;
log "Is version 4: " + if(var.is_v3_v4, "Yes", "No");  # Should be "No"
```

#### Validating a UUID from a header

```vcl
declare local var.header_uuid STRING;
declare local var.header_is_v4 BOOL;

# Get a UUID from a header
set var.header_uuid = req.http.X-Request-ID;

if (var.header_uuid) {
  # Check if the header UUID is version 4
  set var.header_is_v4 = uuid.is_version4(var.header_uuid);
  
  # Log the result
  log "Header UUID: " + var.header_uuid;
  log "Is version 4: " + if(var.header_is_v4, "Yes", "No");
  
  # Set a validation header
  set req.http.X-UUID-Is-V4 = if(var.header_is_v4, "true", "false");
}
```

#### Validating multiple UUIDs

```vcl
declare local var.uuid1 STRING;
declare local var.uuid2 STRING;
declare local var.uuid3 STRING;
declare local var.is_v4_1 BOOL;
declare local var.is_v4_2 BOOL;
declare local var.is_v4_3 BOOL;

# Generate multiple UUIDs
set var.uuid1 = uuid.version4();
set var.uuid2 = uuid.version4();
set var.uuid3 = uuid.version4();

# Check if all UUIDs are version 4
set var.is_v4_1 = uuid.is_version4(var.uuid1);
set var.is_v4_2 = uuid.is_version4(var.uuid2);
set var.is_v4_3 = uuid.is_version4(var.uuid3);

# Log the results
log "UUID 1: " + var.uuid1 + " is v4: " + if(var.is_v4_1, "Yes", "No");
log "UUID 2: " + var.uuid2 + " is v4: " + if(var.is_v4_2, "Yes", "No");
log "UUID 3: " + var.uuid3 + " is v4: " + if(var.is_v4_3, "Yes", "No");
```

## uuid.is_version5

Checks if a string is a valid UUID version 5.

### Syntax

```vcl
BOOL uuid.is_version5(STRING uuid)
```

### Parameters

- `uuid`: The string to check

### Return Value

- TRUE if the string is a valid UUID version 5
- FALSE otherwise

### Examples

#### Basic UUID version 5 validation

```vcl
declare local var.uuid STRING;
declare local var.is_v5 BOOL;

# Set a UUID to validate
set var.uuid = "886313e1-3b8a-5372-9b90-0c9aee199e5d";  # Example UUID v5

# Check if the UUID is version 5
set var.is_v5 = uuid.is_version5(var.uuid);

# Log the result
log "UUID: " + var.uuid;
log "Is version 5: " + if(var.is_v5, "Yes", "No");
```
#### Validating a generated UUID version 5

```vcl
declare local var.namespace STRING;
declare local var.name STRING;
declare local var.generated_uuid STRING;
declare local var.generated_is_v5 BOOL;

# Set namespace and name
set var.namespace = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";  # DNS namespace
set var.name = "example.com";

# Generate a UUID version 5
set var.generated_uuid = uuid.version5(var.namespace, var.name);

# Check if the generated UUID is version 5
set var.generated_is_v5 = uuid.is_version5(var.generated_uuid);

# Log the result
log "Generated UUID: " + var.generated_uuid;
log "Is version 5: " + if(var.generated_is_v5, "Yes", "No");
```

#### Validating a UUID version 4 (should be false)

```vcl
declare local var.uuid_v4 STRING;
declare local var.is_v4_v5 BOOL;

# Generate a UUID version 4
set var.uuid_v4 = uuid.version4();

# Check if the UUID version 4 is version 5
set var.is_v4_v5 = uuid.is_version5(var.uuid_v4);

# Log the result
log "UUID v4: " + var.uuid_v4;
log "Is version 5: " + if(var.is_v4_v5, "Yes", "No");  # Should be "No"
```

#### Validating a UUID from a header

```vcl
declare local var.header_uuid STRING;
declare local var.header_is_v5 BOOL;

# Get a UUID from a header
set var.header_uuid = req.http.X-Request-ID;

if (var.header_uuid) {
  # Check if the header UUID is version 5
  set var.header_is_v5 = uuid.is_version5(var.header_uuid);
  
  # Log the result
  log "Header UUID: " + var.header_uuid;
  log "Is version 5: " + if(var.header_is_v5, "Yes", "No");
  
  # Set a validation header
  set req.http.X-UUID-Is-V5 = if(var.header_is_v5, "true", "false");
}
```

#### Validating different namespace UUIDs

```vcl
declare local var.dns_uuid STRING;
declare local var.url_uuid STRING;
declare local var.oid_uuid STRING;
declare local var.is_dns_v5 BOOL;
declare local var.is_url_v5 BOOL;
declare local var.is_oid_v5 BOOL;

# Generate UUIDs with different namespaces
set var.dns_uuid = uuid.dns("example.com");
set var.url_uuid = uuid.url("https://example.com");
set var.oid_uuid = uuid.oid("1.3.6.1.4.1");

# Check if all UUIDs are version 5
set var.is_dns_v5 = uuid.is_version5(var.dns_uuid);
set var.is_url_v5 = uuid.is_version5(var.url_uuid);
set var.is_oid_v5 = uuid.is_version5(var.oid_uuid);

# Log the results
log "DNS UUID: " + var.dns_uuid + " is v5: " + if(var.is_dns_v5, "Yes", "No");
log "URL UUID: " + var.url_uuid + " is v5: " + if(var.is_url_v5, "Yes", "No");
log "OID UUID: " + var.oid_uuid + " is v5: " + if(var.is_oid_v5, "Yes", "No");
```

## Integrated Example: Complete UUID Management System

This example demonstrates how multiple UUID functions can work together to create a comprehensive UUID management system.

```vcl
sub vcl_recv {
  # Step 1: Generate or retrieve request ID
  declare local var.request_id STRING;
  
  # Check if a request ID already exists
  if (req.http.X-Request-ID) {
    # Use the existing request ID
    set var.request_id = req.http.X-Request-ID;
    
    # Validate the request ID
    declare local var.is_valid_request_id BOOL;
    set var.is_valid_request_id = uuid.is_valid(var.request_id);
    
    if (!var.is_valid_request_id) {
      # Invalid request ID, generate a new one
      set var.request_id = uuid.version4();
      set req.http.X-Request-ID = var.request_id;
      set req.http.X-Request-ID-Source = "generated-invalid";
    } else {
      set req.http.X-Request-ID-Source = "client";
    }
  } else {
    # Generate a new request ID
    set var.request_id = uuid.version4();
    set req.http.X-Request-ID = var.request_id;
    set req.http.X-Request-ID-Source = "generated-missing";
  }
  
  # Step 2: Generate correlation ID for distributed tracing
  declare local var.correlation_id STRING;
  
  # Check if a correlation ID already exists
  if (req.http.X-Correlation-ID) {
    # Use the existing correlation ID
    set var.correlation_id = req.http.X-Correlation-ID;
  } else {
    # Generate a new correlation ID
    set var.correlation_id = uuid.version4();
    set req.http.X-Correlation-ID = var.correlation_id;
  }
  
  # Step 3: Generate content identifiers
  declare local var.content_namespace STRING;
  declare local var.content_id STRING;
  
  # Set content namespace (using DNS namespace)
  set var.content_namespace = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";
  
  # Generate a content identifier based on URL
  set var.content_id = uuid.version5(var.content_namespace, req.url);
  
  # Set the content ID in a header
  set req.http.X-Content-ID = var.content_id;
  
  # Step 4: Generate service identifiers
  declare local var.service_id STRING;
  declare local var.host STRING;
  
  # Get the host from the request
  set var.host = req.http.Host;
  
  # Generate a service identifier based on host
  set var.service_id = uuid.dns(var.host);
  
  # Set the service ID in a header
  set req.http.X-Service-ID = var.service_id;
  
  # Step 5: Generate cache keys
  declare local var.cache_key_base STRING;
  declare local var.cache_key STRING;
  
  # Set cache key base (URL + query parameters)
  set var.cache_key_base = req.url;
  if (req.url.qs) {
    set var.cache_key_base = var.cache_key_base + "?" + req.url.qs;
  }
  
  # Generate a deterministic cache key
  set var.cache_key = uuid.version5(var.content_namespace, var.cache_key_base);
  
  # Set the cache key in a header
  set req.http.X-Cache-Key = var.cache_key;
  
  # Step 6: Determine UUID versions
  declare local var.request_id_version STRING;
  
  # Check the version of the request ID
  if (uuid.is_version3(var.request_id)) {
    set var.request_id_version = "3";
  } else if (uuid.is_version4(var.request_id)) {
    set var.request_id_version = "4";
  } else if (uuid.is_version5(var.request_id)) {
    set var.request_id_version = "5";
  } else {
    set var.request_id_version = "unknown";
  }
  
  # Set the request ID version in a header
  set req.http.X-Request-ID-Version = var.request_id_version;
}
```

## Best Practices for UUID Functions

1. UUID Generation:
   - Use uuid.version4() for random UUIDs (e.g., request IDs, correlation IDs)
   - Use uuid.version5() for deterministic UUIDs (e.g., content IDs, cache keys)
   - Use uuid.dns(), uuid.url(), or uuid.oid() for namespace-specific UUIDs

2. UUID Validation:
   - Always validate UUIDs received from external sources
   - Use uuid.is_valid() to check if a string is a valid UUID
   - Use uuid.is_version3(), uuid.is_version4(), or uuid.is_version5() to check specific versions

3. UUID Storage:
   - Store UUIDs as strings in VCL variables
   - Use headers to pass UUIDs between services
   - Consider using UUIDs in log messages for correlation

4. UUID Namespaces:
   - Use standard namespaces when possible (DNS, URL, OID)
   - Create custom namespaces for specific use cases
   - Document the namespaces used in your code

5. UUID Use Cases:
   - Request tracking: Use uuid.version4() for unique request IDs
   - Content identification: Use uuid.version5() for deterministic content IDs
   - Distributed tracing: Use uuid.version4() for correlation IDs
   - Caching: Use uuid.version5() for deterministic cache keys
   - Service identification: Use uuid.dns() for service IDs