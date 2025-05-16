# Digest Functions

This file demonstrates comprehensive examples of Digest Functions in VCL.
These functions help with cryptographic operations, hashing, encoding,
and message authentication.

## FUNCTION GROUP: BASIC HASH FUNCTIONS

The following functions generate cryptographic hashes from input strings:
- digest.hash_md5: Generates an MD5 hash of the input string
- digest.hash_sha1: Generates a SHA-1 hash of the input string
- digest.hash_sha256: Generates a SHA-256 hash of the input string
- digest.hash_sha512: Generates a SHA-512 hash of the input string
- digest.hash_xxh32: Generates a 32-bit xxHash of the input string
- digest.hash_xxh64: Generates a 64-bit xxHash of the input string

### FUNCTION: digest.hash_md5

PURPOSE: Generates an MD5 hash of the input string
SYNTAX: digest.hash_md5(STRING input)

PARAMETERS:
- input: The string to hash

RETURN VALUE: The MD5 hash of the input string

### FUNCTION: digest.hash_sha1

PURPOSE: Generates a SHA-1 hash of the input string
SYNTAX: digest.hash_sha1(STRING input)

PARAMETERS:
- input: The string to hash

RETURN VALUE: The SHA-1 hash of the input string

### FUNCTION: digest.hash_sha256

PURPOSE: Generates a SHA-256 hash of the input string
SYNTAX: digest.hash_sha256(STRING input)

PARAMETERS:
- input: The string to hash

RETURN VALUE: The SHA-256 hash of the input string

### FUNCTION: digest.hash_sha512

PURPOSE: Generates a SHA-512 hash of the input string
SYNTAX: digest.hash_sha512(STRING input)

PARAMETERS:
- input: The string to hash

RETURN VALUE: The SHA-512 hash of the input string

### FUNCTION: digest.hash_xxh32

PURPOSE: Generates a 32-bit xxHash of the input string
SYNTAX: digest.hash_xxh32(STRING input)

PARAMETERS:
- input: The string to hash

RETURN VALUE: The 32-bit xxHash of the input string

### FUNCTION: digest.hash_xxh64

PURPOSE: Generates a 64-bit xxHash of the input string
SYNTAX: digest.hash_xxh64(STRING input)

PARAMETERS:
- input: The string to hash

RETURN VALUE: The 64-bit xxHash of the input string

### Examples

#### Basic hashing with different algorithms

```vcl
declare local var.input STRING;
declare local var.hash_md5 STRING;
declare local var.hash_sha1 STRING;
declare local var.hash_sha256 STRING;
declare local var.hash_sha512 STRING;

set var.input = "Fastly VCL Example";

# Generate hashes using different algorithms
set var.hash_md5 = digest.hash_md5(var.input);
set var.hash_sha1 = digest.hash_sha1(var.input);
set var.hash_sha256 = digest.hash_sha256(var.input);
set var.hash_sha512 = digest.hash_sha512(var.input);

# Set headers with the hash values for demonstration
set req.http.X-Hash-MD5 = var.hash_md5;
set req.http.X-Hash-SHA1 = var.hash_sha1;
set req.http.X-Hash-SHA256 = var.hash_sha256;
set req.http.X-Hash-SHA512 = var.hash_sha512;
```

#### Content integrity verification

This example demonstrates how to verify the integrity of content:

```vcl
declare local var.content STRING;
declare local var.expected_hash STRING;
declare local var.actual_hash STRING;
declare local var.is_valid BOOL;

set var.content = req.http.X-Content;
set var.expected_hash = req.http.X-Content-SHA256;

# Calculate the actual hash
set var.actual_hash = digest.hash_sha256(var.content);

# Compare the hashes using secure comparison
set var.is_valid = digest.secure_is_equal(var.actual_hash, var.expected_hash);

if (var.is_valid) {
  set req.http.X-Content-Valid = "true";
} else {
  set req.http.X-Content-Valid = "false";
  # Potentially reject the request or take other action
  # error 400 "Content integrity check failed";
}
```

