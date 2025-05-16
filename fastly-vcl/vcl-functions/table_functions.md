# Table Functions

This file demonstrates comprehensive examples of Table Functions in VCL.
These functions help work with Edge Dictionaries (tables) for dynamic configuration,
feature flags, access control, and other use cases requiring key-value lookups.

## table.lookup

Looks up a key in a table and returns its value as a string.

### Syntax

```vcl
STRING table.lookup(STRING table_name, STRING key [, STRING default])
```

### Parameters

- `table_name`: The name of the table to look up in
- `key`: The key to look up
- `default`: Optional default value to return if the key is not found

### Return Value

The value associated with the key, or the default value if provided, or an empty string

### Examples

#### Basic table lookup

```vcl
declare local var.country_code STRING;
declare local var.country_name STRING;

# Get the country code from the client's geolocation
set var.country_code = client.geo.country_code;

# Look up the full country name in a country codes table
set var.country_name = table.lookup(country_codes, var.country_code, "Unknown Country");

# Set the country name in a header
set req.http.X-Country-Name = var.country_name;
```

#### Feature flags

```vcl
declare local var.feature_enabled STRING;

# Look up a feature flag in a features table
set var.feature_enabled = table.lookup(features, "new_checkout", "false");

# Enable the feature if the flag is set to "true"
if (var.feature_enabled == "true") {
  set req.http.X-New-Checkout = "enabled";
} else {
  set req.http.X-New-Checkout = "disabled";
}
#### API key validation

```vcl
declare local var.api_key STRING;
declare local var.api_key_valid STRING;

# Get the API key from the request header
set var.api_key = req.http.X-API-Key;

# Check if the API key exists in the valid_api_keys table
set var.api_key_valid = table.lookup(valid_api_keys, var.api_key);

if (var.api_key_valid == "") {
  # API key not found in the table
  error 401 "Invalid API Key";
}
```

#### URL redirects

```vcl
declare local var.redirect_url STRING;

# Look up the redirect URL for the current path
set var.redirect_url = table.lookup(redirects, req.url.path);

if (var.redirect_url != "") {
  # Redirect to the new URL
  error 301 "Moved Permanently";
  set resp.http.Location = var.redirect_url;
}
```

#### A/B testing configuration

```vcl
declare local var.test_config STRING;
declare local var.test_percentage STRING;

# Look up the A/B test configuration
set var.test_config = table.lookup(ab_tests, "checkout_test");

if (var.test_config != "") {
  # Parse the test percentage from the configuration
  if (var.test_config ~ "^percentage=([0-9]+)") {
    set var.test_percentage = re.group.1;
    set req.http.X-AB-Test-Percentage = var.test_percentage;
  }
}
```

## table.lookup_bool

Looks up a key in a table and returns its value as a boolean.

### Syntax

```vcl
BOOL table.lookup_bool(STRING table_name, STRING key [, BOOL default])
```

### Parameters

- `table_name`: The name of the table to look up in
- `key`: The key to look up
- `default`: Optional default value to return if the key is not found

### Return Value

The value associated with the key as a boolean, or the default value if provided, or false

### Examples

#### Feature flags with boolean return

```vcl
declare local var.feature_enabled BOOL;

# Look up a feature flag in a features table
set var.feature_enabled = table.lookup_bool(features, "new_checkout", false);

# Enable the feature if the flag is true
if (var.feature_enabled) {
  set req.http.X-New-Checkout = "enabled";
} else {
  set req.http.X-New-Checkout = "disabled";
}
```

#### Environment-specific settings

```vcl
declare local var.is_production BOOL;

# Check if this is the production environment
set var.is_production = table.lookup_bool(environment, "is_production", false);

if (var.is_production) {
  # Apply production-specific settings
  set req.http.X-Environment = "production";
} else {
  # Apply non-production settings
  set req.http.X-Environment = "development";
}
```
#### User permissions

```vcl
declare local var.user_id STRING;
declare local var.is_admin BOOL;

# Get user ID from a cookie or header
set var.user_id = req.http.Cookie:user_id;

# Check if the user is an admin
set var.is_admin = table.lookup_bool(user_permissions, var.user_id + ":admin", false);

