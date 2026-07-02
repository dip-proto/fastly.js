# Time Functions

This file demonstrates comprehensive examples of Time Functions in VCL.
These functions help manipulate, format, and compare time values for
time-based logic, caching decisions, and response headers.

All times in Fastly VCL are UTC; there is no timezone conversion function.
Also note that VCL has no infix arithmetic operators, so time computations
are done with these functions (or with assignment operators such as `-=` on
numeric variables).

## time.add

Adds a relative time to a time value.

### Syntax

```vcl
TIME time.add(TIME time, RTIME offset)
```

### Parameters

- `time`: The base time value
- `offset`: The relative time to add

### Return Value

A new time value with the offset added

### Examples

#### Basic time addition

```vcl
declare local var.current_time TIME;
declare local var.future_time TIME;

# Get the current time
set var.current_time = now;

# Add 1 hour to the current time
set var.future_time = time.add(var.current_time, 1h);

# Log the times
log "Current time: " + strftime("%Y-%m-%d %H:%M:%S", var.current_time);
log "Future time: " + strftime("%Y-%m-%d %H:%M:%S", var.future_time);
```

#### Setting cache control headers

```vcl
declare local var.expires_time TIME;

# Set expires time to 24 hours from now
set var.expires_time = time.add(now, 24h);

# Format the expires time for the Expires header
set req.http.X-Expires = strftime("%a, %d %b %Y %H:%M:%S GMT", var.expires_time);
```

#### Calculating time windows

```vcl
declare local var.window_start TIME;
declare local var.window_end TIME;

# Set window start to 1 hour ago
set var.window_start = time.sub(now, 1h);

# Set window end to 1 hour from now
set var.window_end = time.add(now, 1h);

# Log the time window
log "Window start: " + strftime("%Y-%m-%d %H:%M:%S", var.window_start);
log "Window end: " + strftime("%Y-%m-%d %H:%M:%S", var.window_end);
```

#### Calculating retry times

```vcl
declare local var.retry_after TIME;
declare local var.retry_count INTEGER;
declare local var.backoff RTIME;

# Get retry count from a header
set var.retry_count = std.atoi(req.http.X-Retry-Count);

# Simple exponential backoff (1s, 2s, 4s, 8s)
if (var.retry_count <= 0) {
  set var.backoff = 1s;
} else if (var.retry_count == 1) {
  set var.backoff = 2s;
} else if (var.retry_count == 2) {
  set var.backoff = 4s;
} else {
  set var.backoff = 8s;
}

# Calculate retry time
set var.retry_after = time.add(now, var.backoff);

# Set Retry-After header
set req.http.X-Retry-After = strftime("%a, %d %b %Y %H:%M:%S GMT", var.retry_after);
```

#### Scheduling maintenance windows

```vcl
declare local var.maintenance_start TIME;
declare local var.maintenance_end TIME;
declare local var.in_maintenance BOOL;

# Set maintenance window (example: 2 hours from now, lasting 1 hour)
set var.maintenance_start = time.add(now, 2h);
set var.maintenance_end = time.add(var.maintenance_start, 1h);

# Check if current time is in the maintenance window
set var.in_maintenance = (time.is_after(now, var.maintenance_start) &&
    !time.is_after(now, var.maintenance_end));

# Set maintenance window headers
set req.http.X-Maintenance-Start = strftime("%Y-%m-%d %H:%M:%S GMT", var.maintenance_start);
set req.http.X-Maintenance-End = strftime("%Y-%m-%d %H:%M:%S GMT", var.maintenance_end);
set req.http.X-In-Maintenance = if(var.in_maintenance, "true", "false");
```

## time.sub

Subtracts a relative time from a time value. Note that this subtracts a
duration from an absolute time and returns another absolute time; it does not
compute the difference between two absolute times. To measure the interval
between two times, use `time.interval_elapsed_ratio` or compare their epoch
representations obtained with `time.units("s", ...)`.

### Syntax

```vcl
TIME time.sub(TIME time, RTIME offset)
```