#### Fast non-cryptographic hashing with xxHash

xxHash is useful for checksums and hash tables where cryptographic properties are not required:

```vcl
declare local var.data STRING;
declare local var.xxh32_hash STRING;
declare local var.xxh64_hash STRING;

set var.data = req.url + req.http.Host;

# Generate xxHash values
set var.xxh32_hash = digest.hash_xxh32(var.data);
set var.xxh64_hash = digest.hash_xxh64(var.data);

# Use for load balancing or consistent hashing
set req.http.X-Shard-Key = var.xxh64_hash;
## FUNCTION GROUP: HMAC FUNCTIONS

The following functions provide a way to verify both the data integrity and the authenticity of a message:
- digest.hmac_md5: Generates an HMAC using MD5
- digest.hmac_sha1: Generates an HMAC using SHA-1
- digest.hmac_sha256: Generates an HMAC using SHA-256
- digest.hmac_sha512: Generates an HMAC using SHA-512
- digest.hmac_md5_base64: Generates a base64-encoded HMAC using MD5
- digest.hmac_sha1_base64: Generates a base64-encoded HMAC using SHA-1
- digest.hmac_sha256_base64: Generates a base64-encoded HMAC using SHA-256
- digest.hmac_sha512_base64: Generates a base64-encoded HMAC using SHA-512

### FUNCTION: digest.hmac_md5

PURPOSE: Generates an HMAC using MD5
SYNTAX: digest.hmac_md5(STRING key, STRING input)

PARAMETERS:
- key: The secret key
- input: The message to authenticate

RETURN VALUE: The HMAC-MD5 of the input message

### FUNCTION: digest.hmac_sha1

PURPOSE: Generates an HMAC using SHA-1
SYNTAX: digest.hmac_sha1(STRING key, STRING input)

PARAMETERS:
- key: The secret key
- input: The message to authenticate

RETURN VALUE: The HMAC-SHA1 of the input message

### FUNCTION: digest.hmac_sha256

PURPOSE: Generates an HMAC using SHA-256
SYNTAX: digest.hmac_sha256(STRING key, STRING input)

PARAMETERS:
- key: The secret key
- input: The message to authenticate

RETURN VALUE: The HMAC-SHA256 of the input message

### FUNCTION: digest.hmac_sha512

PURPOSE: Generates an HMAC using SHA-512
SYNTAX: digest.hmac_sha512(STRING key, STRING input)

PARAMETERS:
- key: The secret key
- input: The message to authenticate

RETURN VALUE: The HMAC-SHA512 of the input message

### FUNCTION: digest.hmac_md5_base64

PURPOSE: Generates a base64-encoded HMAC using MD5
SYNTAX: digest.hmac_md5_base64(STRING key, STRING input)

PARAMETERS:
- key: The secret key
- input: The message to authenticate

RETURN VALUE: The base64-encoded HMAC-MD5 of the input message

### FUNCTION: digest.hmac_sha1_base64

PURPOSE: Generates a base64-encoded HMAC using SHA-1
SYNTAX: digest.hmac_sha1_base64(STRING key, STRING input)

PARAMETERS:
- key: The secret key
- input: The message to authenticate

RETURN VALUE: The base64-encoded HMAC-SHA1 of the input message

### FUNCTION: digest.hmac_sha256_base64

PURPOSE: Generates a base64-encoded HMAC using SHA-256
SYNTAX: digest.hmac_sha256_base64(STRING key, STRING input)

PARAMETERS:
- key: The secret key
- input: The message to authenticate

RETURN VALUE: The base64-encoded HMAC-SHA256 of the input message

### FUNCTION: digest.hmac_sha512_base64

PURPOSE: Generates a base64-encoded HMAC using SHA-512
SYNTAX: digest.hmac_sha512_base64(STRING key, STRING input)

PARAMETERS:
- key: The secret key
- input: The message to authenticate

RETURN VALUE: The base64-encoded HMAC-SHA512 of the input message

### Examples

#### Basic HMAC generation

```vcl
declare local var.message STRING;
declare local var.key STRING;
declare local var.hmac_md5 STRING;
declare local var.hmac_sha1 STRING;
declare local var.hmac_sha256 STRING;