if (var.is_admin) {
  # Allow access to admin features
  set req.http.X-Is-Admin = "true";
} else {
  # Restrict access to admin features
  set req.http.X-Is-Admin = "false";
}
```

#### Feature toggles with default values

```vcl
declare local var.debug_enabled BOOL;
declare local var.metrics_enabled BOOL;
declare local var.logging_enabled BOOL;

# Look up feature toggles with default values
set var.debug_enabled = table.lookup_bool(toggles, "debug", false);
set var.metrics_enabled = table.lookup_bool(toggles, "metrics", true);
set var.logging_enabled = table.lookup_bool(toggles, "logging", true);

# Set headers based on toggles
set req.http.X-Debug-Enabled = if(var.debug_enabled, "true", "false");
set req.http.X-Metrics-Enabled = if(var.metrics_enabled, "true", "false");
set req.http.X-Logging-Enabled = if(var.logging_enabled, "true", "false");
```

#### Path-specific settings

```vcl
declare local var.path_segment STRING;
declare local var.cache_enabled BOOL;

# Extract the first path segment
if (req.url.path ~ "^/([^/]+)") {
  set var.path_segment = re.group.1;
  
  # Check if caching is enabled for this path
  set var.cache_enabled = table.lookup_bool(path_settings, var.path_segment + ":cache", true);
  
  if (!var.cache_enabled) {
    # Disable caching for this path
    set req.http.X-Cache-Enabled = "false";
  }
}
```

## table.lookup_integer

Looks up a key in a table and returns its value as an integer.

### Syntax

```vcl
INTEGER table.lookup_integer(STRING table_name, STRING key [, INTEGER default])
```

### Parameters

- `table_name`: The name of the table to look up in
- `key`: The key to look up
- `default`: Optional default value to return if the key is not found

### Return Value

The value associated with the key as an integer, or the default value if provided, or 0

### Examples

#### Rate limits

```vcl
declare local var.rate_limit INTEGER;

# Look up the rate limit for the current path
if (req.url.path ~ "^/api/([^/]+)") {
  # Get the rate limit for this API endpoint
  set var.rate_limit = table.lookup_integer(rate_limits, re.group.1, 100);
  
  # Set the rate limit in a header
  set req.http.X-Rate-Limit = var.rate_limit;
}
```

#### Cache TTL configuration

```vcl
declare local var.cache_ttl INTEGER;

# Look up the cache TTL for the content type
if (req.http.Content-Type) {
  set var.cache_ttl = table.lookup_integer(cache_ttls, req.http.Content-Type, 3600);
  
  # Set the cache TTL in a header
  set req.http.X-Cache-TTL = var.cache_ttl;
}
```
#### A/B test percentage

```vcl
declare local var.test_name STRING;
declare local var.test_percentage INTEGER;

set var.test_name = "checkout_redesign";

# Look up the test percentage
set var.test_percentage = table.lookup_integer(ab_test_percentages, var.test_name, 0);

# Set the test percentage in a header
set req.http.X-AB-Test-Percentage = var.test_percentage;
```

#### Backend weights

```vcl
declare local var.backend_name STRING;
declare local var.backend_weight INTEGER;

set var.backend_name = "api_server";

# Look up the backend weight
set var.backend_weight = table.lookup_integer(backend_weights, var.backend_name, 100);

# Use the weight for load balancing decisions
set req.http.X-Backend-Weight = var.backend_weight;
```

#### User quotas

```vcl
declare local var.user_id STRING;
declare local var.user_quota INTEGER;

# Get user ID from a cookie or header
set var.user_id = req.http.Cookie:user_id;

# Look up the user's quota
set var.user_quota = table.lookup_integer(user_quotas, var.user_id, 1000);

# Set the user's quota in a header
set req.http.X-User-Quota = var.user_quota;
```

## table.lookup_float

Looks up a key in a table and returns its value as a float.

### Syntax

```vcl
FLOAT table.lookup_float(STRING table_name, STRING key [, FLOAT default])
```

### Parameters

- `table_name`: The name of the table to look up in
- `key`: The key to look up
- `default`: Optional default value to return if the key is not found

### Return Value

The value associated with the key as a float, or the default value if provided, or 0.0

### Examples

#### Pricing multipliers

```vcl
declare local var.country_code STRING;
declare local var.price_multiplier FLOAT;

