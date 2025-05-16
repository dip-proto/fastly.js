# Fastly VCL Function Examples

This repository contains comprehensive code examples for all VCL (Varnish Configuration Language) functions used by Fastly. These examples are designed to demonstrate practical, production-ready implementations of each function with detailed explanations and best practices.

## Project Overview

The project provides a comprehensive inventory of VCL functions organized into 16 primary categories:

1. **Accept Header Functions** - For parsing HTTP Accept headers
2. **Address Functions** - For working with IP addresses
3. **Binary Data Functions** - For binary data operations
4. **Digest Functions** - For cryptographic operations and encoding
5. **Fastly-specific Functions** - Functions unique to Fastly's platform
6. **HTTP Functions** - For HTTP request/response manipulation
7. **Math Functions** - Mathematical operations
8. **Query String Functions** - For URL query string manipulation
9. **Random Functions** - For generating random values
10. **Rate Limiting Functions** - For implementing rate limiting
11. **Standard Utility Functions** - General utility functions
12. **Table Functions** - For working with lookup tables
13. **Time Functions** - For time manipulation
14. **UUID Functions** - For working with UUIDs
15. **WAF Functions** - Web Application Firewall functions
16. **Miscellaneous Functions** - Functions that don't fit other categories

## Example Structure

Each function example includes:

- Correct syntax and usage
- Realistic parameters and edge cases
- Common implementation patterns
- Detailed comments explaining purpose and behavior
- Error handling where appropriate
- Integration with Fastly-specific features

For complex functions, multiple examples are provided showing different use cases.

## Common VCL Patterns

Throughout the examples, several important patterns are demonstrated:

1. **Function Chaining** - Functions are frequently chained together
2. **Type Conversion Flow** - Common patterns of converting between data types
3. **Conditional Logic Patterns** - How functions create branching logic
4. **Data Transformation Pipeline** - Extract → transform → load patterns
5. **Security Function Layering** - How security functions work together
6. **Normalization Before Lookup** - Patterns for consistent data handling
7. **Complementary Function Pairs** - Functions that naturally work together

## Implementation Patterns

The examples also showcase 10 common VCL implementation patterns:

1. **Request Normalization Pattern** - Standardizing incoming requests
2. **Content-Based Routing Pattern** - Routing based on request content
3. **Authentication and Authorization Pattern** - Securing access to resources
4. **Edge Caching Strategy Pattern** - Optimizing cache behavior
5. **Rate Limiting and Security Pattern** - Protecting against abuse
6. **Content Transformation Pattern** - Modifying content at the edge
7. **A/B Testing and Feature Flagging Pattern** - Testing new features
8. **Geolocation and Personalization Pattern** - Customizing content by location
9. **Edge Data Processing Pattern** - Processing data at the edge
10. **Logging and Analytics Pattern** - Capturing metrics and events

## Category Details

### 1. Accept Header Functions

Examples for parsing and working with HTTP Accept headers, including:
- Parsing Accept headers for content negotiation
- Determining preferred media types
- Handling quality values
- Implementing content type selection logic

### 2. Address Functions

Examples for working with IP addresses, including:
- IP address validation and manipulation
- CIDR subnet operations
- IPv4 and IPv6 handling
- Geolocation-based logic

### 3. Binary Data Functions

Examples for binary data operations, including:
- Base64 encoding and decoding
- Binary data manipulation
- Handling binary streams
- Working with binary representations

### 4. Digest Functions

Examples for cryptographic operations and encoding, including:
- Hash generation (MD5, SHA-1, SHA-256)
- HMAC operations
- Base64 encoding/decoding
- Secure token generation and validation

### 5. Fastly-specific Functions

Examples for Fastly-specific functionality, including:
- Edge dictionary operations
- Segmented caching
- ESI processing
- Fastly-specific headers and metadata

### 6. HTTP Functions

Examples for HTTP request/response manipulation, including:
- Header manipulation
- Cookie handling
- URL parsing and modification
- HTTP method handling

### 7. Math Functions

Examples for mathematical operations, including:
- Basic arithmetic
- Trigonometric functions
- Logarithmic and exponential functions
- Rounding and truncation

### 8. Query String Functions

Examples for URL query string manipulation, including:
- Parameter extraction
- Query string parsing
- Parameter addition, modification, and removal
- Query string normalization

### 9. Random Functions

Examples for generating random values, including:
- Random number generation
- Random string generation
- Weighted random selection
- Seeded randomness

### 10. Rate Limiting Functions

Examples for implementing rate limiting, including:
- Token bucket algorithm
- IP-based rate limiting
- User-based rate limiting
- Resource-specific rate limiting

### 11. Standard Utility Functions

Examples for general utility functions, including:
- String manipulation
- Type conversion
- Collection handling
- Path manipulation

### 12. Table Functions

Examples for working with lookup tables, including:
- Key-value lookups
- Table-based configuration
- Dynamic feature flags
- Access control lists

### 13. Time Functions

Examples for time manipulation, including:
- Time formatting
- Time zone conversion
- Time arithmetic
- Time-based conditions

### 14. UUID Functions

Examples for working with UUIDs, including:
- UUID generation (v3, v4, v5)
- UUID validation
- Namespace-based UUIDs
- UUID-based identifiers

### 15. WAF Functions

Examples for Web Application Firewall functionality, including:
- Request blocking
- Request allowing
- WAF logging
- Rate limiting

### 16. Miscellaneous Functions

Examples for functions that don't fit other categories, including:
- Flow control
- Synthetic responses
- Error handling
- Request restarts

## Usage

These examples are designed to be educational and serve as a reference for implementing VCL functions in production environments. They can be:

1. Copied directly into your VCL configurations
2. Modified to suit your specific requirements
3. Used as a learning resource for understanding VCL functionality
4. Referenced when troubleshooting VCL issues

## Best Practices

Throughout the examples, best practices are highlighted, including:

- Proper error handling
- Performance considerations
- Security implications
- Code organization and readability
- Documentation standards

## Contributing

This project is part of a larger documentation effort. If you'd like to contribute additional examples or improvements, please follow the standard contribution guidelines.

## License

This project is licensed under the MIT License - see the LICENSE file for details.