set var.message = "Message to authenticate";
set var.key = "SecretKey123";

# Generate HMACs using different algorithms
set var.hmac_md5 = digest.hmac_md5(var.key, var.message);
set var.hmac_sha1 = digest.hmac_sha1(var.key, var.message);
set var.hmac_sha256 = digest.hmac_sha256(var.key, var.message);

# Set headers with the HMAC values
set req.http.X-HMAC-MD5 = var.hmac_md5;
set req.http.X-HMAC-SHA1 = var.hmac_sha1;
set req.http.X-HMAC-SHA256 = var.hmac_sha256;
```

#### Request authentication with HMAC

This example demonstrates how to authenticate API requests using HMAC:

```vcl
declare local var.request_path STRING;
declare local var.request_timestamp STRING;
declare local var.request_body STRING;
declare local var.api_key STRING;
declare local var.expected_signature STRING;
declare local var.calculated_signature STRING;

# Get request details
set var.request_path = req.url.path;
set var.request_timestamp = req.http.X-Timestamp;
set var.request_body = req.body;
set var.api_key = table.lookup(my_api_keys, req.http.X-API-Key-ID);
set var.expected_signature = req.http.X-Signature;

# Create the string to sign
declare local var.string_to_sign STRING;
set var.string_to_sign = var.request_path + var.request_timestamp + var.request_body;

# Calculate the signature
set var.calculated_signature = digest.hmac_sha256(var.api_key, var.string_to_sign);

# Verify the signature
if (digest.secure_is_equal(var.calculated_signature, var.expected_signature)) {
  # Signature is valid
  set req.http.X-Auth-Valid = "true";
} else {
  # Signature is invalid
  set req.http.X-Auth-Valid = "false";
  error 401 "Invalid signature";
}
```

#### HMAC with base64 encoding

This example demonstrates how to generate base64-encoded HMACs:

```vcl
declare local var.hmac_sha256_base64 STRING;
declare local var.hmac_sha512_base64 STRING;

set var.hmac_sha256_base64 = digest.hmac_sha256_base64(var.key, var.message);
set var.hmac_sha512_base64 = digest.hmac_sha512_base64(var.key, var.message);

# Base64-encoded HMACs are often used in HTTP headers
set req.http.X-HMAC-SHA256-Base64 = var.hmac_sha256_base64;
set req.http.X-HMAC-SHA512-Base64 = var.hmac_sha512_base64;
```

## FUNCTION GROUP: BASE64 ENCODING AND DECODING

The following functions help with Base64 encoding and decoding:
- digest.base64: Encodes a string using standard Base64
- digest.base64_decode: Decodes a standard Base64-encoded string
- digest.base64url: Encodes a string using URL-safe Base64
- digest.base64url_decode: Decodes a URL-safe Base64-encoded string
- digest.base64url_nopad: Encodes a string using URL-safe Base64 without padding
- digest.base64url_nopad_decode: Decodes a URL-safe Base64-encoded string without padding

### FUNCTION: digest.base64

PURPOSE: Encodes a string using standard Base64
SYNTAX: digest.base64(STRING input)

PARAMETERS:
- input: The string to encode

RETURN VALUE: The Base64-encoded string

### FUNCTION: digest.base64_decode

PURPOSE: Decodes a standard Base64-encoded string
SYNTAX: digest.base64_decode(STRING input)

PARAMETERS:
- input: The Base64-encoded string to decode

RETURN VALUE: The decoded string

### FUNCTION: digest.base64url

PURPOSE: Encodes a string using URL-safe Base64
SYNTAX: digest.base64url(STRING input)

PARAMETERS:
- input: The string to encode

RETURN VALUE: The URL-safe Base64-encoded string

### FUNCTION: digest.base64url_decode

PURPOSE: Decodes a URL-safe Base64-encoded string
SYNTAX: digest.base64url_decode(STRING input)

PARAMETERS:
- input: The URL-safe Base64-encoded string to decode

RETURN VALUE: The decoded string

### FUNCTION: digest.base64url_nopad

PURPOSE: Encodes a string using URL-safe Base64 without padding
SYNTAX: digest.base64url_nopad(STRING input)

PARAMETERS:
- input: The string to encode

RETURN VALUE: The URL-safe Base64-encoded string without padding

### FUNCTION: digest.base64url_nopad_decode

PURPOSE: Decodes a URL-safe Base64-encoded string without padding
SYNTAX: digest.base64url_nopad_decode(STRING input)

PARAMETERS:
- input: The URL-safe Base64-encoded string without padding to decode

RETURN VALUE: The decoded string

### Examples

#### Basic Base64 encoding and decoding

```vcl
declare local var.original STRING;
declare local var.encoded STRING;
declare local var.decoded STRING;