# Get the country code from the client's geolocation
set var.country_code = client.geo.country_code;

# Look up the price multiplier for this country
set var.price_multiplier = table.lookup_float(price_multipliers, var.country_code, 1.0);

# Set the price multiplier in a header
set req.http.X-Price-Multiplier = var.price_multiplier;
```

#### Quality of service factors

```vcl
declare local var.service_tier STRING;
declare local var.qos_factor FLOAT;

# Get the service tier from a header or cookie
set var.service_tier = req.http.X-Service-Tier;

# Look up the QoS factor for this service tier
set var.qos_factor = table.lookup_float(qos_factors, var.service_tier, 1.0);

# Set the QoS factor in a header
set req.http.X-QoS-Factor = var.qos_factor;
```
#### Currency exchange rates

```vcl
declare local var.currency STRING;
declare local var.exchange_rate FLOAT;

# Get the currency from a query parameter
set var.currency = querystring.get(req.url.qs, "currency");

# Look up the exchange rate for this currency
set var.exchange_rate = table.lookup_float(exchange_rates, var.currency, 1.0);

# Set the exchange rate in a header
set req.http.X-Exchange-Rate = var.exchange_rate;
```

#### Performance metrics thresholds

```vcl
declare local var.metric_name STRING;
declare local var.threshold FLOAT;

set var.metric_name = "response_time";

# Look up the threshold for this metric
set var.threshold = table.lookup_float(metric_thresholds, var.metric_name, 0.5);

# Set the threshold in a header
set req.http.X-Metric-Threshold = var.threshold;
```

#### Geographic distance calculations

```vcl
declare local var.location_code STRING;
declare local var.latitude FLOAT;
declare local var.longitude FLOAT;

# Get the location code from a query parameter
set var.location_code = querystring.get(req.url.qs, "location");

# Look up the latitude for this location
set var.latitude = table.lookup_float(location_coords, var.location_code + ":lat", 0.0);

# Look up the longitude for this location
set var.longitude = table.lookup_float(location_coords, var.location_code + ":lng", 0.0);

# Set the coordinates in headers
set req.http.X-Location-Lat = var.latitude;
set req.http.X-Location-Lng = var.longitude;
```

## table.lookup_ip

Looks up a key in a table and returns its value as an IP address.

### Syntax

```vcl
IP table.lookup_ip(STRING table_name, STRING key [, IP default])
```

### Parameters

- `table_name`: The name of the table to look up in
- `key`: The key to look up
- `default`: Optional default value to return if the key is not found

### Return Value

The value associated with the key as an IP address, or the default value if provided, or 0.0.0.0

### Examples

#### Backend IP addresses

```vcl
declare local var.backend_name STRING;
declare local var.backend_ip IP;

set var.backend_name = "api_server";

# Look up the IP address for this backend
set var.backend_ip = table.lookup_ip(backend_ips, var.backend_name, "0.0.0.0");

# Set the backend IP in a header
set req.http.X-Backend-IP = var.backend_ip;
```

#### Geolocation overrides

```vcl
declare local var.country_code STRING;
declare local var.geo_ip IP;

# Get the country code from a query parameter
set var.country_code = querystring.get(req.url.qs, "country");

# Look up a representative IP for this country
set var.geo_ip = table.lookup_ip(country_ips, var.country_code, client.ip);

# Set the geolocation IP in a header
set req.http.X-Geo-IP = var.geo_ip;
```
#### IP-based routing

```vcl
declare local var.service_name STRING;
declare local var.service_ip IP;

# Get the service name from the URL path
if (req.url.path ~ "^/([^/]+)") {
  set var.service_name = re.group.1;
  
  # Look up the IP address for this service
  set var.service_ip = table.lookup_ip(service_ips, var.service_name);
  
  if (var.service_ip != "0.0.0.0") {
    # Set the service IP in a header
    set req.http.X-Service-IP = var.service_ip;
  }
}
```

#### IP allowlisting with subnet matching

```vcl
declare local var.client_type STRING;
declare local var.allowed_subnet IP;

# Get the client type from a header
set var.client_type = req.http.X-Client-Type;

# Look up the allowed subnet for this client type
set var.allowed_subnet = table.lookup_ip(allowed_subnets, var.client_type);