### Parameters

- `time`: The base time value
- `offset`: The relative time to subtract

### Return Value

A new time value with the offset subtracted

### Examples

#### Basic time subtraction

```vcl
declare local var.one_hour_ago TIME;

# Compute the time one hour ago
set var.one_hour_ago = time.sub(now, 1h);

# Log the result
log "One hour ago: " + strftime("%Y-%m-%d %H:%M:%S", var.one_hour_ago);
```

#### Computing a freshness cutoff

```vcl
declare local var.cutoff TIME;
declare local var.last_modified TIME;
declare local var.is_stale BOOL;

# Content older than 3 days is considered stale
set var.cutoff = time.sub(now, 3d);

# Parse the Last-Modified header
set var.last_modified = std.time(req.http.Last-Modified, now);

# Compare against the cutoff
set var.is_stale = time.is_after(var.cutoff, var.last_modified);

set req.http.X-Content-Stale = if(var.is_stale, "true", "false");
```

#### Measuring a difference between two times

```vcl
declare local var.start TIME;
declare local var.elapsed_s INTEGER;

# Some earlier point in time
set var.start = time.sub(now, 5m);

# Compute the elapsed seconds by subtracting epoch values.
# VCL has no infix arithmetic, so use the -= assignment operator.
set var.elapsed_s = std.atoi(time.units("s", now));
set var.elapsed_s -= std.atoi(time.units("s", var.start));

# Log the elapsed time
log "Elapsed: " + var.elapsed_s + " seconds";
```

## time.is_after

Checks if one time is after another.

### Syntax

```vcl
BOOL time.is_after(TIME t1, TIME t2)
```

### Parameters

- `t1`: The first time value
- `t2`: The second time value

### Return Value

- TRUE if t1 is after t2
- FALSE otherwise

### Examples

#### Basic time comparison

```vcl
declare local var.time1 TIME;
declare local var.time2 TIME;
declare local var.is_after BOOL;

# Set two times
set var.time1 = now;
set var.time2 = time.sub(now, 1h);  # 1 hour ago

# Check if time1 is after time2
set var.is_after = time.is_after(var.time1, var.time2);

# Log the result
log "Is current time after 1 hour ago? " + if(var.is_after, "Yes", "No");  # Should be "Yes"
```

#### Checking if content is fresh

```vcl
declare local var.expires_time TIME;
declare local var.is_expired BOOL;

# Set expires time to 24 hours ago
set var.expires_time = time.sub(now, 24h);

# Check if current time is after expires time (i.e., content is expired)
set var.is_expired = time.is_after(now, var.expires_time);

# Log the result
log "Is content expired? " + if(var.is_expired, "Yes", "No");  # Should be "Yes"
```

#### Checking if in a time window

```vcl
declare local var.window_start TIME;
declare local var.window_end TIME;
declare local var.after_start BOOL;
declare local var.before_end BOOL;
declare local var.in_window BOOL;

# Set time window
set var.window_start = time.sub(now, 1h);  # 1 hour ago
set var.window_end = time.add(now, 1h);    # 1 hour from now

# Check if current time is after window start
set var.after_start = time.is_after(now, var.window_start);

# Check if current time is before window end
set var.before_end = !time.is_after(now, var.window_end);

# Check if current time is in the window
set var.in_window = var.after_start && var.before_end;

# Log the result
log "Is current time in the window? " + if(var.in_window, "Yes", "No");  # Should be "Yes"
```

#### Checking if a maintenance window has started

```vcl
declare local var.maintenance_start TIME;
declare local var.maintenance_started BOOL;

# Set maintenance start time to 1 hour from now
set var.maintenance_start = time.add(now, 1h);

# Check if maintenance has started
set var.maintenance_started = time.is_after(now, var.maintenance_start);

# Log the result
log "Has maintenance started? " + if(var.maintenance_started, "Yes", "No");  # Should be "No"
```

#### Checking if a scheduled event has passed