set var.original = "Hello, Base64!";

# Encode to Base64
set var.encoded = digest.base64(var.original);

# Decode from Base64
set var.decoded = digest.base64_decode(var.encoded);

# Verify round-trip encoding/decoding
if (var.original == var.decoded) {
  set req.http.X-Base64-Valid = "true";
}
```

#### URL-safe Base64 encoding and decoding

Standard Base64 uses +, /, and = characters which can be problematic in URLs:

```vcl
declare local var.url_data STRING;
declare local var.url_safe_encoded STRING;
declare local var.url_safe_decoded STRING;

set var.url_data = "Data+With/Special=Characters";

# Encode using URL-safe Base64
set var.url_safe_encoded = digest.base64url(var.url_data);

# Decode URL-safe Base64
set var.url_safe_decoded = digest.base64url_decode(var.url_safe_encoded);

# URL-safe Base64 replaces + with -, / with _, and often omits padding =
set req.http.X-Base64URL-Encoded = var.url_safe_encoded;
```

#### Base64 without padding

Some applications require Base64 without the padding = characters:

```vcl
declare local var.nopad_encoded STRING;
declare local var.nopad_decoded STRING;

# Encode using Base64URL without padding
set var.nopad_encoded = digest.base64url_nopad(var.url_data);

# Decode Base64URL without padding
set var.nopad_decoded = digest.base64url_nopad_decode(var.nopad_encoded);

# Verify the encoding/decoding worked
if (var.url_data == var.nopad_decoded) {
  set req.http.X-Base64URL-Nopad-Valid = "true";
}
```
## FUNCTION GROUP: AWS SIGNATURE FUNCTIONS

The following functions help with AWS request signing, particularly for AWS Signature Version 4:
- digest.awsv4_hmac: Generates an AWS Signature Version 4 HMAC

### FUNCTION: digest.awsv4_hmac

PURPOSE: Generates an AWS Signature Version 4 HMAC
SYNTAX: digest.awsv4_hmac(STRING secret_key, STRING date, STRING region, STRING service, STRING string_to_sign)

PARAMETERS:
- secret_key: The AWS secret key
- date: The date in YYYYMMDD format
- region: The AWS region
- service: The AWS service
- string_to_sign: The string to sign

RETURN VALUE: The AWS Signature Version 4 HMAC

### Examples

#### AWS Signature Version 4 calculation

This example demonstrates how to sign AWS requests using Signature Version 4:

```vcl
declare local var.aws_access_key STRING;
declare local var.aws_secret_key STRING;
declare local var.aws_region STRING;
declare local var.aws_service STRING;
declare local var.aws_date STRING;
declare local var.aws_request_hash STRING;
declare local var.aws_canonical_request STRING;
declare local var.aws_string_to_sign STRING;
declare local var.aws_signature STRING;