# Check if the client IP is in the allowed subnet
if (var.allowed_subnet != "0.0.0.0" && client.ip ~ var.allowed_subnet) {
  set req.http.X-Client-Allowed = "true";
} else {
  set req.http.X-Client-Allowed = "false";
}
```

#### DNS override

```vcl
declare local var.hostname STRING;
declare local var.resolved_ip IP;

# Get the hostname from a header
set var.hostname = req.http.Host;

# Look up the IP address for this hostname
set var.resolved_ip = table.lookup_ip(dns_overrides, var.hostname, "0.0.0.0");

if (var.resolved_ip != "0.0.0.0") {
  # Set the resolved IP in a header
  set req.http.X-Resolved-IP = var.resolved_ip;
}
```

## table.lookup_time

Looks up a key in a table and returns its value as a time.

### Syntax

```vcl
TIME table.lookup_time(STRING table_name, STRING key [, TIME default])
```

### Parameters

- `table_name`: The name of the table to look up in
- `key`: The key to look up
- `default`: Optional default value to return if the key is not found

### Return Value

The value associated with the key as a time, or the default value if provided, or 0s

### Examples

#### Maintenance windows

```vcl
declare local var.maintenance_start TIME;
declare local var.maintenance_end TIME;
declare local var.current_time TIME;

# Look up the maintenance window start and end times
set var.maintenance_start = table.lookup_time(maintenance_windows, "start");
set var.maintenance_end = table.lookup_time(maintenance_windows, "end");
set var.current_time = now;

# Check if we're in the maintenance window
if (var.current_time >= var.maintenance_start && var.current_time <= var.maintenance_end) {
  set req.http.X-Maintenance-Mode = "true";
} else {
  set req.http.X-Maintenance-Mode = "false";
}
```
#### Cache expiration times

```vcl
declare local var.content_type STRING;
declare local var.expiration_time TIME;

# Get the content type from a header
set var.content_type = req.http.Content-Type;

# Look up the expiration time for this content type
set var.expiration_time = table.lookup_time(expiration_times, var.content_type, now + 3600s);

# Set the expiration time in a header
set req.http.X-Expiration-Time = strftime("%Y-%m-%d %H:%M:%S", var.expiration_time);
```

#### Scheduled feature activation

```vcl
declare local var.feature_name STRING;
declare local var.activation_time TIME;

set var.feature_name = "new_checkout";

# Look up the activation time for this feature
set var.activation_time = table.lookup_time(feature_activations, var.feature_name);

# Check if the feature should be active
if (var.activation_time != 0s && now >= var.activation_time) {
  set req.http.X-Feature-Active = "true";
} else {
  set req.http.X-Feature-Active = "false";
}
```

#### Time-based routing

```vcl
declare local var.route_name STRING;
declare local var.route_start_time TIME;
declare local var.route_end_time TIME;

set var.route_name = "holiday_special";

# Look up the start and end times for this route
set var.route_start_time = table.lookup_time(route_times, var.route_name + ":start");
set var.route_end_time = table.lookup_time(route_times, var.route_name + ":end");

# Check if the route should be active
if (var.route_start_time != 0s && var.route_end_time != 0s &&
    now >= var.route_start_time && now <= var.route_end_time) {
  set req.http.X-Route-Active = "true";
} else {
  set req.http.X-Route-Active = "false";
}
```

#### Event scheduling

```vcl
declare local var.event_name STRING;
declare local var.event_time TIME;
declare local var.time_until_event INTEGER;

set var.event_name = "product_launch";

# Look up the time for this event
set var.event_time = table.lookup_time(event_schedule, var.event_name);

if (var.event_time != 0s) {
  # Calculate the time until the event in seconds
  set var.time_until_event = var.event_time - now;
  
  # Set the time until the event in a header
  set req.http.X-Time-Until-Event = var.time_until_event;
}
```

## table.lookup_rtime

Looks up a key in a table and returns its value as a relative time.

### Syntax

```vcl
RTIME table.lookup_rtime(STRING table_name, STRING key [, RTIME default])
```

### Parameters

- `table_name`: The name of the table to look up in
- `key`: The key to look up
- `default`: Optional default value to return if the key is not found

### Return Value

The value associated with the key as a relative time, or the default value if provided, or 0s

### Examples

#### Cache TTLs

```vcl
declare local var.content_type STRING;
declare local var.cache_ttl RTIME;

