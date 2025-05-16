# Random Functions

This file demonstrates comprehensive examples of Random Functions in VCL.
These functions generate random values for various purposes such as
load balancing, A/B testing, sampling, and feature flagging.

## randombool

Generates a random boolean value with a specified probability.

### Syntax

```vcl
BOOL randombool(REAL probability)
```

### Parameters

- `probability`: A number between 0.0 and 1.0 representing the probability of returning TRUE

### Return Value

- TRUE with the specified probability
- FALSE otherwise

### Examples

#### Basic random boolean generation

```vcl
declare local var.result1 BOOL;

# Generate a random boolean with 50% probability of being true
set var.result1 = randombool(0.5);

# Log the result
log "Random boolean (50%): " + if(var.result1, "true", "false");
```

#### Random boolean with different probabilities

```vcl
declare local var.low_prob BOOL;
declare local var.high_prob BOOL;

# Generate with 10% probability of being true
set var.low_prob = randombool(0.1);

# Generate with 90% probability of being true
set var.high_prob = randombool(0.9);

# Log the results
log "Random boolean (10%): " + if(var.low_prob, "true", "false");
log "Random boolean (90%): " + if(var.high_prob, "true", "false");
```

#### A/B testing with random boolean

This example demonstrates how to use randombool for A/B testing:

```vcl
declare local var.in_experiment BOOL;

# Determine if the user is in the experiment (20% of users)
set var.in_experiment = randombool(0.2);

if (var.in_experiment) {
  # User is in the experiment group
  set req.http.X-Experiment = "new-feature";
  set req.http.X-Experiment-Group = "B";
} else {
  # User is in the control group
  set req.http.X-Experiment = "control";
  set req.http.X-Experiment-Group = "A";
}
```

#### Random sampling for logging

This example demonstrates how to use randombool for sampling requests to log:

```vcl
declare local var.should_log BOOL;

# Sample 1% of requests for detailed logging
set var.should_log = randombool(0.01);

if (var.should_log) {
  # Enable detailed logging for this request
  set req.http.X-Detailed-Logging = "enabled";
  log "Detailed logging enabled for request: " + req.url;
}
```

#### Feature flagging with random boolean

This example demonstrates how to use randombool for gradual feature rollout:

```vcl
declare local var.feature_enabled BOOL;

# Enable the feature for 5% of requests
set var.feature_enabled = randombool(0.05);

if (var.feature_enabled) {
  # Enable the new feature
  set req.http.X-New-Feature = "enabled";
} else {
  # Use the existing feature
  set req.http.X-New-Feature = "disabled";
}
```

## randombool_seeded

Generates a random boolean value with a specified probability, using a seed.

### Syntax

```vcl
BOOL randombool_seeded(REAL probability, STRING seed)
```

### Parameters

- `probability`: A number between 0.0 and 1.0 representing the probability of returning TRUE
- `seed`: A string used as a seed for the random number generator

### Return Value

- TRUE with the specified probability (deterministic for the same seed)
- FALSE otherwise

### Examples

#### Basic seeded random boolean generation

```vcl
declare local var.result1 BOOL;
declare local var.seed STRING;

# Use a consistent seed
set var.seed = "fixed-seed-123";

# Generate a random boolean with 50% probability using the seed
set var.result1 = randombool_seeded(0.5, var.seed);

# Log the result
# Note: This will always produce the same result for the same seed
log "Seeded random boolean (50%, seed=" + var.seed + "): " + if(var.result1, "true", "false");
```

#### User-specific A/B testing

This example demonstrates how to use randombool_seeded for consistent A/B testing:

```vcl
declare local var.user_id STRING;
declare local var.in_experiment BOOL;

# Get a stable identifier for the user
if (req.http.Cookie:user_id) {
  set var.user_id = req.http.Cookie:user_id;
} else if (req.http.X-User-ID) {
  set var.user_id = req.http.X-User-ID;
} else {
  # Fallback to IP address if no user ID is available
  set var.user_id = client.ip;
}

# Determine if the user is in the experiment (20% of users)
# Using the user ID as seed ensures the same user always gets the same result
set var.in_experiment = randombool_seeded(0.2, var.user_id);

if (var.in_experiment) {
  # User is in the experiment group
  set req.http.X-Experiment = "new-feature";
  set req.http.X-Experiment-Group = "B";
} else {
  # User is in the control group
  set req.http.X-Experiment = "control";
  set req.http.X-Experiment-Group = "A";
}
```