# Set AWS credentials and request details
set var.aws_access_key = "AKIAIOSFODNN7EXAMPLE";
set var.aws_secret_key = "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY";
set var.aws_region = "us-east-1";
set var.aws_service = "s3";
set var.aws_date = strftime({"%Y%m%dT%H%M%SZ"}, now);

# Create canonical request (simplified for example)
set var.aws_canonical_request = 
  "GET" + "\n" +
  "/my-bucket/my-object" + "\n" +
  "" + "\n" +  # Query string
  "host:s3.amazonaws.com" + "\n" +
  "x-amz-content-sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855" + "\n" +
  "x-amz-date:" + var.aws_date + "\n" +
  "" + "\n" +  # End of headers
  "host;x-amz-content-sha256;x-amz-date" + "\n" +
  "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";  # Empty body hash

# Hash the canonical request
set var.aws_request_hash = digest.hash_sha256(var.aws_canonical_request);

# Create string to sign
set var.aws_string_to_sign =
  "AWS4-HMAC-SHA256" + "\n" +
  var.aws_date + "\n" +
  substr(var.aws_date, 0, 8) + "/" + var.aws_region + "/" + var.aws_service + "/aws4_request" + "\n" +
  var.aws_request_hash;

# Calculate the signature
set var.aws_signature = digest.awsv4_hmac(
  var.aws_secret_key,
  substr(var.aws_date, 0, 8),
  var.aws_region,
  var.aws_service,
  var.aws_string_to_sign
);

# Set the Authorization header
set req.http.Authorization = 
  "AWS4-HMAC-SHA256 " +
  "Credential=" + var.aws_access_key + "/" + substr(var.aws_date, 0, 8) + "/" + var.aws_region + "/" + var.aws_service + "/aws4_request, " +
  "SignedHeaders=host;x-amz-content-sha256;x-amz-date, " +
  "Signature=" + var.aws_signature;
```

## FUNCTION GROUP: DIGITAL SIGNATURE VERIFICATION

The following functions help verify digital signatures using RSA or ECDSA:
- digest.rsa_verify: Verifies an RSA signature
- digest.ecdsa_verify: Verifies an ECDSA signature

### FUNCTION: digest.rsa_verify

PURPOSE: Verifies an RSA signature
SYNTAX: digest.rsa_verify(STRING digest_algorithm, STRING message, STRING signature_base64, STRING public_key)

PARAMETERS:
- digest_algorithm: The digest algorithm used (e.g., "sha256")
- message: The message that was signed
- signature_base64: The base64-encoded signature
- public_key: The RSA public key in PEM format

RETURN VALUE: TRUE if the signature is valid, FALSE otherwise

### FUNCTION: digest.ecdsa_verify

PURPOSE: Verifies an ECDSA signature
SYNTAX: digest.ecdsa_verify(STRING curve, STRING message, STRING signature_base64, STRING public_key)

PARAMETERS:
- curve: The elliptic curve used (e.g., "prime256v1")
- message: The message that was signed
- signature_base64: The base64-encoded signature
- public_key: The ECDSA public key in PEM format

RETURN VALUE: TRUE if the signature is valid, FALSE otherwise

### Examples

#### RSA signature verification

This example demonstrates how to verify an RSA signature:

```vcl
declare local var.message STRING;
declare local var.signature_base64 STRING;
declare local var.public_key STRING;
declare local var.digest_algorithm STRING;
declare local var.is_valid BOOL;

# Set the message, signature, and public key
set var.message = req.http.X-Message;
set var.signature_base64 = req.http.X-Signature;
set var.public_key = table.lookup(public_keys, req.http.X-Key-ID);
set var.digest_algorithm = "sha256";  # Can be sha1, sha256, etc.

# Verify the RSA signature
set var.is_valid = digest.rsa_verify(
  var.digest_algorithm,
  var.message,
  var.signature_base64,
  var.public_key
);