# Get the content type from a header
set var.content_type = req.http.Content-Type;

# Look up the cache TTL for this content type
set var.cache_ttl = table.lookup_rtime(cache_ttls, var.content_type, 1h);

# Set the cache TTL in a header
set req.http.X-Cache-TTL = var.cache_ttl;
```
#### Timeout configurations

```vcl
declare local var.endpoint STRING;
declare local var.timeout RTIME;

# Get the endpoint from the URL path
if (req.url.path ~ "^/api/([^/]+)") {
  set var.endpoint = re.group.1;
  
  # Look up the timeout for this endpoint
  set var.timeout = table.lookup_rtime(endpoint_timeouts, var.endpoint, 30s);
  
  # Set the timeout in a header
  set req.http.X-Timeout = var.timeout;
}
```

#### Rate limiting windows

```vcl
declare local var.rate_limit_window RTIME;

# Look up the rate limiting window
set var.rate_limit_window = table.lookup_rtime(rate_limit_windows, "default", 60s);

# Set the rate limiting window in a header
set req.http.X-Rate-Limit-Window = var.rate_limit_window;
```

#### Retry intervals

```vcl
declare local var.retry_count STRING;
declare local var.retry_interval RTIME;

# Get the retry count from a header
set var.retry_count = req.http.X-Retry-Count;

# Look up the retry interval for this retry count
set var.retry_interval = table.lookup_rtime(retry_intervals, var.retry_count, 1s);

# Set the retry interval in a header
set req.http.X-Retry-Interval = var.retry_interval;
```

#### Grace periods

```vcl
declare local var.content_type STRING;
declare local var.grace_period RTIME;

# Get the content type from a header
set var.content_type = req.http.Content-Type;

# Look up the grace period for this content type
set var.grace_period = table.lookup_rtime(grace_periods, var.content_type, 24h);

# Set the grace period in a header
set req.http.X-Grace-Period = var.grace_period;
```

## table.lookup_regex

Looks up a key in a table and returns its value as a regex.

### Syntax

```vcl
REGEX table.lookup_regex(STRING table_name, STRING key [, STRING default])
```

### Parameters

- `table_name`: The name of the table to look up in
- `key`: The key to look up
- `default`: Optional default value to return if the key is not found

### Return Value

The value associated with the key as a regex, or the default value if provided, or an empty regex

### Examples

#### URL pattern matching

```vcl
declare local var.path_type STRING;
declare local var.url_pattern REGEX;

set var.path_type = "product";

# Look up the URL pattern for this path type
set var.url_pattern = table.lookup_regex(url_patterns, var.path_type);

# Check if the URL matches the pattern
if (req.url.path ~ var.url_pattern) {
  set req.http.X-Path-Type = var.path_type;
}
```

#### User agent classification

```vcl
declare local var.device_type STRING;
declare local var.user_agent_pattern REGEX;

set var.device_type = "mobile";

# Look up the user agent pattern for this device type
set var.user_agent_pattern = table.lookup_regex(user_agent_patterns, var.device_type);

# Check if the user agent matches the pattern
if (req.http.User-Agent ~ var.user_agent_pattern) {
  set req.http.X-Device-Type = var.device_type;
}
```
#### Content filtering

```vcl
declare local var.filter_type STRING;
declare local var.filter_pattern REGEX;

set var.filter_type = "profanity";

# Look up the filter pattern for this filter type
set var.filter_pattern = table.lookup_regex(filter_patterns, var.filter_type);

# Check if the content matches the filter pattern
if (req.http.X-Content ~ var.filter_pattern) {
  set req.http.X-Filtered = "true";
}
```

#### Input validation

```vcl
declare local var.field_name STRING;
declare local var.validation_pattern REGEX;

set var.field_name = "email";

# Look up the validation pattern for this field
set var.validation_pattern = table.lookup_regex(validation_patterns, var.field_name);

# Check if the field value matches the validation pattern
if (req.http.X-Field-Value !~ var.validation_pattern) {
  set req.http.X-Validation-Error = "true";
}
```

#### Dynamic regex selection

```vcl
declare local var.regex_key STRING;
declare local var.selected_pattern REGEX;

