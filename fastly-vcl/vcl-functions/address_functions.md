# Address Functions

This file demonstrates comprehensive examples of Address Functions in VCL.
These functions help work with IP addresses for network operations, geolocation,
security policies, and routing decisions.

## addr.is_ipv4

Determines if a given address is an IPv4 address.

### Syntax

```vcl
BOOL addr.is_ipv4(IP address)
```

### Parameters

- `address`: An IP address to check

### Return Value

- TRUE if the address is an IPv4 address
- FALSE otherwise

### Examples

#### Basic IPv4 detection

```vcl
declare local var.is_ipv4 BOOL;
set var.is_ipv4 = addr.is_ipv4(client.ip);

# Log the result
log "Client IP is IPv4: " + if(var.is_ipv4, "yes", "no");
```

#### Conditional logic based on IP version

```vcl
if (addr.is_ipv4(client.ip)) {
  # IPv4-specific handling
  set req.http.X-IP-Version = "IPv4";
  
  # Example: Set different backend for IPv4 clients
  set req.backend = F_ipv4_backend;
} else if (addr.is_ipv6(client.ip)) {
  # IPv6-specific handling
  set req.http.X-IP-Version = "IPv6";
  
  # Example: Set different backend for IPv6 clients
  set req.backend = F_ipv6_backend;
}
```

#### Error handling with string conversion

```vcl
declare local var.ip_to_check STRING;
declare local var.is_valid_ipv4 BOOL;

# Get IP from a header (potentially unsafe)
set var.ip_to_check = req.http.X-Forwarded-For;

# Safely check if it's a valid IPv4 address
if (var.ip_to_check ~ "^[\d\.]+$") {
  set var.is_valid_ipv4 = addr.is_ipv4(var.ip_to_check);
  if (var.is_valid_ipv4) {
    # It's a valid IPv4 address
    set req.http.X-Valid-IPv4 = "true";
  } else {
    # Not a valid IPv4 address
    set req.http.X-Valid-IPv4 = "false";
  }
} else {
  # Not even a potential IP address
  set req.http.X-Valid-IPv4 = "false";
}
```

## addr.is_ipv6

Determines if a given address is an IPv6 address.

### Syntax

```vcl
BOOL addr.is_ipv6(IP address)
```

### Parameters

- `address`: An IP address to check

### Return Value

- TRUE if the address is an IPv6 address
- FALSE otherwise

### Examples

#### Basic IPv6 detection

```vcl
declare local var.is_ipv6 BOOL;
set var.is_ipv6 = addr.is_ipv6(client.ip);
```

#### IPv6 readiness check

This example demonstrates how to check if your service is properly handling IPv6 traffic:

```vcl
if (addr.is_ipv6(client.ip)) {
  # Count IPv6 requests for monitoring
  if (req.restarts == 0) {
    # Only count on the initial request, not restarts
    # Note: In a real implementation, you would use a proper counter
    log "IPv6 request received from " + client.ip;
  }
  
  # Set a response header for debugging
  set req.http.X-IPv6-Enabled = "true";
}
```

#### IPv6 feature flag

This example shows how to enable specific features only for IPv6 users:

```vcl
if (addr.is_ipv6(client.ip) && req.url ~ "^/beta/") {
  # Enable new features for IPv6 users on beta paths
  set req.http.X-Enable-New-Features = "true";
}
```

## addr.is_unix

Determines if a given address is a Unix domain socket address.

### Syntax

```vcl
BOOL addr.is_unix(IP address)
```

### Parameters

- `address`: An address to check

### Return Value

- TRUE if the address is a Unix domain socket address
- FALSE otherwise

### Examples

#### Basic Unix socket detection

Note: This is less common in edge computing but useful in certain scenarios:

```vcl
declare local var.is_unix BOOL;
set var.is_unix = addr.is_unix(client.socket.address);
```

#### Backend connection type detection

This example demonstrates how to detect the type of connection to a backend:

```vcl
if (addr.is_unix(bereq.backend.socket.address)) {
  # Connection to backend is via Unix socket
  set bereq.http.X-Backend-Socket-Type = "unix";
} else if (addr.is_ipv4(bereq.backend.socket.address)) {
  # Connection to backend is via IPv4
  set bereq.http.X-Backend-Socket-Type = "ipv4";
} else if (addr.is_ipv6(bereq.backend.socket.address)) {
  # Connection to backend is via IPv6
  set bereq.http.X-Backend-Socket-Type = "ipv6";
}
```

## addr.extract_bits

Extracts a range of bits from an IP address.

### Syntax

```vcl
INTEGER addr.extract_bits(IP address, INTEGER offset, INTEGER length)
```

### Parameters

- `address`: The IP address to extract bits from
- `offset`: The bit offset from which to start extracting (0 = most significant bit)
- `length`: The number of bits to extract (1-32 for IPv4, 1-128 for IPv6)

### Return Value

An integer containing the extracted bits

### Examples

#### Basic bit extraction

```vcl
declare local var.network_bits INTEGER;

# Extract the first 8 bits (network portion) of an IPv4 address
set var.network_bits = addr.extract_bits(client.ip, 0, 8);

# Log the result
log "First 8 bits of client IP: " + var.network_bits;
```

#### Subnet matching using bit extraction

This example demonstrates how to check if an IP is in a specific subnet:

```vcl
declare local var.subnet_bits INTEGER;
declare local var.target_subnet INTEGER;

# Extract first 24 bits of client IP (equivalent to a /24 subnet mask)
set var.subnet_bits = addr.extract_bits(client.ip, 0, 24);

# Define target subnet (192.168.1.0/24)
# 192 = 11000000, 168 = 10101000, 1 = 00000001
# Combined: 11000000 10101000 00000001 = 12625921
set var.target_subnet = 12625921;

if (var.subnet_bits == var.target_subnet) {
  # Client is in the 192.168.1.0/24 subnet
  set req.http.X-Internal-Network = "true";
}
```

#### IPv6 subnet classification

This example shows how to classify IPv6 addresses by their prefix:

```vcl
if (addr.is_ipv6(client.ip)) {
  # Extract the first 48 bits (typical ISP allocation)
  declare local var.ipv6_prefix INTEGER;
  set var.ipv6_prefix = addr.extract_bits(client.ip, 0, 48);
  
  # Set a header with the prefix for analytics
  set req.http.X-IPv6-Prefix = var.ipv6_prefix;
  
  # Example classification based on prefix
  if (var.ipv6_prefix == 42540766412969) {  # 2001:db8::/48 documentation prefix
    set req.http.X-IPv6-Type = "documentation";
  }
}
```

#### Advanced network segmentation

This example demonstrates how to use bit extraction for complex network segmentation:

```vcl
declare local var.client_segment INTEGER;

if (addr.is_ipv4(client.ip)) {
  # For IPv4, use the third octet for segmentation
  # Extract bits 16-23 (third octet)
  set var.client_segment = addr.extract_bits(client.ip, 16, 8);
} else if (addr.is_ipv6(client.ip)) {
  # For IPv6, use bits 48-55 for segmentation
  set var.client_segment = addr.extract_bits(client.ip, 48, 8);
} else {
  set var.client_segment = 0;
}

# Use the segment for routing or feature flags
if (var.client_segment >= 1 && var.client_segment <= 50) {
  set req.http.X-Segment = "alpha";
} else if (var.client_segment >= 51 && var.client_segment <= 150) {
  set req.http.X-Segment = "beta";
} else if (var.client_segment >= 151 && var.client_segment <= 200) {
  set req.http.X-Segment = "gamma";
} else {
  set req.http.X-Segment = "default";
}
```

## Integrated Example: IP-based security and routing system

This example demonstrates how all address functions can work together to create a comprehensive IP-based security and routing system.