if (var.is_valid) {
  set req.http.X-Signature-Valid = "true";
} else {
  set req.http.X-Signature-Valid = "false";
  error 401 "Invalid signature";
}
```

#### ECDSA signature verification

This example demonstrates how to verify an ECDSA signature:

```vcl
declare local var.ecdsa_message STRING;
declare local var.ecdsa_signature_base64 STRING;
declare local var.ecdsa_public_key STRING;
declare local var.ecdsa_curve STRING;
declare local var.ecdsa_is_valid BOOL;

# Set the message, signature, and public key
set var.ecdsa_message = req.http.X-ECDSA-Message;
set var.ecdsa_signature_base64 = req.http.X-ECDSA-Signature;
set var.ecdsa_public_key = table.lookup(ecdsa_public_keys, req.http.X-ECDSA-Key-ID);
set var.ecdsa_curve = "prime256v1";  # Common ECDSA curve

# Verify the ECDSA signature
set var.ecdsa_is_valid = digest.ecdsa_verify(
  var.ecdsa_curve,
  var.ecdsa_message,
  var.ecdsa_signature_base64,
  var.ecdsa_public_key
);

if (var.ecdsa_is_valid) {
  set req.http.X-ECDSA-Signature-Valid = "true";
} else {
  set req.http.X-ECDSA-Signature-Valid = "false";
  error 401 "Invalid ECDSA signature";
}
```
## FUNCTION GROUP: TIME-BASED HMAC FUNCTIONS

The following functions generate time-based HMACs, which are useful for creating time-limited tokens or signatures:
- digest.time_hmac_sha1: Generates a time-based HMAC using SHA-1
- digest.time_hmac_sha256: Generates a time-based HMAC using SHA-256
- digest.time_hmac_sha512: Generates a time-based HMAC using SHA-512
- digest.time_hmac_sha1_debug: Provides debug information for time-based HMAC using SHA-1

### FUNCTION: digest.time_hmac_sha1

PURPOSE: Generates a time-based HMAC using SHA-1
SYNTAX: digest.time_hmac_sha1(STRING key, STRING input, INTEGER window)

PARAMETERS:
- key: The secret key
- input: The message to authenticate
- window: The time window in seconds

RETURN VALUE: The time-based HMAC-SHA1 of the input message

### FUNCTION: digest.time_hmac_sha256

PURPOSE: Generates a time-based HMAC using SHA-256
SYNTAX: digest.time_hmac_sha256(STRING key, STRING input, INTEGER window)

PARAMETERS:
- key: The secret key
- input: The message to authenticate
- window: The time window in seconds

RETURN VALUE: The time-based HMAC-SHA256 of the input message

### FUNCTION: digest.time_hmac_sha512

PURPOSE: Generates a time-based HMAC using SHA-512
SYNTAX: digest.time_hmac_sha512(STRING key, STRING input, INTEGER window)

PARAMETERS:
- key: The secret key
- input: The message to authenticate
- window: The time window in seconds

RETURN VALUE: The time-based HMAC-SHA512 of the input message

### FUNCTION: digest.time_hmac_sha1_debug

PURPOSE: Provides debug information for time-based HMAC using SHA-1
SYNTAX: digest.time_hmac_sha1_debug(STRING key, STRING input, INTEGER window)

PARAMETERS:
- key: The secret key
- input: The message to authenticate
- window: The time window in seconds

RETURN VALUE: Debug information about the time-based HMAC-SHA1

### Examples

#### Basic time-based HMAC

```vcl
declare local var.message STRING;
declare local var.key STRING;
declare local var.time_window INTEGER;
declare local var.time_hmac STRING;

set var.message = req.url.path;
set var.key = "TimeBasedSecretKey";
set var.time_window = 300;  # 5 minutes in seconds

# Generate a time-based HMAC valid for the specified window
set var.time_hmac = digest.time_hmac_sha256(var.key, var.message, var.time_window);

# Set the token in a header or cookie
set req.http.X-Time-Token = var.time_hmac;
```

#### Validating a time-based token

This example demonstrates how to validate a time-based token:

```vcl
declare local var.token STRING;
declare local var.validation_key STRING;
declare local var.validation_message STRING;
declare local var.token_valid BOOL;