```vcl
declare local var.event_time TIME;
declare local var.event_passed BOOL;

# Set event time to 2 days ago
set var.event_time = time.sub(now, 2d);

# Check if the event has passed
set var.event_passed = time.is_after(now, var.event_time);

# Log the result
log "Has the event passed? " + if(var.event_passed, "Yes", "No");  # Should be "Yes"
```

## time.hex_to_time

Converts a hexadecimal string, interpreted as a number of seconds divided by
the given divisor, to a time value. With a divisor of 1, the string is simply
a Unix timestamp in hexadecimal.

### Syntax

```vcl
TIME time.hex_to_time(INTEGER divisor, STRING dividend)
```

### Parameters

- `divisor`: The value to divide the parsed number by (must be a constant, at least 1)
- `dividend`: A hexadecimal string

### Return Value

The corresponding time value (dividend / divisor, in seconds since the Unix epoch)

### Examples

#### Basic hex to time conversion

```vcl
declare local var.hex_time STRING;
declare local var.time_value TIME;

# Set a hexadecimal time value (example: 0x5F7D7E98 = 1602076312)
set var.hex_time = "5F7D7E98";

# Convert hex to time
set var.time_value = time.hex_to_time(1, var.hex_time);

# Log the result
log "Hex time: " + var.hex_time;
log "Converted time: " + strftime("%Y-%m-%d %H:%M:%S", var.time_value);
```

#### Converting a timestamp from a header

```vcl
declare local var.header_hex_time STRING;
declare local var.header_time TIME;

# Get hex time from a header
set var.header_hex_time = req.http.X-Timestamp-Hex;

if (var.header_hex_time) {
  # Convert hex to time
  set var.header_time = time.hex_to_time(1, var.header_hex_time);
  
  # Set a formatted time header
  set req.http.X-Timestamp = strftime("%Y-%m-%d %H:%M:%S", var.header_time);
}
```

#### Checking if a hex timestamp is in the future

```vcl
declare local var.future_hex_time STRING;
declare local var.future_time TIME;
declare local var.is_future BOOL;

# Set a hexadecimal future time (this example uses a fixed value, but in practice would be dynamic)
set var.future_hex_time = "FFFFFFFF";  # Far in the future

# Convert hex to time
set var.future_time = time.hex_to_time(1, var.future_hex_time);

# Check if the time is in the future
set var.is_future = time.is_after(var.future_time, now);

# Log the result
log "Is the timestamp in the future? " + if(var.is_future, "Yes", "No");
```

#### Converting multiple hex timestamps

```vcl
declare local var.created_hex STRING;
declare local var.updated_hex STRING;
declare local var.created_time TIME;
declare local var.updated_time TIME;

# Set hexadecimal timestamps
set var.created_hex = "5F700000";  # Some time in 2020
set var.updated_hex = "5F800000";  # Some later time in 2020

# Convert hex to time
set var.created_time = time.hex_to_time(1, var.created_hex);
set var.updated_time = time.hex_to_time(1, var.updated_hex);

# Log the results
log "Created: " + strftime("%Y-%m-%d %H:%M:%S", var.created_time);
log "Updated: " + strftime("%Y-%m-%d %H:%M:%S", var.updated_time);

# Check which is more recent
if (time.is_after(var.updated_time, var.created_time)) {
  log "Item has been updated since creation";
}
```

## strftime

Formats a time value as a string. The format string must be a literal string
constant.

### Syntax

```vcl
STRING strftime(STRING format, TIME time)
```

### Parameters