#### Feature flagging with consistent user experience

This example demonstrates how to use randombool_seeded for consistent feature flagging:

```vcl
declare local var.experiment_name STRING;
declare local var.feature_seed STRING;
declare local var.feature_enabled BOOL;

# Set the experiment name
set var.experiment_name = "new-ui-design";

# Create a seed that combines the user ID and experiment name
set var.feature_seed = var.user_id + "-" + var.experiment_name;

# Enable the feature for 10% of users
set var.feature_enabled = randombool_seeded(0.1, var.feature_seed);

if (var.feature_enabled) {
  # Enable the new feature
  set req.http.X-UI-Version = "new";
} else {
  # Use the existing feature
  set req.http.X-UI-Version = "current";
}
```

#### Multiple experiments with the same user base

This example demonstrates how to run multiple experiments with the same user base:

```vcl
declare local var.exp1_name STRING;
declare local var.exp2_name STRING;
declare local var.exp1_seed STRING;
declare local var.exp2_seed STRING;
declare local var.in_exp1 BOOL;
declare local var.in_exp2 BOOL;

# Set experiment names
set var.exp1_name = "header-design";
set var.exp2_name = "footer-design";

# Create seeds for each experiment
set var.exp1_seed = var.user_id + "-" + var.exp1_name;
set var.exp2_seed = var.user_id + "-" + var.exp2_name;

# Determine if the user is in each experiment
set var.in_exp1 = randombool_seeded(0.5, var.exp1_seed);
set var.in_exp2 = randombool_seeded(0.5, var.exp2_seed);

# Set headers based on experiment participation
set req.http.X-Header-Version = if(var.in_exp1, "new", "current");
set req.http.X-Footer-Version = if(var.in_exp2, "new", "current");
```

#### Consistent sampling for logging

This example demonstrates how to use randombool_seeded for consistent sampling:

```vcl
declare local var.log_seed STRING;
declare local var.should_log BOOL;

# Create a seed based on the URL path
set var.log_seed = req.url.path;

# Sample 5% of URLs for detailed logging
set var.should_log = randombool_seeded(0.05, var.log_seed);

if (var.should_log) {
  # Enable detailed logging for this URL
  set req.http.X-Detailed-Logging = "enabled";
  log "Detailed logging enabled for URL: " + req.url;
}
```

## randomint

Generates a random integer within a specified range.

### Syntax

```vcl
INTEGER randomint(INTEGER from, INTEGER to)
```

### Parameters

- `from`: The lower bound of the range (inclusive)
- `to`: The upper bound of the range (inclusive)

### Return Value

A random integer between from and to, inclusive

### Examples

#### Basic random integer generation

```vcl
declare local var.result1 INTEGER;

# Generate a random integer between 1 and 10
set var.result1 = randomint(1, 10);

# Log the result
log "Random integer (1-10): " + var.result1;
```

#### Random integer with different ranges

```vcl
declare local var.small_range INTEGER;
declare local var.large_range INTEGER;

# Generate a random integer between 1 and 5
set var.small_range = randomint(1, 5);

# Generate a random integer between 1 and 1000
set var.large_range = randomint(1, 1000);

# Log the results
log "Random integer (1-5): " + var.small_range;
log "Random integer (1-1000): " + var.large_range;
```

#### Load balancing with random integer

This example demonstrates how to use randomint for simple load balancing:

```vcl
declare local var.backend_index INTEGER;

# Select a random backend (1-3)
set var.backend_index = randomint(1, 3);

# Set the backend based on the random index
if (var.backend_index == 1) {
  set req.backend = F_backend1;
} else if (var.backend_index == 2) {
  set req.backend = F_backend2;
} else {
  set req.backend = F_backend3;
}

# Log the selected backend
log "Selected backend: " + var.backend_index;
```

#### Random delays for testing