set var.token = req.http.X-Auth-Token;
set var.validation_key = "TimeBasedSecretKey";
set var.validation_message = req.url.path;

# Check if the token is valid for the current time
# This implicitly checks if the token is within the time window
set var.token_valid = digest.secure_is_equal(
  var.token,
  digest.time_hmac_sha256(var.validation_key, var.validation_message, 300)
);

if (var.token_valid) {
  set req.http.X-Token-Valid = "true";
} else {
  set req.http.X-Token-Valid = "false";
  error 401 "Expired or invalid token";
}
```

#### Debugging time-based HMACs

This example demonstrates how to debug time-based HMACs:

```vcl
declare local var.debug_key STRING;
declare local var.debug_message STRING;
declare local var.debug_window INTEGER;
declare local var.debug_info STRING;

set var.debug_key = "DebugKey";
set var.debug_message = "TestMessage";
set var.debug_window = 60;  # 1 minute

# Get debug information about the time-based HMAC
set var.debug_info = digest.time_hmac_sha1_debug(
  var.debug_key,
  var.debug_message,
  var.debug_window
);

# The debug info includes the current time bucket, expiration, etc.
set req.http.X-HMAC-Debug = var.debug_info;
```

## FUNCTION GROUP: SECURE COMPARISON

The following function provides a way to compare strings in a way that is resistant to timing attacks:
- digest.secure_is_equal: Compares two strings securely

### FUNCTION: digest.secure_is_equal

PURPOSE: Compares two strings securely
SYNTAX: digest.secure_is_equal(STRING a, STRING b)

PARAMETERS:
- a: The first string to compare
- b: The second string to compare

RETURN VALUE: TRUE if the strings are equal, FALSE otherwise

### Examples

#### Secure string comparison

This example demonstrates how to securely compare strings:

```vcl
declare local var.expected STRING;
declare local var.actual STRING;
declare local var.is_equal BOOL;

set var.expected = "SecureToken123";
set var.actual = req.http.X-Auth-Token;

# Compare the strings securely
# This helps prevent timing attacks that could reveal information
# about the expected value
set var.is_equal = digest.secure_is_equal(var.expected, var.actual);