# Determine the regex key based on request properties
if (req.http.Content-Type == "application/json") {
  set var.regex_key = "json";
} else if (req.http.Content-Type == "application/xml") {
  set var.regex_key = "xml";
} else {
  set var.regex_key = "default";
}

# Look up the regex pattern for this key
set var.selected_pattern = table.lookup_regex(regex_patterns, var.regex_key);

# Use the selected pattern
if (req.http.X-Content ~ var.selected_pattern) {
  set req.http.X-Pattern-Matched = "true";
}
```

## table.lookup_acl

Looks up a key in a table and returns its value as an ACL.

### Syntax

```vcl
ACL table.lookup_acl(STRING table_name, STRING key)
```

### Parameters

- `table_name`: The name of the table to look up in
- `key`: The key to look up

### Return Value

The value associated with the key as an ACL, or an empty ACL if not found

### Examples

#### Dynamic ACL selection

```vcl
declare local var.acl_name STRING;
declare local var.selected_acl ACL;

# Determine the ACL name based on request properties
if (req.http.X-Client-Type == "internal") {
  set var.acl_name = "internal";
} else if (req.http.X-Client-Type == "partner") {
  set var.acl_name = "partner";
} else {
  set var.acl_name = "public";
}

# Look up the ACL for this name
set var.selected_acl = table.lookup_acl(acls, var.acl_name);

# Check if the client IP is in the selected ACL
if (client.ip ~ var.selected_acl) {
  set req.http.X-ACL-Match = "true";
} else {
  set req.http.X-ACL-Match = "false";
}
```

#### Environment-specific ACLs

```vcl
declare local var.environment STRING;
declare local var.env_acl ACL;

# Get the environment from a header
set var.environment = req.http.X-Environment;

# Look up the ACL for this environment
set var.env_acl = table.lookup_acl(environment_acls, var.environment);

# Check if the client IP is in the environment ACL
if (client.ip ~ var.env_acl) {
  set req.http.X-Environment-Match = "true";
} else {
  set req.http.X-Environment-Match = "false";
}
```
#### Feature-specific ACLs

```vcl
declare local var.feature_name STRING;
declare local var.feature_acl ACL;

set var.feature_name = "beta";

# Look up the ACL for this feature
set var.feature_acl = table.lookup_acl(feature_acls, var.feature_name);

# Check if the client IP is in the feature ACL
if (client.ip ~ var.feature_acl) {
  set req.http.X-Feature-Access = "true";
} else {
  set req.http.X-Feature-Access = "false";
}
```

#### Geo-based ACLs

```vcl
declare local var.country_code STRING;
declare local var.country_acl ACL;

# Get the country code from the client's geolocation
set var.country_code = client.geo.country_code;

# Look up the ACL for this country
set var.country_acl = table.lookup_acl(country_acls, var.country_code);

# Check if the client IP is in the country ACL
if (client.ip ~ var.country_acl) {
  set req.http.X-Country-Match = "true";
} else {
  set req.http.X-Country-Match = "false";
}
```

#### Role-based ACLs

```vcl
declare local var.user_role STRING;
declare local var.role_acl ACL;

# Get the user role from a header
set var.user_role = req.http.X-User-Role;

# Look up the ACL for this role
set var.role_acl = table.lookup_acl(role_acls, var.user_role);

# Check if the client IP is in the role ACL
if (client.ip ~ var.role_acl) {
  set req.http.X-Role-Match = "true";
} else {
  set req.http.X-Role-Match = "false";
}
```

## table.contains

Checks if a key exists in a table.

### Syntax

```vcl
BOOL table.contains(STRING table_name, STRING key)
```

### Parameters

- `table_name`: The name of the table to check
- `key`: The key to check for

### Return Value

- TRUE if the key exists in the table
- FALSE otherwise

### Examples

#### Basic key existence check

```vcl
declare local var.api_key STRING;
declare local var.key_exists BOOL;

# Get the API key from the request header
set var.api_key = req.http.X-API-Key;

# Check if the API key exists in the valid_api_keys table
set var.key_exists = table.contains(valid_api_keys, var.api_key);

if (!var.key_exists) {
  # API key not found in the table
  error 401 "Invalid API Key";
}
```

#### Feature flag existence check

```vcl
declare local var.feature_name STRING;
declare local var.feature_exists BOOL;