This example demonstrates how to use randomint for random delays:

```vcl
declare local var.delay_ms INTEGER;

# Generate a random delay between 50 and 200 milliseconds
set var.delay_ms = randomint(50, 200);

# Set the delay in a header for the backend to simulate
set req.http.X-Simulate-Delay = var.delay_ms;
```

#### Multi-variant testing

This example demonstrates how to use randomint for multi-variant testing:

```vcl
declare local var.variant INTEGER;

# Select a random variant (1-4)
set var.variant = randomint(1, 4);

# Set the variant in a header
set req.http.X-Variant = var.variant;

# Log the selected variant
log "Selected variant: " + var.variant;
```

## randomint_seeded

Generates a random integer within a specified range, using a seed.

### Syntax

```vcl
INTEGER randomint_seeded(INTEGER from, INTEGER to, STRING seed)
```

### Parameters

- `from`: The lower bound of the range (inclusive)
- `to`: The upper bound of the range (inclusive)
- `seed`: A string used as a seed for the random number generator

### Return Value

A random integer between from and to, inclusive (deterministic for the same seed)

### Examples

#### Basic seeded random integer generation

```vcl
declare local var.result1 INTEGER;
declare local var.seed STRING;

# Use a consistent seed
set var.seed = "fixed-seed-123";

# Generate a random integer between 1 and 10 using the seed
set var.result1 = randomint_seeded(1, 10, var.seed);

# Log the result
# Note: This will always produce the same result for the same seed
log "Seeded random integer (1-10, seed=" + var.seed + "): " + var.result1;
```

#### User-specific variant assignment

This example demonstrates how to use randomint_seeded for consistent variant assignment:

```vcl
declare local var.user_id STRING;
declare local var.variant INTEGER;

# Get a stable identifier for the user
if (req.http.Cookie:user_id) {
  set var.user_id = req.http.Cookie:user_id;
} else if (req.http.X-User-ID) {
  set var.user_id = req.http.X-User-ID;
} else {
  # Fallback to IP address if no user ID is available
  set var.user_id = client.ip;
}

# Assign the user to a variant (1-4)
# Using the user ID as seed ensures the same user always gets the same variant
set var.variant = randomint_seeded(1, 4, var.user_id);

# Set the variant in a header
set req.http.X-Variant = var.variant;

# Log the assigned variant
log "User " + var.user_id + " assigned to variant: " + var.variant;
```

#### Consistent shard assignment

This example demonstrates how to use randomint_seeded for consistent sharding:

```vcl
declare local var.shard_count INTEGER;
declare local var.shard INTEGER;
declare local var.shard_key STRING;

# Set the number of shards
set var.shard_count = 10;

# Use the URL path as the shard key
set var.shard_key = req.url.path;

# Assign the request to a shard (0-9)
set var.shard = randomint_seeded(0, var.shard_count - 1, var.shard_key);

# Set the shard in a header
set req.http.X-Shard = var.shard;

# Log the assigned shard
log "URL " + var.shard_key + " assigned to shard: " + var.shard;
```

#### Weighted random selection

This example demonstrates how to implement weighted random selection:

```vcl
declare local var.experiment_name STRING;
declare local var.random_value INTEGER;
declare local var.experiment_seed STRING;

# Set the experiment name
set var.experiment_name = "pricing-model";

# Create a seed that combines the user ID and experiment name
set var.experiment_seed = var.user_id + "-" + var.experiment_name;

# Generate a random value between 1 and 100
set var.random_value = randomint_seeded(1, 100, var.experiment_seed);

# Assign the user to a group based on weighted probabilities
# Group A: 60%, Group B: 30%, Group C: 10%
if (var.random_value <= 60) {
  set req.http.X-Pricing-Model = "A";
} else if (var.random_value <= 90) {
  set req.http.X-Pricing-Model = "B";
} else {
  set req.http.X-Pricing-Model = "C";
}
```

#### Deterministic cache key generation

This example demonstrates how to use randomint_seeded for cache key generation:

```vcl
declare local var.cache_shard INTEGER;
declare local var.cache_key STRING;

# Generate a shard number (0-99) based on the URL
set var.cache_shard = randomint_seeded(0, 99, req.url.path);

# Create a cache key that includes the shard
set var.cache_key = "shard-" + var.cache_shard + ":" + req.url;

# Set the cache key in a header
set req.http.X-Cache-Key = var.cache_key;
```

## randomstr

Generates a random string of a specified length.

### Syntax

```vcl
STRING randomstr(INTEGER length [, STRING charset])
```

### Parameters

- `length`: The length of the random string to generate
- `charset`: Optional character set to use (default: [A-Za-z0-9])

### Return Value

A random string of the specified length

### Examples

#### Basic random string generation

```vcl
declare local var.result1 STRING;

# Generate a random string of length 10
set var.result1 = randomstr(10);

# Log the result
log "Random string (length 10): " + var.result1;
```

#### Random string with different lengths

```vcl
declare local var.short_string STRING;
declare local var.long_string STRING;

# Generate a random string of length 5
set var.short_string = randomstr(5);

# Generate a random string of length 20
set var.long_string = randomstr(20);

# Log the results
log "Random string (length 5): " + var.short_string;
log "Random string (length 20): " + var.long_string;
```

#### Random string with custom character set

```vcl
declare local var.hex_string STRING;
declare local var.alpha_string STRING;
declare local var.num_string STRING;

# Generate a random hexadecimal string
set var.hex_string = randomstr(8, "0123456789ABCDEF");

# Generate a random alphabetic string
set var.alpha_string = randomstr(8, "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz");

# Generate a random numeric string
set var.num_string = randomstr(8, "0123456789");

# Log the results
log "Random hex string: " + var.hex_string;
log "Random alpha string: " + var.alpha_string;
log "Random numeric string: " + var.num_string;
```

#### Generating a request ID

This example demonstrates how to use randomstr for request ID generation:

```vcl
declare local var.request_id STRING;

# Generate a random request ID
set var.request_id = randomstr(16, "0123456789abcdef");

# Set the request ID in a header
set req.http.X-Request-ID = var.request_id;

# Log the request ID
log "Generated request ID: " + var.request_id;
```

#### Generating a CSRF token

This example demonstrates how to use randomstr for CSRF token generation:

```vcl
declare local var.csrf_token STRING;

# Generate a random CSRF token
set var.csrf_token = randomstr(32);

# Set the CSRF token in a header
set req.http.X-CSRF-Token = var.csrf_token;

# Log the CSRF token
log "Generated CSRF token: " + var.csrf_token;
```

## Integrated Example: Complete Random Value System

This example demonstrates how multiple random functions can work together to create a comprehensive random value system for various purposes.