if (var.is_equal) {
  set req.http.X-Auth-Valid = "true";
} else {
  set req.http.X-Auth-Valid = "false";
  # In a real application, you might want to use a generic error
  # to avoid giving attackers information
  error 401 "Authentication failed";
}
```

## Integrated Example: JWT Validation System

This example demonstrates how multiple digest functions can work together to create a comprehensive JWT validation system.

```vcl
sub vcl_recv {
  # Step 1: Extract the JWT from the Authorization header
  declare local var.jwt STRING;
  declare local var.auth_header STRING;
  
  set var.auth_header = req.http.Authorization;
  
  # Check if the Authorization header exists and has the Bearer prefix
  if (var.auth_header && var.auth_header ~ "^Bearer ") {
    # Extract the token
    set var.jwt = regsub(var.auth_header, "^Bearer ", "");
  } else {
    error 401 "Missing or invalid Authorization header";
  }
  
  # Step 2: Parse the JWT parts (header, payload, signature)
  declare local var.jwt_parts STRING;
  declare local var.jwt_header_b64 STRING;
  declare local var.jwt_payload_b64 STRING;
  declare local var.jwt_signature_b64 STRING;
  
  # Split the JWT into its three parts
  set var.jwt_parts = regsub(var.jwt, "^([^.]+)\.([^.]+)\.([^.]+)$", "\1 \2 \3");
  
  if (var.jwt_parts ~ "^[^ ]+ [^ ]+ [^ ]+$") {
    # Extract the parts
    set var.jwt_header_b64 = regsub(var.jwt_parts, "^([^ ]+) [^ ]+ [^ ]+$", "\1");
    set var.jwt_payload_b64 = regsub(var.jwt_parts, "^[^ ]+ ([^ ]+) [^ ]+$", "\1");
    set var.jwt_signature_b64 = regsub(var.jwt_parts, "^[^ ]+ [^ ]+ ([^ ]+)$", "\1");
  } else {
    error 401 "Invalid JWT format";
  }
  
  # Step 3: Decode and validate the JWT header
  declare local var.jwt_header STRING;
  
  # Decode the header
  set var.jwt_header = digest.base64url_decode(var.jwt_header_b64);
  
  # Check if the header specifies the expected algorithm
  # In a real implementation, you would parse the JSON properly
  if (var.jwt_header !~ "\"alg\":\"HS256\"") {
    error 401 "Unsupported JWT algorithm";
  }
  
  # Step 4: Decode and validate the JWT payload
  declare local var.jwt_payload STRING;
  
  # Decode the payload
  set var.jwt_payload = digest.base64url_decode(var.jwt_payload_b64);
  
  # Extract and validate claims
  # In a real implementation, you would parse the JSON properly
  
  # Check if the token has expired
  # This is a simplified example; in reality, you would parse the exp claim
  if (var.jwt_payload ~ "\"exp\":([0-9]+)") {
    declare local var.exp_time INTEGER;
    set var.exp_time = std.atoi(re.group.1);
    
    if (var.exp_time < time.start) {
      error 401 "JWT has expired";
    }
  }
  
  # Step 5: Verify the JWT signature
  declare local var.jwt_signing_input STRING;
  declare local var.jwt_secret STRING;
  declare local var.expected_signature STRING;
  declare local var.signature_valid BOOL;
  
  # Reconstruct the signing input
  set var.jwt_signing_input = var.jwt_header_b64 + "." + var.jwt_payload_b64;
  
  # Get the secret key
  set var.jwt_secret = "YourJWTSecretKey";
  
  # Calculate the expected signature
  set var.expected_signature = digest.hmac_sha256_base64(var.jwt_secret, var.jwt_signing_input);
  
  # Convert to URL-safe base64 without padding
  set var.expected_signature = regsub(var.expected_signature, "\+", "-");
  set var.expected_signature = regsub(var.expected_signature, "\/", "_");
  set var.expected_signature = regsub(var.expected_signature, "=+$", "");
  
  # Verify the signature
  set var.signature_valid = digest.secure_is_equal(var.expected_signature, var.jwt_signature_b64);
  
  if (!var.signature_valid) {
    error 401 "Invalid JWT signature";
  }
  
  # Step 6: Extract user information from the validated JWT
  # In a real implementation, you would parse the JSON properly
  if (var.jwt_payload ~ "\"sub\":\"([^\"]+)\"") {
    set req.http.X-User-ID = re.group.1;
  }
  
  if (var.jwt_payload ~ "\"roles\":\[([^\]]+)\]") {
    set req.http.X-User-Roles = re.group.1;
  }
  
  # JWT is valid, continue processing the request
  set req.http.X-JWT-Valid = "true";
}
```

## Best Practices for Digest Functions

1. Choose the appropriate hash algorithm for your use case:
   - SHA-256 or SHA-512 for security-critical applications
   - MD5 or SHA-1 only for non-security purposes (checksums, etc.)
   - xxHash for high-performance, non-cryptographic hashing

2. Always use digest.secure_is_equal() for comparing sensitive strings
   to prevent timing attacks

3. For HMACs:
   - Use strong, random keys
   - Prefer SHA-256 or SHA-512 over MD5 or SHA-1
   - Consider using time-based HMACs for temporary tokens

4. For Base64:
   - Use URL-safe variants (base64url) for data that might appear in URLs
   - Consider no-padding variants when padding characters are problematic

5. For digital signatures:
   - Keep private keys secure and out of VCL
   - Use tables to store public keys for verification
   - Validate all inputs before processing

6. General security practices:
   - Don't expose sensitive information in headers or logs
   - Use generic error messages to avoid information leakage
   - Implement proper rate limiting for authentication attempts
   - Regularly rotate keys and secrets