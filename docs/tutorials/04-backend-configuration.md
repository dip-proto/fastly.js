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

Fastly.JS parses all of these properties, but only `host`, `port`, and `ssl` affect how requests are sent. The timeout and connection-limit values are stored on the backend object and are not currently enforced by the proxy.

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

backend origin {
  .host = "www.example.com";
  .port = "443";
  .ssl = true;
  .connect_timeout = 1s;
  .first_byte_timeout = 15s;
  .between_bytes_timeout = 10s;
  .max_connections = 200;
}
```

Note that the catch-all backend here is named `origin` rather than `default`: `default` is a reserved keyword in expressions (it is used by switch statements), so a backend with that name cannot be assigned with `set req.backend = default;`.

## Routing Requests to Backends

You can route requests to different backends based on various criteria. (Note: the bundled proxy in `index.ts` configures its own demo backends and selects among them in JavaScript, ignoring `req.backend`; the examples below apply when your own code lets the VCL drive backend selection.)

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
  # Route all other requests to the catch-all backend
  else {
    set req.backend = origin;
  }
}
```

### Routing Based on Host Header

```vcl
sub vcl_recv {
  # Route requests based on the Host header
  if (req.http.host == "api.example.com") {
    set req.backend = api;
  }
  else if (req.http.host == "static.example.com") {
    set req.backend = static;
  }
  else {
    set req.backend = origin;
  }
}
```

### Routing Based on Cookie

```vcl
sub vcl_recv {
  # Route requests based on a cookie
  if (req.http.cookie ~ "backend=api") {
    set req.backend = api;
  }
  else if (req.http.cookie ~ "backend=static") {
    set req.backend = static;
  }
  else {
    set req.backend = origin;
  }
}
```

## Health Checks

Health checks describe how the health of a backend server should be probed, so that requests can avoid unhealthy backends.

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

Probe definitions are parsed and stored on the backend, but Fastly.JS does not currently run active health checks. Every backend reports as healthy unless it is marked unhealthy programmatically through the JavaScript API.

### Checking Backend Health

You can check if a backend is healthy using the `backend.{name}.healthy` variable:

```vcl
sub vcl_recv {
  # Check if the API backend is healthy
  if (backend.api.healthy) {
    set req.backend = api;
  }
  # Fall back to the catch-all backend if the API backend is unhealthy
  else {
    set req.backend = origin;
  }
}
```

There is also a `std.backend.is_healthy()` function, but it expects the backend name as a string (for example `std.backend.is_healthy(req.backend)`); passing a bare backend identifier does not work.

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
- **hash**: Selects a backend based on the cache hash key
- **client**: Selects a backend based on the client identity
- **fallback**: Tries backends in order until a healthy one is found
- **chash**: Consistent hashing (currently behaves like `hash`)

Regardless of type, a director is used by assigning it to `req.backend`; there is no `.backend()` method syntax:

```vcl
sub vcl_recv {
  set req.backend = api_director;
}
```

### Random Director

A random director selects a backend randomly based on weights:

```vcl
director api_director random {
  .quorum = 50%;
  { .backend = api1; .weight = 3; }  # 3/6 = 50% of requests
  { .backend = api2; .weight = 2; }  # 2/6 = 33% of requests
  { .backend = api3; .weight = 1; }  # 1/6 = 17% of requests
}

sub vcl_recv {
  set req.backend = api_director;
}
```

### Hash Director

A hash director selects a backend based on the cache hash key (the data collected with `hash_data()` in `vcl_hash`):

```vcl
director api_director hash {
  { .backend = api1; .weight = 1; }
  { .backend = api2; .weight = 1; }
  { .backend = api3; .weight = 1; }
}

sub vcl_recv {
  set req.backend = api_director;
}
```

### Client Director

A client director selects a backend based on the client identity. Fastly.JS derives the identity from the `X-Client-Identity` request header, falling back to the `Cookie` header:

```vcl
director api_director client {
  { .backend = api1; .weight = 1; }
  { .backend = api2; .weight = 1; }
  { .backend = api3; .weight = 1; }
}

sub vcl_recv {
  set req.backend = api_director;
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
  set req.backend = api_director;
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

Only `.ssl` changes behavior (it selects `https` for backend requests, and a port of 443 implies it). The certificate-related properties are accepted for compatibility with Fastly VCL but are ignored.

### Connection Pooling

You can declare connection pool settings for a backend:

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

As noted above, these values are parsed and stored but not currently enforced; connections are managed by the underlying `fetch` implementation.

### Request Retries

Per-backend retry settings are not supported. The bundled proxy retries a request against the `fallback_director` when a backend returns a 5xx response, but this is configured in JavaScript (`index.ts`), not in VCL.

## Next Steps

Now that you understand backend configuration in VCL, you can move on to the next tutorial: [Error Handling](./05-error-handling.md).