set var.feature_name = "new_checkout";

# Check if the feature flag exists in the features table
set var.feature_exists = table.contains(features, var.feature_name);

if (var.feature_exists) {
  # Feature flag exists, now check its value
  declare local var.feature_enabled BOOL;
  set var.feature_enabled = table.lookup_bool(features, var.feature_name, false);
  
  if (var.feature_enabled) {
    set req.http.X-Feature-Status = "enabled";
  } else {
    set req.http.X-Feature-Status = "disabled";
  }
} else {
  # Feature flag doesn't exist
  set req.http.X-Feature-Status = "not_configured";
}
```
#### Allowlist check

```vcl
declare local var.ip_address STRING;
declare local var.ip_allowed BOOL;

# Get the IP address from a header
set var.ip_address = req.http.X-Forwarded-For;

# Check if the IP address is in the allowlist
set var.ip_allowed = table.contains(ip_allowlist, var.ip_address);

if (!var.ip_allowed) {
  # IP address not in the allowlist
  error 403 "Forbidden";
}
```

#### Configuration existence check

```vcl
declare local var.config_key STRING;
declare local var.config_exists BOOL;

set var.config_key = "maintenance_mode";

# Check if the configuration key exists
set var.config_exists = table.contains(config, var.config_key);

if (var.config_exists) {
  # Configuration key exists, use its value
  declare local var.maintenance_mode BOOL;
  set var.maintenance_mode = table.lookup_bool(config, var.config_key, false);
  
  if (var.maintenance_mode) {
    error 503 "Service Unavailable";
  }
}
```

#### User permission check

```vcl
declare local var.user_id STRING;
declare local var.permission STRING;
declare local var.has_permission BOOL;

# Get the user ID from a cookie or header
set var.user_id = req.http.Cookie:user_id;
set var.permission = "admin";

# Check if the user has the specified permission
set var.has_permission = table.contains(user_permissions, var.user_id + ":" + var.permission);

