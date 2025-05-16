# Binary Data Functions

This file demonstrates comprehensive examples of Binary Data Functions in VCL.
These functions help work with binary data, including conversion between
different encodings such as hex and base64.

## bin.base64_to_hex

Converts a base64-encoded string to a hexadecimal string.

### Syntax

```vcl
STRING bin.base64_to_hex(STRING base64_encoded_string)
```

### Parameters

- `base64_encoded_string`: A base64-encoded string to convert

### Return Value

- A hexadecimal string representation of the binary data
- Empty string if the input is not valid base64

### Examples

#### Basic base64 to hex conversion

```vcl
declare local var.base64_data STRING;
declare local var.hex_data STRING;

# Set a base64-encoded string
# "SGVsbG8gV29ybGQ=" is base64 for "Hello World"
set var.base64_data = "SGVsbG8gV29ybGQ=";

# Convert to hex
set var.hex_data = bin.base64_to_hex(var.base64_data);

# var.hex_data is now "48656c6c6f20576f726c64" (hex for "Hello World")
set req.http.X-Hex-Data = var.hex_data;
```

#### Error handling for invalid base64 input

```vcl
declare local var.invalid_base64 STRING;
declare local var.converted_hex STRING;

# Set an invalid base64 string (contains invalid characters)
set var.invalid_base64 = "SGVsbG8gV29ybGQ=!@#";

# Attempt conversion with error handling
set var.converted_hex = bin.base64_to_hex(var.invalid_base64);

if (var.converted_hex == "") {
  # Conversion failed, handle the error
  set req.http.X-Conversion-Error = "Invalid base64 input";
  
  # Use a fallback or sanitized input
  set var.invalid_base64 = regsub(var.invalid_base64, "[^A-Za-z0-9+/=]", "");
  set var.converted_hex = bin.base64_to_hex(var.invalid_base64);
}
```

#### Processing JWT tokens

This example demonstrates how to extract and process parts of a JWT token:

```vcl
declare local var.jwt_token STRING;
declare local var.jwt_payload_b64 STRING;
declare local var.jwt_payload_hex STRING;

# Sample JWT token (header.payload.signature)
set var.jwt_token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";

# Extract the payload part (second segment)
set var.jwt_payload_b64 = regsub(var.jwt_token, "^[^.]*\.([^.]*)\.[^.]*$", "\1");

# Convert payload from base64 to hex for further processing
set var.jwt_payload_hex = bin.base64_to_hex(var.jwt_payload_b64);

# Now you could use this hex data for further processing
# For example, you could look for specific patterns in the hex data
if (var.jwt_payload_hex ~ "6e616d65") {  # "name" in hex
  set req.http.X-JWT-Contains-Name = "true";
}
```

## bin.hex_to_base64

Converts a hexadecimal string to a base64-encoded string.

### Syntax

```vcl
STRING bin.hex_to_base64(STRING hex_string)
```

### Parameters

- `hex_string`: A hexadecimal string to convert

### Return Value

- A base64-encoded string representation of the binary data
- Empty string if the input is not valid hexadecimal

### Examples

#### Basic hex to base64 conversion

```vcl
declare local var.hex_data STRING;
declare local var.base64_data STRING;

# Set a hex string
# "48656c6c6f20576f726c64" is hex for "Hello World"
set var.hex_data = "48656c6c6f20576f726c64";

# Convert to base64
set var.base64_data = bin.hex_to_base64(var.hex_data);

# var.base64_data is now "SGVsbG8gV29ybGQ="
set req.http.X-Base64-Data = var.base64_data;
```

#### Error handling for invalid hex input

```vcl
declare local var.invalid_hex STRING;
declare local var.converted_base64 STRING;

# Set an invalid hex string (contains non-hex characters)
set var.invalid_hex = "48656c6c6f20576f726c64ZZ";

# Attempt conversion with error handling
set var.converted_base64 = bin.hex_to_base64(var.invalid_hex);

if (var.converted_base64 == "") {
  # Conversion failed, handle the error
  set req.http.X-Conversion-Error = "Invalid hex input";
  
  # Use a fallback or sanitized input
  set var.invalid_hex = regsub(var.invalid_hex, "[^0-9A-Fa-f]", "");
  set var.converted_base64 = bin.hex_to_base64(var.invalid_hex);
}
```

#### Creating a data URL for inline images