```vcl
sub vcl_recv {
  # Step 1: Generate a unique request ID
  declare local var.request_id STRING;
  
  # Generate a random request ID
  set var.request_id = randomstr(16, "0123456789abcdef");
  
  # Set the request ID in a header
  set req.http.X-Request-ID = var.request_id;
  
  # Step 2: Determine user identity for consistent experiences
  declare local var.user_id STRING;
  
  # Get a stable identifier for the user
  if (req.http.Cookie:user_id) {
    set var.user_id = req.http.Cookie:user_id;
  } else if (req.http.X-User-ID) {
    set var.user_id = req.http.X-User-ID;
  } else {
    # Fallback to IP address if no user ID is available
    set var.user_id = client.ip;
  }
  
  # Step 3: Implement feature flags with consistent user experience
  # Define feature flags with different rollout percentages
  declare local var.feature_new_ui BOOL;
  declare local var.feature_new_checkout BOOL;
  declare local var.feature_new_search BOOL;
  
  # Assign users to features consistently
  set var.feature_new_ui = randombool_seeded(0.2, var.user_id + "-new-ui");
  set var.feature_new_checkout = randombool_seeded(0.1, var.user_id + "-new-checkout");
  set var.feature_new_search = randombool_seeded(0.5, var.user_id + "-new-search");
  
  # Set feature flags in headers
  set req.http.X-Feature-New-UI = if(var.feature_new_ui, "enabled", "disabled");
  set req.http.X-Feature-New-Checkout = if(var.feature_new_checkout, "enabled", "disabled");
  set req.http.X-Feature-New-Search = if(var.feature_new_search, "enabled", "disabled");
  
  # Step 4: Implement multi-variant testing
  declare local var.pricing_variant INTEGER;
  declare local var.layout_variant INTEGER;
  
  # Assign users to pricing variants (1-3)
  set var.pricing_variant = randomint_seeded(1, 3, var.user_id + "-pricing");
  
  # Assign users to layout variants (1-4)
  set var.layout_variant = randomint_seeded(1, 4, var.user_id + "-layout");
  
  # Set variant assignments in headers
  set req.http.X-Pricing-Variant = var.pricing_variant;
  set req.http.X-Layout-Variant = var.layout_variant;
  
  # Step 5: Implement random sampling for logging
  declare local var.should_log BOOL;
  
  # Sample 1% of requests for detailed logging
  set var.should_log = randombool(0.01);
  
  if (var.should_log) {
    # Enable detailed logging for this request
    set req.http.X-Detailed-Logging = "enabled";
    
    # Log detailed information
    log "Detailed logging for request: " + var.request_id;
    log "User ID: " + var.user_id;
    log "Features: UI=" + req.http.X-Feature-New-UI + 
        ", Checkout=" + req.http.X-Feature-New-Checkout + 
        ", Search=" + req.http.X-Feature-New-Search;
    log "Variants: Pricing=" + var.pricing_variant + 
        ", Layout=" + var.layout_variant;
  }
  
  # Step 6: Implement weighted load balancing
  declare local var.backend_rand INTEGER;
  
  # Generate a random value between 1 and 100
  set var.backend_rand = randomint(1, 100);
  
  # Distribute traffic with weights: Backend1 (70%), Backend2 (20%), Backend3 (10%)
  if (var.backend_rand <= 70) {
    set req.backend = F_backend1;
    set req.http.X-Selected-Backend = "backend1";
  } else if (var.backend_rand <= 90) {
    set req.backend = F_backend2;
    set req.http.X-Selected-Backend = "backend2";
  } else {
    set req.backend = F_backend3;
    set req.http.X-Selected-Backend = "backend3";
  }
  
  # Step 7: Generate a cache key with shard
  declare local var.cache_shard INTEGER;
  declare local var.cache_key STRING;
  
  # Generate a consistent shard number (0-99) based on the URL
  set var.cache_shard = randomint_seeded(0, 99, req.url.path);
  
  # Create a cache key that includes the shard
  set var.cache_key = "shard-" + var.cache_shard + ":" + req.url;
  
  # Set the cache key in a header
  set req.http.X-Cache-Key = var.cache_key;
}
```

## Best Practices for Random Functions

1. Seeded vs. Non-Seeded Functions:
   - Use seeded functions (randombool_seeded, randomint_seeded) when you need consistent results for the same input, such as user-specific feature flags or A/B testing
   - Use non-seeded functions (randombool, randomint, randomstr) when you need true randomness, such as load balancing or sampling

2. Choosing Good Seeds:
   - Use stable identifiers as seeds (user ID, URL path, etc.)
   - Combine multiple values to create unique seeds for different purposes
   - Include experiment or feature names in seeds to allow independent experiments

3. Probability and Range Selection:
   - Choose appropriate probability values for randombool based on your use case
   - For gradual rollouts, start with small probabilities and increase over time
   - Ensure randomint ranges are appropriate for your use case

4. Performance Considerations:
   - Random functions have some computational cost, so use them judiciously
   - Cache random values in local variables when used multiple times
   - Consider the impact on cache hit ratios when using random values in cache keys

5. Security Considerations:
   - Do not use these functions for cryptographic purposes
   - Be cautious when using random values in security-critical contexts
   - Use appropriate character sets for randomstr in security contexts

6. Testing and Debugging:
   - Use seeded functions during testing for reproducible results
   - Log random values during development for debugging
   - Verify distribution of random values in production

7. Common Use Cases:
   - A/B testing and feature flagging: Use seeded functions for consistent user experience
   - Load balancing: Use non-seeded functions for even distribution
   - Sampling: Use non-seeded functions for representative samples
   - Token generation: Use randomstr with appropriate length and character set