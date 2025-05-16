# Load Balancing with Fastly.JS

Load balancing is a technique used to distribute network traffic across multiple servers to ensure high availability, reliability, and optimal resource utilization. With Fastly.JS, you can implement various load balancing strategies at the edge, including:

- Round-robin load balancing
- Weighted load balancing
- Health-check based load balancing
- Content-based routing
- Geo-based routing

This guide demonstrates how to implement these load balancing strategies using Fastly.JS and VCL.

## Setting Up Backends

Before implementing load balancing, you need to define your backend servers:

```vcl
# Define backend servers
backend server1 {
  .host = "server1.example.com";
  .port = "80";
}

backend server2 {
  .host = "server2.example.com";
  .port = "80";
}

backend server3 {
  .host = "server3.example.com";
  .port = "80";
}
```

## Round-Robin Load Balancing

Round-robin load balancing distributes requests evenly across all backend servers:

```vcl
# Define a director for round-robin load balancing
std.director.add("round_robin_director", "round-robin");

# Add backends to the director
std.director.add_backend("round_robin_director", "server1", 1);
std.director.add_backend("round_robin_director", "server2", 1);
std.director.add_backend("round_robin_director", "server3", 1);

sub vcl_recv {
  # Set the backend to the director
  set req.backend = std.director.select_backend("round_robin_director").name;
  
  return(lookup);
}
```

## Weighted Load Balancing

Weighted load balancing distributes requests based on the weight assigned to each backend:

```vcl
# Define a director for weighted load balancing
std.director.add("weighted_director", "weighted");

# Add backends to the director with different weights
std.director.add_backend("weighted_director", "server1", 3);  # 3x weight
std.director.add_backend("weighted_director", "server2", 2);  # 2x weight
std.director.add_backend("weighted_director", "server3", 1);  # 1x weight

sub vcl_recv {
  # Set the backend to the director
  set req.backend = std.director.select_backend("weighted_director").name;
  
  return(lookup);
}
```

## Health-Check Based Load Balancing

Health-check based load balancing distributes requests only to healthy backends:

```vcl
# Define backends with health checks
backend server1 {
  .host = "server1.example.com";
  .port = "80";
  .probe = {
    .url = "/health";
    .interval = 5s;
    .timeout = 1s;
    .window = 5;
    .threshold = 3;
  }
}

backend server2 {
  .host = "server2.example.com";
  .port = "80";
  .probe = {
    .url = "/health";
    .interval = 5s;
    .timeout = 1s;
    .window = 5;
    .threshold = 3;
  }
}

# Define a director for health-check based load balancing
std.director.add("health_director", "random");

# Add backends to the director
std.director.add_backend("health_director", "server1", 1);
std.director.add_backend("health_director", "server2", 1);

sub vcl_recv {
  # Set the backend to the director
  set req.backend = std.director.select_backend("health_director").name;
  
  return(lookup);
}
```

## Content-Based Routing

Content-based routing directs requests to different backends based on the request content:

```vcl
sub vcl_recv {
  # Route API requests to the API backend
  if (req.url ~ "^/api/") {
    set req.backend = server1;
  }
  # Route static content to the static content backend
  else if (req.url ~ "\.(jpg|jpeg|png|gif|css|js)$") {
    set req.backend = server2;
  }
  # Route everything else to the default backend
  else {
    set req.backend = server3;
  }
  
  return(lookup);
}
```

## Geo-Based Routing

> **Note:** Geo-location features (`client.geo.*`) are not yet implemented in Fastly.JS. The example below shows the standard Fastly VCL syntax for reference.

Geo-based routing directs requests to different backends based on the client's geographic location:

```vcl
sub vcl_recv {
  # Route US traffic to the US backend
  if (client.geo.country_code == "US") {
    set req.backend = server1;
  }
  # Route European traffic to the EU backend
  else if (client.geo.continent_code == "EU") {
    set req.backend = server2;
  }
  # Route everything else to the global backend
  else {
    set req.backend = server3;
  }
  
  return(lookup);
}
```

## Fallback Backends

You can implement fallback backends to handle cases where the primary backend is unavailable:

```vcl
sub vcl_fetch {
  # If the backend returns a 5xx error, try a different backend
  if (beresp.status >= 500 && beresp.status < 600) {
    # Retry the request with a different backend
    if (req.backend == server1) {
      set req.backend = server2;
      return(retry);
    }
    else if (req.backend == server2) {
      set req.backend = server3;
      return(retry);
    }
  }
  
  return(deliver);
}
```

## Complete Example

Here's a complete example that combines several load balancing strategies:

```vcl
# Define backend servers
backend server1 {
  .host = "api.example.com";
  .port = "80";
}

backend server2 {
  .host = "static.example.com";
  .port = "80";
}

backend server3 {
  .host = "www.example.com";
  .port = "80";
}

# Define a director for API load balancing
std.director.add("api_director", "weighted");
std.director.add_backend("api_director", "server1", 3);

# Define a director for static content load balancing
std.director.add("static_director", "round-robin");
std.director.add_backend("static_director", "server2", 1);

# Define a director for default content load balancing
std.director.add("default_director", "random");
std.director.add_backend("default_director", "server3", 1);

sub vcl_recv {
  # Route based on content type
  if (req.url ~ "^/api/") {
    # Use the API director for API requests
    set req.backend = std.director.select_backend("api_director").name;
    set req.http.X-Backend-Type = "API";
  }
  else if (req.url ~ "\.(jpg|jpeg|png|gif|css|js)$") {
    # Use the static director for static content
    set req.backend = std.director.select_backend("static_director").name;
    set req.http.X-Backend-Type = "Static";
  }
  else {
    # Use the default director for everything else
    set req.backend = std.director.select_backend("default_director").name;
    set req.http.X-Backend-Type = "Default";
  }
  
  # Add custom headers for debugging
  set req.http.X-Selected-Backend = req.backend;
  
  return(lookup);
}

sub vcl_fetch {
  # If the backend returns a 5xx error, try a different backend
  if (beresp.status >= 500 && beresp.status < 600) {
    # Retry the request with a different backend based on the current backend type
    if (req.http.X-Backend-Type == "API") {
      set req.backend = server3;  # Fallback to the default backend
      return(retry);
    }
    else if (req.http.X-Backend-Type == "Static") {
      set req.backend = server3;  # Fallback to the default backend
      return(retry);
    }
  }
  
  return(deliver);
}

sub vcl_deliver {
  # Add backend information to the response
  set resp.http.X-Backend = req.http.X-Selected-Backend;
  set resp.http.X-Backend-Type = req.http.X-Backend-Type;
  
  # Remove internal headers
  unset resp.http.X-Selected-Backend;
  unset resp.http.X-Backend-Type;
  
  return(deliver);
}
```

## Running the Example

Save the above VCL to a file named `load-balancing.vcl` and run it with Fastly.JS:

```bash
bun run index.ts load-balancing.vcl
```

This will start a local HTTP proxy server that applies the load balancing rules to all requests.

## Conclusion

Load balancing is a critical aspect of web application architecture. With Fastly.JS, you can test and develop load balancing strategies locally before deploying them to your production Fastly service.

For more information on the VCL functions used in this example, see the [VCL Functions Reference](../reference/vcl-functions.md).
