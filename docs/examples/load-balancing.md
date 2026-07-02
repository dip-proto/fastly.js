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

## Director types

A director is declared with `director <name> <type> { ... }` and supports five
types: `random`, `hash`, `client`, `fallback`, and `chash`. To send traffic
through a director, assign it to `req.backend` just like a plain backend.
Round-robin behaviour is achieved by giving every backend the same weight in a
`random` director; weighted balancing is the same idea with non-uniform weights.

## Random / round-robin balancing

Equal weights yield (statistically) uniform distribution across backends:

```vcl
# A director that picks backends uniformly at random.
# Equal weights make this equivalent to round-robin.
director balanced_director random {
  { .backend = server1; .weight = 1; }
  { .backend = server2; .weight = 1; }
  { .backend = server3; .weight = 1; }
}

sub vcl_recv {
  # Route the request through the director
  set req.backend = balanced_director;

  return(lookup);
}
```

## Weighted load balancing

To bias traffic towards specific backends, vary the per-backend weight:

```vcl
# A weighted random director
director weighted_director random {
  { .backend = server1; .weight = 3; }  # 3x weight
  { .backend = server2; .weight = 2; }  # 2x weight
  { .backend = server3; .weight = 1; }  # 1x weight
}

sub vcl_recv {
  # Route the request through the director
  set req.backend = weighted_director;

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

# A director over the health-checked backends. Backends marked
# unhealthy are skipped when the director picks a target.
director health_director random {
  { .backend = server1; .weight = 1; }
  { .backend = server2; .weight = 1; }
}

sub vcl_recv {
  # Route the request through the director
  set req.backend = health_director;
  
  return(lookup);
}
```

> **Note:** Probe blocks are parsed and stored, but Fastly.JS does not actively run health checks yet — backends stay healthy unless something marks them otherwise (for example through the `std.backend` API). Directors do honor the health flag when selecting a backend.

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

> **Note:** The `client.geo.*` variables exist in Fastly.JS but there is no geolocation database behind them: string fields read `"unknown"`, so every request would fall through to the final `else` branch below. The example shows the standard Fastly VCL syntax for reference.

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

Fastly VCL retries a failing origin by restarting the request, but Fastly.JS does not yet support retrying the backend fetch from `vcl_fetch` — there is no `return(retry)`, and a `restart` issued after the fetch is not acted on. What you get instead is built into the bundled proxy: when a backend answers with a 5xx, `index.ts` automatically retries the request once through its fallback director.

A `fallback` director is the declarative way to express the same idea — it always picks the first healthy backend in its list:

```vcl
# Prefer server1; use server2 only if server1 is marked unhealthy
director failover_director fallback {
  { .backend = server1; .weight = 1; }
  { .backend = server2; .weight = 1; }
}

sub vcl_recv {
  set req.backend = failover_director;
  
  return(lookup);
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

# A director for API load balancing (weighted random selection)
director api_director random {
  { .backend = server1; .weight = 3; }
}

# A director for static content load balancing
director static_director random {
  { .backend = server2; .weight = 1; }
}

# A director for default content load balancing
director default_director random {
  { .backend = server3; .weight = 1; }
}

sub vcl_recv {
  # Route based on content type
  if (req.url ~ "^/api/") {
    # Use the API director for API requests
    set req.backend = api_director;
    set req.http.X-Backend-Type = "API";
  }
  else if (req.url ~ "\.(jpg|jpeg|png|gif|css|js)$") {
    # Use the static director for static content
    set req.backend = static_director;
    set req.http.X-Backend-Type = "Static";
  }
  else {
    # Use the default director for everything else
    set req.backend = default_director;
    set req.http.X-Backend-Type = "Default";
  }
  
  # Add custom headers for debugging
  set req.http.X-Selected-Backend = req.backend;
  
  return(lookup);
}

sub vcl_fetch {
  # Tag 5xx responses so the failure is visible downstream. Retrying
  # from vcl_fetch is not supported; the bundled proxy already retries
  # 5xx responses once through its fallback director.
  if (beresp.status >= 500 && beresp.status < 600) {
    set beresp.http.X-Backend-Failed = req.http.X-Backend-Type;
  }
  
  return(deliver);
}

sub vcl_deliver {
  # Add backend information to the response
  set resp.http.X-Backend = req.http.X-Selected-Backend;
  set resp.http.X-Backend-Type = req.http.X-Backend-Type;
  
  return(deliver);
}
```

## Running the Example

Save the above VCL to a file named `load-balancing.vcl` and run it with Fastly.JS:

```bash
bun run index.ts load-balancing.vcl
```

This will start a local HTTP proxy server. One caveat: the bundled proxy in `index.ts` currently performs its own origin selection with a built-in set of backends and directors, so while the VCL routing logic above executes (and its headers show up), the origin actually contacted is chosen by `index.ts`, not by `set req.backend`. The VCL-level backend and director declarations are fully exercised by the test framework and the browser simulator.

## Conclusion

Load balancing is a critical aspect of web application architecture. With Fastly.JS, you can test and develop load balancing strategies locally before deploying them to your production Fastly service.

For more information on the VCL functions used in this example, see the [VCL Functions Reference](../reference/vcl-functions.md).
