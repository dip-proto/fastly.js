# Backend Configuration in Fastly VCL

## Introduction

Backends in Fastly VCL represent origin servers that Fastly can fetch content from. Proper backend configuration is crucial for ensuring reliability, performance, and fault tolerance in your Fastly service.

This document covers how to configure backends, set up health checks, and implement load balancing using directors.

## Basic Backend Configuration

A backend in Fastly VCL is defined using the `backend` keyword, followed by a name and a block of configuration parameters:

```vcl
backend F_my_origin {
    .host = "www.example.com";
    .port = "443";
    .ssl = true;
}
```

### Common Backend Parameters

| Parameter | Description | Default |
|-----------|-------------|---------|
| `.host` | The hostname or IP address of the backend | Required |
| `.port` | The port to connect to | 80 |
| `.ssl` | Whether to use SSL/TLS for the connection | false |
| `.ssl_cert_hostname` | The hostname to use for SSL certificate validation | Value of `.host` |
| `.ssl_sni_hostname` | The hostname to use for SSL SNI | Value of `.host` |
| `.ssl_check_cert` | Whether to validate the SSL certificate | true |
| `.min_tls_version` | Minimum TLS version to use | TLSv1.2 |
| `.max_tls_version` | Maximum TLS version to use | TLSv1.3 |
| `.connect_timeout` | Timeout for establishing a connection | 1s |
| `.first_byte_timeout` | Timeout for receiving the first byte of the response | 15s |
| `.between_bytes_timeout` | Timeout between bytes of the response | 10s |
| `.max_connections` | Maximum number of connections to the backend | 200 |
| `.weight` | Weight for load balancing | 100 |
| `.override_host` | Override the Host header sent to the backend | None |
| `.auto_loadbalance` | Whether to automatically load balance | false |
| `.shield` | POP to use as a shield | None |

### Example: Basic HTTPS Backend

```vcl
backend F_my_origin {
    .host = "www.example.com";
    .port = "443";
    .ssl = true;
    .ssl_cert_hostname = "www.example.com";
    .ssl_sni_hostname = "www.example.com";
    .ssl_check_cert = true;
    .min_tls_version = "TLSv1.2";
    .max_tls_version = "TLSv1.3";
    .connect_timeout = 1s;
    .first_byte_timeout = 15s;
    .between_bytes_timeout = 10s;
}
```

### Example: Backend with Custom Timeouts

```vcl
backend F_slow_origin {
    .host = "api.example.com";
    .port = "443";
    .ssl = true;
    .connect_timeout = 5s;
    .first_byte_timeout = 30s;
    .between_bytes_timeout = 20s;
}
```

## Health Checks

Health checks monitor the availability and responsiveness of your backends. Fastly periodically sends requests to your backends and checks the responses to determine if they are healthy.

Health checks are defined using the `.probe` parameter in a backend definition:

```vcl
backend F_my_origin {
    .host = "www.example.com";
    .port = "443";
    .ssl = true;
    .probe = {
        .request = "HEAD / HTTP/1.1" "Host: www.example.com" "Connection: close";
        .expected_response = 200;
        .interval = 5s;
        .timeout = 2s;
        .window = 5;
        .threshold = 3;
        .initial = 2;
    }
}
```

### Health Check Parameters

| Parameter | Description | Default |
|-----------|-------------|---------|
| `.request` | The HTTP request to send | Required if not using `.url` |
| `.url` | The URL path to request (alternative to `.request`) | "/" |
| `.expected_response` | The expected HTTP status code | 200 |
| `.interval` | How often to send health checks | 5s |
| `.timeout` | Timeout for health check requests | 2s |
| `.window` | Number of most recent health checks to consider | 5 |
| `.threshold` | Number of checks that must succeed for the backend to be considered healthy | 3 |
| `.initial` | Number of checks to assume as successful when VCL is first loaded | 2 |
| `.dummy` | If true, only perform DNS resolution for dynamic hostnames | false |

### Example: Custom Health Check Path

```vcl
backend F_my_origin {
    .host = "www.example.com";
    .port = "443";
    .ssl = true;
    .probe = {
        .request = "HEAD /health HTTP/1.1" "Host: www.example.com" "Connection: close";
        .expected_response = 200;
        .interval = 10s;
        .timeout = 5s;
        .window = 8;
        .threshold = 5;
        .initial = 3;
    }
}
```

### Example: Health Check with Authentication

```vcl
backend F_secure_origin {
    .host = "api.example.com";
    .port = "443";
    .ssl = true;
    .probe = {
        .request = "HEAD /health HTTP/1.1" 
                   "Host: api.example.com" 
                   "Authorization: Bearer health-check-token" 
                   "Connection: close";
        .expected_response = 200;
        .interval = 15s;
        .timeout = 5s;
        .window = 5;
        .threshold = 3;
    }
}
```

## Directors

Directors in Fastly VCL are used to group backends and implement load balancing strategies. Fastly supports several types of directors, each with its own load balancing algorithm.

### Random Director

The random director selects a backend randomly from the healthy subset of backends:

```vcl
director F_random_director random {
    .quorum = 50%;
    .retries = 3;
    { .backend = F_origin1; .weight = 1; }
    { .backend = F_origin2; .weight = 2; }
    { .backend = F_origin3; .weight = 1; }
}
```

In this example, `F_origin2` has twice the probability of being selected compared to the other backends.

### Hash Director

The hash director selects backends based on the cache key of the content being requested:

```vcl
director F_hash_director hash {
    .quorum = 50%;
    .retries = 3;
    { .backend = F_origin1; .weight = 1; }
    { .backend = F_origin2; .weight = 1; }
    { .backend = F_origin3; .weight = 1; }
}
```