```vcl
sub vcl_recv {
  # Step 1: Determine the client's IP version
  declare local var.ip_version STRING;
  
  if (addr.is_ipv4(client.ip)) {
    set var.ip_version = "ipv4";
  } else if (addr.is_ipv6(client.ip)) {
    set var.ip_version = "ipv6";
  } else if (addr.is_unix(client.ip)) {
    set var.ip_version = "unix";
  } else {
    set var.ip_version = "unknown";
  }
  
  # Step 2: Extract network information for classification
  declare local var.network_class STRING;
  
  if (var.ip_version == "ipv4") {
    # Extract first octet for IPv4 classification
    declare local var.first_octet INTEGER;
    set var.first_octet = addr.extract_bits(client.ip, 0, 8);
    
    # Classify based on IPv4 address classes (simplified)
    if (var.first_octet >= 1 && var.first_octet <= 126) {
      set var.network_class = "class_a";
    } else if (var.first_octet >= 128 && var.first_octet <= 191) {
      set var.network_class = "class_b";
    } else if (var.first_octet >= 192 && var.first_octet <= 223) {
      set var.network_class = "class_c";
    } else if (var.first_octet >= 224 && var.first_octet <= 239) {
      set var.network_class = "class_d";
    } else {
      set var.network_class = "class_e";
    }
    
    # Check for private networks
    declare local var.first_16bits INTEGER;
    set var.first_16bits = addr.extract_bits(client.ip, 0, 16);
    
    if (var.first_octet == 10 || 
        var.first_16bits == 43200 || # 172.16.0.0/12 (first 12 bits)
        (var.first_octet == 192 && addr.extract_bits(client.ip, 8, 8) == 168)) {
      set var.network_class = "private";
    }
  } else if (var.ip_version == "ipv6") {
    # Extract first 16 bits for IPv6 classification
    declare local var.first_16bits INTEGER;
    set var.first_16bits = addr.extract_bits(client.ip, 0, 16);
    
    # Classify based on IPv6 address types (simplified)
    if (var.first_16bits == 0) {
      set var.network_class = "unspecified"; # ::/128
    } else if (var.first_16bits == 1) {
      set var.network_class = "loopback"; # ::1/128
    } else if ((var.first_16bits & 0xffc0) == 0xfe80) {
      set var.network_class = "link_local"; # fe80::/10
    } else if ((var.first_16bits & 0xfe00) == 0xfc00) {
      set var.network_class = "unique_local"; # fc00::/7
    } else {
      set var.network_class = "global";
    }
  } else {
    set var.network_class = "unknown";
  }
  
  # Step 3: Implement security policies based on IP classification
  if (var.network_class == "private") {
    # Allow internal network access to admin areas
    if (req.url ~ "^/admin/") {
      set req.http.X-Internal-Access = "allowed";
    }
  } else if (var.network_class == "class_d") {
    # Block multicast addresses (shouldn't normally reach edge)
    error 403 "Multicast addresses not allowed";
  }
  
  # Step 4: Implement routing based on IP classification
  if (var.ip_version == "ipv6" && var.network_class == "global") {
    # Route IPv6 global traffic to IPv6-optimized backend
    set req.backend = F_ipv6_optimized_backend;
  } else if (var.network_class == "private") {
    # Route internal traffic to internal backend
    set req.backend = F_internal_backend;
  } else {
    # Default backend for all other traffic
    set req.backend = F_default_backend;
  }
  
  # Step 5: Set headers for analytics and debugging
  set req.http.X-IP-Version = var.ip_version;
  set req.http.X-Network-Class = var.network_class;
}
```

## Best Practices for Address Functions

1. Always validate IP addresses before performing operations on them
2. Use addr.is_ipv4() and addr.is_ipv6() for proper protocol-specific handling
3. Leverage addr.extract_bits() for efficient subnet matching
4. Consider both IPv4 and IPv6 in your logic for future-proof implementations
5. Use IP-based segmentation for A/B testing and feature rollouts
6. Combine with geolocation data for more sophisticated routing
7. Implement proper error handling for edge cases
8. Use IP classification for security policies and access control
9. Consider performance implications when doing complex bit manipulations
10. Document your bit extraction logic clearly for maintainability