This example demonstrates how to create a data URL for an inline image:

```vcl
declare local var.image_hex STRING;
declare local var.image_base64 STRING;
declare local var.data_url STRING;

# Hex representation of a tiny image (would be much longer in practice)
set var.image_hex = "89504e470d0a1a0a0000000d49484452000000100000001008060000001ff3ff61";

# Convert to base64
set var.image_base64 = bin.hex_to_base64(var.image_hex);

# Create a data URL
set var.data_url = "data:image/png;base64," + var.image_base64;

# Use the data URL in a response header or for other purposes
set req.http.X-Image-Data-URL = var.data_url;
```

## bin.data_convert

Converts binary data between different encodings.

### Syntax

```vcl
STRING bin.data_convert(STRING input, STRING input_encoding, STRING output_encoding)
```

### Parameters

- `input`: The input data to convert
- `input_encoding`: The encoding of the input data (base64, hex, utf8, ascii)
- `output_encoding`: The desired output encoding (base64, hex, utf8, ascii)

### Return Value

- The converted data in the specified output encoding
- Empty string if conversion fails

### Examples

#### Basic data conversion

```vcl
declare local var.input_data STRING;
declare local var.converted_data STRING;

# Set input data (UTF-8 text)
set var.input_data = "Hello World";

# Convert from UTF-8 to base64
set var.converted_data = bin.data_convert(var.input_data, "utf8", "base64");

# var.converted_data is now "SGVsbG8gV29ybGQ="
set req.http.X-Converted-Data = var.converted_data;
```

#### Multiple conversion steps

```vcl
declare local var.original_text STRING;
declare local var.hex_encoded STRING;
declare local var.base64_encoded STRING;
declare local var.back_to_text STRING;

# Start with original text
set var.original_text = "Fastly VCL";

# Convert to hex
set var.hex_encoded = bin.data_convert(var.original_text, "utf8", "hex");

# Convert hex to base64
set var.base64_encoded = bin.data_convert(var.hex_encoded, "hex", "base64");

# Convert back to text
set var.back_to_text = bin.data_convert(var.base64_encoded, "base64", "utf8");

# Verify the round-trip conversion
if (var.back_to_text == var.original_text) {
  set req.http.X-Conversion-Success = "true";
} else {
  set req.http.X-Conversion-Success = "false";
}
```

#### Error handling with different encodings

```vcl
declare local var.binary_data STRING;
declare local var.ascii_result STRING;

# Binary data that may not be valid in all encodings
set var.binary_data = bin.data_convert("\xFF\x00\xAB", "ascii", "hex");

# Try to convert hex to ASCII (may fail for non-ASCII characters)
set var.ascii_result = bin.data_convert(var.binary_data, "hex", "ascii");

if (var.ascii_result == "") {
  # Conversion failed, handle the error
  set req.http.X-Conversion-Error = "Cannot represent data in ASCII";
  
  # Use a different encoding that can represent all binary data
  set req.http.X-Safe-Representation = bin.data_convert(var.binary_data, "hex", "base64");
}
```

#### Working with binary protocols

This example demonstrates how to work with binary protocol data:

```vcl
declare local var.protocol_message STRING;
declare local var.hex_message STRING;
declare local var.message_type INTEGER;

# Simulated binary protocol message (in hex format)
set var.hex_message = "0103000A48656C6C6F";

# Convert to a more readable format for logging
set var.protocol_message = bin.data_convert(var.hex_message, "hex", "base64");
set req.http.X-Protocol-Message-B64 = var.protocol_message;

# Extract message type from the binary data (first byte)
# In a real scenario, you would parse the actual binary structure
set var.message_type = std.strtol(substr(var.hex_message, 0, 2), 16);

# Process based on message type
if (var.message_type == 1) {
  set req.http.X-Message-Type = "CONNECT";
} else if (var.message_type == 2) {
  set req.http.X-Message-Type = "DISCONNECT";
} else {
  set req.http.X-Message-Type = "UNKNOWN";
}
```

## Integrated Example: Complete binary data processing system

This example demonstrates how all binary data functions can work together to create a comprehensive data processing system.