- `format`: The format string (similar to C's strftime; must be a constant)
- `time`: The time value to format

### Return Value

The formatted time string (all times are UTC)

### Examples

#### Basic time formatting

```vcl
declare local var.current_time TIME;
declare local var.formatted_time STRING;

# Get the current time
set var.current_time = now;

# Format the time as YYYY-MM-DD HH:MM:SS
set var.formatted_time = strftime("%Y-%m-%d %H:%M:%S", var.current_time);

# Log the formatted time
log "Formatted time: " + var.formatted_time;
```

#### HTTP date formatting (for headers)

```vcl
declare local var.http_date STRING;

# Format the time as an HTTP date (e.g., "Wed, 21 Oct 2015 07:28:00 GMT")
set var.http_date = strftime("%a, %d %b %Y %H:%M:%S GMT", now);

# Set headers with the formatted date
set req.http.Date = var.http_date;
set req.http.Expires = strftime("%a, %d %b %Y %H:%M:%S GMT", time.add(now, 24h));
```

#### Different date formats

```vcl
declare local var.iso8601 STRING;
declare local var.rfc850 STRING;
declare local var.asctime STRING;

# ISO 8601 format (YYYY-MM-DDTHH:MM:SSZ)
set var.iso8601 = strftime("%Y-%m-%dT%H:%M:%SZ", now);

# RFC 850 format (Sunday, 06-Nov-94 08:49:37 GMT)
set var.rfc850 = strftime("%A, %d-%b-%y %H:%M:%S GMT", now);

# asctime format (Sun Nov  6 08:49:37 1994)
set var.asctime = strftime("%a %b %e %H:%M:%S %Y", now);

# Log the different formats
log "ISO 8601: " + var.iso8601;
log "RFC 850: " + var.rfc850;
log "asctime: " + var.asctime;
```

#### Date components

```vcl
declare local var.year STRING;
declare local var.month STRING;
declare local var.day STRING;
declare local var.hour STRING;
declare local var.minute STRING;
declare local var.second STRING;
declare local var.weekday STRING;

# Extract date components
set var.year = strftime("%Y", now);
set var.month = strftime("%m", now);
set var.day = strftime("%d", now);
set var.hour = strftime("%H", now);
set var.minute = strftime("%M", now);
set var.second = strftime("%S", now);
set var.weekday = strftime("%A", now);

# Log the components
log "Year: " + var.year;
log "Month: " + var.month;
log "Day: " + var.day;
log "Hour: " + var.hour;
log "Minute: " + var.minute;
log "Second: " + var.second;
log "Weekday: " + var.weekday;
```

#### Custom date formatting

```vcl
declare local var.custom_format1 STRING;
declare local var.custom_format2 STRING;

# Custom format 1: YYYYMMDD-HHMMSS
set var.custom_format1 = strftime("%Y%m%d-%H%M%S", now);

# Custom format 2: Day of year, Week of year
set var.custom_format2 = "Day " + strftime("%j", now) + " of year, Week " + strftime("%U", now);

# Log the custom formats
log "Custom format 1: " + var.custom_format1;
log "Custom format 2: " + var.custom_format2;
```

## std.time

Parses a date/time string into a time value. Several common formats are
recognized, including RFC 7231 HTTP dates, RFC 850, asctime, ISO 8601, and
Unix timestamps.

### Syntax

```vcl
TIME std.time(STRING s, TIME fallback)
```

### Parameters

- `s`: The string to parse
- `fallback`: The time value to return if the string cannot be parsed

### Return Value

The parsed time value, or the fallback if parsing fails

### Examples

#### Parsing a Last-Modified header

```vcl
declare local var.last_modified TIME;

# Parse the Last-Modified header; fall back to the epoch if missing/invalid
set var.last_modified = std.time(req.http.Last-Modified, std.integer2time(0));

# Log the parsed time
log "Last modified: " + strftime("%Y-%m-%d %H:%M:%S", var.last_modified);
```

#### Parsing a Unix timestamp

```vcl
declare local var.event_time TIME;

# Parse a Unix timestamp from a header
set var.event_time = std.time(req.http.X-Event-Timestamp, now);

if (time.is_after(now, var.event_time)) {
  set req.http.X-Event-Passed = "true";
}
```

## time.units

Represents a time as a string of seconds since the Unix epoch, to the decimal
precision of the specified unit.

### Syntax

```vcl
STRING time.units(STRING unit, TIME time)
```

### Parameters

- `unit`: One of "s", "ms", "us", or "ns" (must be a constant)
- `time`: The time value to represent

### Return Value

The time as a string of epoch seconds, with the fractional precision implied
by the unit (e.g. "1602076312" for "s", "1602076312.123" for "ms")

### Examples

#### Epoch timestamps at different precisions

```vcl
set req.http.X-Epoch-S = time.units("s", now);
set req.http.X-Epoch-Ms = time.units("ms", now);
```

## time.runits

Represents a relative time as a string of seconds, to the decimal precision
of the specified unit.

### Syntax

```vcl
STRING time.runits(STRING unit, RTIME rtime)
```

### Parameters

- `unit`: One of "s", "ms", "us", or "ns" (must be a constant)
- `rtime`: The relative time value to represent

### Return Value

The relative time as a string of seconds with the precision implied by the unit

### Examples

#### Reporting elapsed request time

```vcl
# time.elapsed is an RTIME variable holding the time spent on the request
set req.http.X-Elapsed-Ms = time.runits("ms", time.elapsed);
```

## time.interval_elapsed_ratio

Computes how far a reference point lies within a time interval, as a ratio.
Returns 0.0 when the reference time is at the start of the interval, 1.0 at
the end, and values outside the 0-1 range when it falls outside the interval.

### Syntax

```vcl
FLOAT time.interval_elapsed_ratio(TIME ref, TIME start, TIME end)
```

### Parameters

- `ref`: The reference time
- `start`: The start of the interval
- `end`: The end of the interval

### Return Value

The elapsed fraction of the interval at the reference time

### Examples

#### Gradual traffic ramp-up

```vcl
declare local var.ramp_start TIME;
declare local var.ramp_end TIME;
declare local var.ratio FLOAT;

# Roll a feature out gradually over a day, starting at a fixed
# Unix timestamp (2026-07-01 00:00:00 UTC)
set var.ramp_start = std.time("1782864000", now);
set var.ramp_end = time.add(var.ramp_start, 24h);

set var.ratio = time.interval_elapsed_ratio(now, var.ramp_start, var.ramp_end);

if (var.ratio >= 1.0) {
  set req.http.X-Feature = "enabled";
} else if (var.ratio <= 0.0) {
  set req.http.X-Feature = "disabled";
} else {
  set req.http.X-Feature = "ramping";
}
```

## parse_time_delta

Parses a time delta string like "2d", "3h", "10m" or "30s" into a number of
seconds.

### Syntax

```vcl
INTEGER parse_time_delta(STRING specifier)
```

### Parameters

- `specifier`: A non-negative integer followed by an optional unit suffix:
  `d` (days), `h` (hours), `m` (minutes), or `s` (seconds, the default)

### Return Value

The number of seconds the delta represents, or -1 if the string cannot be
parsed

### Examples

#### Parsing a max-age style value

```vcl
declare local var.ttl_seconds INTEGER;

# Parse a TTL hint from a header
set var.ttl_seconds = parse_time_delta(req.http.X-TTL);

if (var.ttl_seconds >= 0) {
  set req.http.X-TTL-Seconds = var.ttl_seconds;
}
```

## Integrated Example: Complete Time Management System

This example demonstrates how multiple time functions can work together to create a comprehensive time management system. Remember that all times in VCL are UTC.

```vcl
sub vcl_recv {
  # Step 1: Format times for headers and logging
  declare local var.current_utc_formatted STRING;

  # Format current UTC time
  set var.current_utc_formatted = strftime("%Y-%m-%d %H:%M:%S GMT", now);

  # Set time-related headers
  set req.http.X-Current-UTC = var.current_utc_formatted;
  set req.http.X-Epoch = time.units("s", now);

  # Step 2: Check for time-based conditions
  declare local var.hour INTEGER;
  declare local var.day_of_week INTEGER;
  declare local var.is_weekend BOOL;
  declare local var.is_business_hours BOOL;

  # Get hour and day of week (UTC)
  set var.hour = std.atoi(strftime("%H", now));
  set var.day_of_week = std.atoi(strftime("%w", now));  # 0 = Sunday, 6 = Saturday

  # Check if it's a weekend
  set var.is_weekend = (var.day_of_week == 0 || var.day_of_week == 6);

  # Check if it's business hours (9 AM to 5 PM UTC, Monday to Friday)
  set var.is_business_hours = (!var.is_weekend && var.hour >= 9 && var.hour < 17);

  # Set condition headers
  set req.http.X-Is-Weekend = if(var.is_weekend, "true", "false");
  set req.http.X-Is-Business-Hours = if(var.is_business_hours, "true", "false");

  # Step 3: Calculate time windows and expirations
  declare local var.cache_ttl RTIME;
  declare local var.grace_period RTIME;
  declare local var.expires_time TIME;

  # Set different cache TTLs based on time conditions
  if (var.is_business_hours) {
    # Shorter TTL during business hours for more frequent updates
    set var.cache_ttl = 5m;
  } else if (var.is_weekend) {
    # Longer TTL during weekends
    set var.cache_ttl = 1h;
  } else {
    # Medium TTL during non-business hours on weekdays
    set var.cache_ttl = 15m;
  }

  # Set grace period
  set var.grace_period = 1h;

  # Calculate expires time
  set var.expires_time = time.add(now, var.cache_ttl);

  # Set cache-related headers
  set req.http.X-Cache-TTL = var.cache_ttl;
  set req.http.X-Grace-Period = var.grace_period;
  set req.http.X-Expires = strftime("%a, %d %b %Y %H:%M:%S GMT", var.expires_time);

  # Step 4: Check for scheduled maintenance
  declare local var.maintenance_start TIME;
  declare local var.maintenance_end TIME;
  declare local var.maintenance_active BOOL;

  # Maintenance window from a configuration source (parsed with std.time);
  # fall back to the epoch, which never matches
  set var.maintenance_start = std.time(req.http.X-Maintenance-Start-Config, std.integer2time(0));
  set var.maintenance_end = std.time(req.http.X-Maintenance-End-Config, std.integer2time(0));

  # Check if maintenance is active
  set var.maintenance_active = (time.is_after(now, var.maintenance_start) &&
      !time.is_after(now, var.maintenance_end));

  # Set maintenance headers
  set req.http.X-Maintenance-Start = strftime("%Y-%m-%d %H:%M:%S GMT", var.maintenance_start);
  set req.http.X-Maintenance-End = strftime("%Y-%m-%d %H:%M:%S GMT", var.maintenance_end);
  set req.http.X-Maintenance-Active = if(var.maintenance_active, "true", "false");
}
```

## Best Practices for Time Functions

1. Time Representation:
   - Use the TIME type for absolute time values
   - Use the RTIME type for relative time values (durations)
   - Be consistent with time formats throughout your code

2. Time Formatting:
   - Use strftime for consistent time formatting (the format must be a constant)
   - Use standard formats for HTTP headers (RFC 7231)
   - Document the format strings used in your code

3. Timezone Handling:
   - All times in VCL are UTC; there is no timezone conversion function
   - If local-time behavior is needed, apply fixed offsets with time.add and
     time.sub, or handle timezones at the origin

4. Time Calculations:
   - Use time.add and time.sub for offsetting times by durations
   - Use time.is_after for time comparisons
   - Use time.units to get epoch representations when arithmetic on
     timestamps is required (with assignment operators such as -=)

5. Performance Considerations:
   - Cache time values that are used multiple times
   - Minimize the number of time calculations in high-traffic code paths

6. Error Handling:
   - Use the fallback argument of std.time for missing or invalid input
   - Check parse_time_delta for its -1 error value
   - Handle edge cases (e.g., leap years, daylight saving time at the origin)

7. Time-Based Logic:
   - Use time windows for scheduling and rate limiting
   - Consider that clients live in many timezones while VCL times are UTC
   - Document the expected behavior of time-based features
