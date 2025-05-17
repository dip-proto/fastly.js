# Backend Configuration in VCL

This tutorial covers how to configure backends in VCL, including defining multiple backends, health checks, and load balancing.

## What is a Backend?

A backend is an origin server that Fastly.JS proxies requests to. You can define multiple backends in your VCL configuration and route requests to different backends based on various criteria.

## Defining a Backend

You can define a backend using the `backend` directive:

```vcl
backend default {
  .host = "example.com";
  .port = "80";
  .ssl = false;
  .connect_timeout = 1s;
  .first_byte_timeout = 15s;
  .between_bytes_timeout = 10s;
  .max_connections = 200;
}
```

### Backend Properties

- **host**: The hostname or IP address of the backend server
- **port**: The port number of the backend server
- **ssl**: Whether to use SSL/TLS to connect to the backend
- **connect_timeout**: How long to wait for a connection to the backend
- **first_byte_timeout**: How long to wait for the first byte of the response
- **between_bytes_timeout**: How long to wait between bytes of the response
- **max_connections**: The maximum number of connections to the backend

## Defining Multiple Backends

You can define multiple backends in your VCL configuration:

```vcl
backend api {
  .host = "api.example.com";
  .port = "443";
  .ssl = true;
  .connect_timeout = 1s;
  .first_byte_timeout = 15s;
  .between_bytes_timeout = 10s;
  .max_connections = 200;
}

backend static {
  .host = "static.example.com";
  .port = "443";
  .ssl = true;
  .connect_timeout = 1s;
  .first_byte_timeout = 15s;
  .between_bytes_timeout = 10s;
  .max_connections = 200;
}

backend default {
  .host = "www.example.com";
  .port = "443";
  .ssl = true;
  .connect_timeout = 1s;
  .first_byte_timeout = 15s;
  .between_bytes_timeout = 10s;
  .max_connections = 200;
}
```

## Routing Requests to Backends

You can route requests to different backends based on various criteria:

### Routing Based on URL Path

```vcl
sub vcl_recv {
  # Route API requests to the API backend
  if (req.url ~ "^/api/") {
    set req.backend = api;
  }
  # Route static content requests to the static backend
  else if (req.url ~ "^/static/" || req.url ~ "\.(jpg|jpeg|png|gif|ico|css|js)$") {
    set req.backend = static;
  }
  # Route all other requests to the default backend
  else {
    set req.backend = default;
  }
}
```

### Routing Based on Host Header

```vcl
sub vcl_recv {
  # Route requests based on the Host header
  if (req.http.Host == "api.example.com") {
    set req.backend = api;
  }
  else if (req.http.Host == "static.example.com") {
    set req.backend = static;
  }
  else {
    set req.backend = default;
  }
}
```

### Routing Based on Cookie

```vcl
sub vcl_recv {
  # Route requests based on a cookie
  if (req.http.Cookie ~ "backend=api") {
    set req.backend = api;
  }
  else if (req.http.Cookie ~ "backend=static") {
    set req.backend = static;
  }
  else {
    set req.backend = default;
  }
}
```

## Health Checks

Health checks allow Fastly.JS to monitor the health of backend servers and avoid sending requests to unhealthy backends.

### Defining Health Checks

You can define health checks for a backend:

```vcl
backend api {
  .host = "api.example.com";
  .port = "443";
  .ssl = true;
  .probe = {
    .url = "/health";
    .timeout = 1s;
    .interval = 5s;
    .window = 5;
    .threshold = 3;
  }
}
```

### Health Check Properties

- **url**: The URL to request for the health check
- **timeout**: How long to wait for a response
- **interval**: How often to perform the health check
- **window**: The number of health checks to consider
- **threshold**: The number of successful health checks required to mark the backend as healthy

### Checking Backend Health

You can check if a backend is healthy using the `std.backend.is_healthy` function:

```vcl
sub vcl_recv {
  # Check if the API backend is healthy
  if (std.backend.is_healthy(api)) {
    set req.backend = api;
  }
  # Fall back to the default backend if the API backend is unhealthy
  else {
    set req.backend = default;
  }
}
```

## Load Balancing with Directors

Directors allow you to distribute requests across multiple backends for load balancing.

### Defining a Director

You can define a director using the `director` directive:

```vcl
director api_director random {
  .quorum = 50%;
  { .backend = api1; .weight = 1; }
  { .backend = api2; .weight = 1; }
  { .backend = api3; .weight = 1; }
}
```

### Director Types

Fastly.JS supports the following director types:

- **random**: Randomly selects a backend based on weights
- **hash**: Selects a backend based on a hash of a request attribute
- **client**: Selects a backend based on the client IP address
- **fallback**: Tries backends in order until a healthy one is found

### Random Director

A random director selects a backend randomly based on weights:

```vcl
director api_director random {
  .quorum = 50%;
  { .backend = api1; .weight = 3; }  # 3/6 = 50% of requests
  { .backend = api2; .weight = 2; }  # 2/6 = 33% of requests
  { .backend = api3; .weight = 1; }  # 1/6 = 17% of requests
}
```

### Hash Director

A hash director selects a backend based on a hash of a request attribute:

```vcl
director api_director hash {
  { .backend = api1; .weight = 1; }
  { .backend = api2; .weight = 1; }
  { .backend = api3; .weight = 1; }
}

sub vcl_recv {
  # Use the URL as the hash key
  set req.backend = api_director.backend(req.url);
}
```

### Client Director

A client director selects a backend based on the client IP address:

```vcl
director api_director client {
  { .backend = api1; .weight = 1; }
  { .backend = api2; .weight = 1; }
  { .backend = api3; .weight = 1; }
}

sub vcl_recv {
  # Use the client IP as the hash key
  set req.backend = api_director.backend();
}
```

### Fallback Director

A fallback director tries backends in order until a healthy one is found:

```vcl
director api_director fallback {
  { .backend = api1; }  # Try this backend first
  { .backend = api2; }  # If api1 is unhealthy, try this backend
  { .backend = api3; }  # If api1 and api2 are unhealthy, try this backend
}

sub vcl_recv {
  # Use the fallback director
  set req.backend = api_director.backend();
}
```

## Advanced Backend Configuration

### SSL/TLS Configuration

You can configure SSL/TLS for a backend:

```vcl
backend api {
  .host = "api.example.com";
  .port = "443";
  .ssl = true;
  .ssl_cert_hostname = "api.example.com";
  .ssl_sni_hostname = "api.example.com";
  .ssl_check_cert = always;
}
```

### Connection Pooling

You can configure connection pooling for a backend:

```vcl
backend api {
  .host = "api.example.com";
  .port = "443";
  .ssl = true;
  .max_connections = 200;
  .first_byte_timeout = 15s;
  .between_bytes_timeout = 10s;
  .connect_timeout = 1s;
}
```

### Request Retries

You can configure request retries for a backend:

```vcl
backend api {
  .host = "api.example.com";
  .port = "443";
  .ssl = true;
  .max_retries = 3;
  .retry_interval = 1s;
}
```

## Next Steps

Now that you understand backend configuration in VCL, you can move on to the next tutorial: [Error Handling](./05-error-handling.md).