if (var.has_permission) {
  # User has the permission
  set req.http.X-Has-Permission = "true";
} else {
  # User doesn't have the permission
  set req.http.X-Has-Permission = "false";
}
```

## Integrated Example: Complete Table-Based Configuration System

This example demonstrates how multiple table functions can work together to create a comprehensive configuration system.

```vcl
sub vcl_recv {
  # Step 1: Determine the environment
  declare local var.environment STRING;
  declare local var.is_production BOOL;
  
  # Get the environment from a header or hostname
  if (req.http.X-Environment) {
    set var.environment = req.http.X-Environment;
  } else if (req.http.Host ~ "^prod\.") {
    set var.environment = "production";
  } else if (req.http.Host ~ "^stage\.") {
    set var.environment = "staging";
  } else if (req.http.Host ~ "^dev\.") {
    set var.environment = "development";
  } else {
    set var.environment = "unknown";
  }
  
  # Check if this is the production environment
  set var.is_production = (var.environment == "production");
  
  # Step 2: Load environment-specific configuration
  declare local var.config_prefix STRING;
  
  # Set the configuration prefix for this environment
  set var.config_prefix = var.environment + ":";
  
  # Step 3: Check for maintenance mode
  declare local var.maintenance_mode BOOL;
  declare local var.maintenance_path_exempt BOOL;
  
  # Check if maintenance mode is enabled for this environment
  set var.maintenance_mode = table.lookup_bool(config, var.config_prefix + "maintenance_mode", false);
  
  if (var.maintenance_mode) {
    # Check if the current path is exempt from maintenance mode
    set var.maintenance_path_exempt = false;
    
    # Check against exempt paths
    declare local var.exempt_paths_pattern REGEX;
    set var.exempt_paths_pattern = table.lookup_regex(config, var.config_prefix + "maintenance_exempt_paths");
    
    if (var.exempt_paths_pattern != "" && req.url.path ~ var.exempt_paths_pattern) {
      set var.maintenance_path_exempt = true;
    }
    
    # Check if the client IP is exempt from maintenance mode
    declare local var.maintenance_exempt_acl ACL;
    set var.maintenance_exempt_acl = table.lookup_acl(acls, var.config_prefix + "maintenance_exempt");
    
    if (!var.maintenance_path_exempt && !(client.ip ~ var.maintenance_exempt_acl)) {
      # Show maintenance page
      error 503 "Service Unavailable";
    }
  }
  
  # Step 4: Apply feature flags
  declare local var.feature_prefix STRING;
  
  # Set the feature prefix for this environment
  set var.feature_prefix = var.environment + ":feature:";
  
  # Check and apply feature flags
  declare local var.new_ui_enabled BOOL;
  declare local var.new_api_enabled BOOL;
  declare local var.new_checkout_enabled BOOL;
  
  set var.new_ui_enabled = table.lookup_bool(features, var.feature_prefix + "new_ui", false);
  set var.new_api_enabled = table.lookup_bool(features, var.feature_prefix + "new_api", false);
  set var.new_checkout_enabled = table.lookup_bool(features, var.feature_prefix + "new_checkout", false);
  
  # Set feature flags in headers
  set req.http.X-Feature-New-UI = if(var.new_ui_enabled, "enabled", "disabled");
  set req.http.X-Feature-New-API = if(var.new_api_enabled, "enabled", "disabled");
  set req.http.X-Feature-New-Checkout = if(var.new_checkout_enabled, "enabled", "disabled");
  
  # Step 5: Apply rate limits
  declare local var.rate_limit_prefix STRING;
  declare local var.rate_limit INTEGER;
  
  # Set the rate limit prefix for this environment
  set var.rate_limit_prefix = var.environment + ":rate_limit:";
  
  # Get the appropriate rate limit based on the path
  if (req.url.path ~ "^/api/") {
    set var.rate_limit = table.lookup_integer(rate_limits, var.rate_limit_prefix + "api", 100);
  } else if (req.url.path ~ "^/admin/") {
    set var.rate_limit = table.lookup_integer(rate_limits, var.rate_limit_prefix + "admin", 50);
  } else {
    set var.rate_limit = table.lookup_integer(rate_limits, var.rate_limit_prefix + "default", 200);
  }
  
  # Set the rate limit in a header
  set req.http.X-Rate-Limit = var.rate_limit;
  
  # Step 6: Apply cache TTLs
  declare local var.cache_ttl_prefix STRING;
  declare local var.cache_ttl RTIME;
  
  # Set the cache TTL prefix for this environment
  set var.cache_ttl_prefix = var.environment + ":cache_ttl:";
  
  # Get the appropriate cache TTL based on the content type
  if (req.http.Content-Type) {
    # Try to get a content-type specific TTL
    set var.cache_ttl = table.lookup_rtime(cache_ttls, var.cache_ttl_prefix + req.http.Content-Type);
    
    if (var.cache_ttl == 0s) {
      # Fall back to default TTL
      set var.cache_ttl = table.lookup_rtime(cache_ttls, var.cache_ttl_prefix + "default", 1h);
    }
  } else {
    # Use default TTL
    set var.cache_ttl = table.lookup_rtime(cache_ttls, var.cache_ttl_prefix + "default", 1h);
  }
  
  # Set the cache TTL in a header
  set req.http.X-Cache-TTL = var.cache_ttl;
}
```

## Best Practices for Table Functions

1. Table Organization:
   - Use consistent naming conventions for table keys
   - Consider using prefixes for different environments or categories
   - Group related configuration in the same table
   - Document the structure and purpose of each table

2. Default Values:
   - Always provide sensible default values when looking up keys
   - Consider the implications of missing keys in your logic
   - Use table.contains to check for key existence when needed

3. Type-Specific Lookups:
   - Use the appropriate lookup function for each data type
   - Be aware of type conversion implications
   - Validate values after lookup when necessary

4. Performance Considerations:
   - Cache frequently used table lookups in local variables
   - Minimize the number of table lookups in high-traffic code paths
   - Be aware of the performance impact of large tables

5. Error Handling:
   - Handle missing keys gracefully
   - Provide clear error messages when configuration is invalid
   - Consider fallback strategies for missing or invalid configuration

6. Security Considerations:
   - Don't store sensitive information in tables
   - Validate and sanitize values from tables before using them
   - Be cautious with dynamic ACLs and regex patterns

7. Maintenance and Updates:
   - Document the process for updating tables
   - Consider the impact of table updates on running services
   - Use a consistent approach for versioning configuration