```vcl
sub vcl_recv {
  # Step 1: Extract binary data from different sources
  declare local var.raw_data STRING;
  declare local var.encoding STRING;
  
  # Determine the source and encoding of the data
  if (req.http.Content-Type == "application/base64") {
    set var.raw_data = req.http.X-Binary-Data;
    set var.encoding = "base64";
  } else if (req.http.Content-Type == "application/hex") {
    set var.raw_data = req.http.X-Binary-Data;
    set var.encoding = "hex";
  } else {
    # Default to UTF-8 text
    set var.raw_data = req.http.X-Binary-Data;
    set var.encoding = "utf8";
  }
  
  # Step 2: Normalize to a common format (hex) for processing
  declare local var.normalized_hex STRING;
  
  if (var.encoding == "base64") {
    set var.normalized_hex = bin.base64_to_hex(var.raw_data);
  } else if (var.encoding == "hex") {
    set var.normalized_hex = var.raw_data;
  } else {
    # Convert from UTF-8 to hex
    set var.normalized_hex = bin.data_convert(var.raw_data, "utf8", "hex");
  }
  
  # Step 3: Process the data in hex format
  # This could involve extracting fields, validating checksums, etc.
  declare local var.data_valid BOOL;
  declare local var.data_type STRING;
  declare local var.data_length INTEGER;
  
  # Example: Extract header information from a simple binary format
  # Format: [1 byte type][2 bytes length][variable data]
  if (std.strlen(var.normalized_hex) >= 6) {
    # Extract type (first byte)
    set var.data_type = substr(var.normalized_hex, 0, 2);
    
    # Extract length (next 2 bytes)
    set var.data_length = std.strtol(substr(var.normalized_hex, 2, 4), 16);
    
    # Validate the data
    if (std.strlen(var.normalized_hex) >= (6 + var.data_length * 2)) {
      set var.data_valid = true;
    } else {
      set var.data_valid = false;
    }
  } else {
    set var.data_valid = false;
  }
  
  # Step 4: Take action based on the processed data
  if (var.data_valid) {
    if (var.data_type == "01") {
      # Type 0x01: Authentication token
      # Extract the token data
      declare local var.token_hex STRING;
      set var.token_hex = substr(var.normalized_hex, 6, var.data_length * 2);
      
      # Convert to base64 for use in Authorization header
      declare local var.token_base64 STRING;
      set var.token_base64 = bin.hex_to_base64(var.token_hex);
      
      # Set the Authorization header
      set req.http.Authorization = "Bearer " + var.token_base64;
      
    } else if (var.data_type == "02") {
      # Type 0x02: Encrypted payload
      # Extract the encrypted data
      declare local var.encrypted_hex STRING;
      set var.encrypted_hex = substr(var.normalized_hex, 6, var.data_length * 2);
      
      # In a real scenario, you might decrypt this data
      # For this example, we'll just pass it along
      set req.http.X-Encrypted-Data = var.encrypted_hex;
      
    } else {
      # Unknown type
      set req.http.X-Unknown-Data-Type = var.data_type;
    }
  } else {
    # Invalid data
    set req.http.X-Data-Error = "Invalid binary data format";
  }
  
  # Step 5: Prepare data for the backend in the required format
  declare local var.backend_format STRING;
  declare local var.backend_data STRING;
  
  # Determine the format required by the backend
  if (req.backend == F_json_backend) {
    set var.backend_format = "utf8";  # JSON backend expects UTF-8
  } else if (req.backend == F_binary_backend) {
    set var.backend_format = "base64";  # Binary backend expects base64
  } else {
    set var.backend_format = "hex";  # Default to hex
  }
  
  # Convert the normalized hex data to the required format
  set var.backend_data = bin.data_convert(var.normalized_hex, "hex", var.backend_format);
  
  # Set the appropriate header for the backend
  set req.http.X-Processed-Data = var.backend_data;
}
```

## Best Practices for Binary Data Functions

1. Always validate input data before conversion to avoid errors
2. Use appropriate error handling for conversion failures
3. Choose the right encoding for your use case:
   - base64 for compact representation in headers and URLs
   - hex for human-readable debugging and logging
   - utf8/ascii for text data
4. Be aware of encoding limitations (e.g., ASCII can't represent all binary values)
5. Use bin.data_convert for flexible conversions between multiple formats
6. Consider performance implications for large data conversions
7. Normalize binary data to a common format (like hex) for consistent processing
8. Document binary data formats and protocols clearly
9. Use appropriate Content-Type headers when returning binary data
10. Consider security implications when processing binary data (validate before use)