This ensures that requests for the same content always go to the same backend, which can improve cache efficiency.

### Client Director

The client director selects a backend based on the identity of the client:

```vcl
director F_client_director client {
    .quorum = 50%;
    .retries = 3;
    { .backend = F_origin1; .weight = 1; }
    { .backend = F_origin2; .weight = 1; }
    { .backend = F_origin3; .weight = 1; }
}

sub vcl_recv {
    set client.identity = req.http.Cookie:user_id;
    set req.backend = F_client_director;
}
```

This ensures that requests from the same client always go to the same backend, which can be useful for maintaining session state.

### Fallback Director

The fallback director always selects the first healthy backend in its list:

```vcl
director F_fallback_director fallback {
    { .backend = F_primary; }
    { .backend = F_secondary; }
    { .backend = F_tertiary; }
}
```

This is useful for implementing a primary/backup strategy, where the secondary backend is only used if the primary is unhealthy.

### Chash Director

The chash (consistent hash) director uses consistent hashing to distribute requests among backends:

```vcl
director F_chash_director chash {
    .key = object;
    .seed = 0;
    .vnodes_per_node = 256;
    .quorum = 50%;
    { .backend = F_origin1; .id = "origin1"; .weight = 1; }
    { .backend = F_origin2; .id = "origin2"; .weight = 1; }
    { .backend = F_origin3; .id = "origin3"; .weight = 1; }
}
```

Consistent hashing minimizes the redistribution of requests when backends are added or removed, which can improve cache efficiency.

## Director Parameters

### Common Parameters

| Parameter | Description | Default |
|-----------|-------------|---------|
| `.quorum` | Percentage of healthy backends required for the director to be considered healthy | 0% |
| `.retries` | Number of times to retry selecting a backend if the first attempt fails | Number of backends |

### Chash Director Parameters

| Parameter | Description | Default |
|-----------|-------------|---------|
| `.key` | What to hash on: `object` (cache key) or `client` (client identity) | `object` |
| `.seed` | Starting seed for the hash function | 0 |
| `.vnodes_per_node` | Number of virtual nodes per backend | 256 |

## Using Directors in VCL

To use a director, assign it to `req.backend` in `vcl_recv`:

```vcl
sub vcl_recv {
    # Route API requests to a dedicated director
    if (req.url ~ "^/api/") {
        set req.backend = F_api_director;
    }
    # Route static content to a different director
    else if (req.url ~ "\.(jpg|jpeg|png|gif|css|js)$") {
        set req.backend = F_static_director;
    }
    # Default director for everything else
    else {
        set req.backend = F_default_director;
    }
}
```

## Advanced Backend Selection

### Content-Based Routing

You can route requests to different backends based on the content being requested:

```vcl
sub vcl_recv {
    # Route requests based on path
    if (req.url ~ "^/api/v1/") {
        set req.backend = F_api_v1;
    }
    else if (req.url ~ "^/api/v2/") {
        set req.backend = F_api_v2;
    }
    else if (req.url ~ "^/images/") {
        set req.backend = F_image_server;
    }
    else if (req.url ~ "^/videos/") {
        set req.backend = F_video_server;
    }
    else {
        set req.backend = F_default;
    }
}
```

### Geolocation-Based Routing

You can route requests to different backends based on the client's location:

```vcl
sub vcl_recv {
    # Route requests based on country
    if (client.geo.country_code == "US") {
        set req.backend = F_us_backend;
    }
    else if (client.geo.country_code == "CA") {
        set req.backend = F_ca_backend;
    }
    else if (client.geo.continent_code == "EU") {
        set req.backend = F_eu_backend;
    }
    else {
        set req.backend = F_global_backend;
    }
}
```

### A/B Testing

You can implement A/B testing by routing a percentage of requests to different backends:

```vcl
sub vcl_recv {
    # Determine which variant to use (10% to variant B)
    declare local var.rand INTEGER;
    set var.rand = randomint(1, 10);
    
    if (var.rand == 1) {
        set req.backend = F_variant_b;
        set req.http.X-Variant = "B";
    }
    else {
        set req.backend = F_variant_a;
        set req.http.X-Variant = "A";
    }
}
```

### Dynamic Backend Selection

You can dynamically select backends based on request headers or other attributes:

```vcl
sub vcl_recv {
    # Select backend based on a custom header
    if (req.http.X-Backend) {
        if (req.http.X-Backend == "api") {
            set req.backend = F_api_backend;
        }
        else if (req.http.X-Backend == "web") {
            set req.backend = F_web_backend;
        }
        else if (req.http.X-Backend == "mobile") {
            set req.backend = F_mobile_backend;
        }
        else {
            set req.backend = F_default_backend;
        }
    }
    else {
        set req.backend = F_default_backend;
    }
}
```

## Best Practices

1. **Use Health Checks**: Always configure health checks for your backends to ensure that Fastly only sends requests to healthy backends.

2. **Set Appropriate Timeouts**: Configure timeouts based on the expected response time of your backends. Set longer timeouts for backends that may take longer to respond.

3. **Implement Fallbacks**: Use directors to implement fallback strategies for when backends are unhealthy.

4. **Consider Cache Efficiency**: Choose a director type that maximizes cache efficiency for your use case. For example, use a hash director for content that should be consistently served from the same backend.

5. **Monitor Backend Health**: Use Fastly's logging and monitoring features to track the health of your backends and identify issues early.

6. **Test Failover Scenarios**: Regularly test how your service behaves when backends fail to ensure that your fallback strategies work as expected.

7. **Document Your Backend Configuration**: Keep documentation of your backend configuration, including the purpose of each backend and director.

In the next section, we'll explore caching strategies in Fastly VCL.