# Time Functions

This file demonstrates comprehensive examples of Time Functions in VCL.
These functions help manipulate, format, and compare time values for
time-based logic, caching decisions, and response headers.

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
set var.window_start = time.add(now, -1h);

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

# Get retry count from a header
set var.retry_count = std.atoi(req.http.X-Retry-Count);

# Calculate exponential backoff (1s, 2s, 4s, 8s, etc.)
declare local var.backoff_seconds RTIME;
set var.backoff_seconds = 1s * math.pow(2, var.retry_count);

# Calculate retry time
set var.retry_after = time.add(now, var.backoff_seconds);

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
set var.in_maintenance = (now >= var.maintenance_start && now <= var.maintenance_end);

# Set maintenance window headers
set req.http.X-Maintenance-Start = strftime("%Y-%m-%d %H:%M:%S GMT", var.maintenance_start);
set req.http.X-Maintenance-End = strftime("%Y-%m-%d %H:%M:%S GMT", var.maintenance_end);
set req.http.X-In-Maintenance = if(var.in_maintenance, "true", "false");
```

## time.sub

Subtracts two time values to get the difference.

### Syntax

```vcl
RTIME time.sub(TIME time1, TIME time2)
```

### Parameters

- `time1`: The first time value
- `time2`: The second time value to subtract from the first

### Return Value

The difference between the two times as a relative time (RTIME)

### Examples

#### Basic time subtraction

```vcl
declare local var.time1 TIME;
declare local var.time2 TIME;
declare local var.difference RTIME;

# Set two times
set var.time1 = now;
set var.time2 = time.add(now, -1h);  # 1 hour ago

# Calculate the difference
set var.difference = time.sub(var.time1, var.time2);

# Log the difference
log "Time difference: " + var.difference;  # Should be close to 3600s (1 hour)
```

#### Calculating age of content

```vcl
declare local var.response_time TIME;
declare local var.age RTIME;

# Set response time (example: 5 minutes ago)
set var.response_time = time.add(now, -5m);

# Calculate age
set var.age = time.sub(now, var.response_time);

# Set Age header
set req.http.X-Age = var.age;
```

#### Calculating time until expiration

```vcl
declare local var.expires_time TIME;
declare local var.time_until_expiry RTIME;

# Set expires time to 24 hours from now
set var.expires_time = time.add(now, 24h);

# Calculate time until expiry
set var.time_until_expiry = time.sub(var.expires_time, now);

# Log time until expiry
log "Time until expiry: " + var.time_until_expiry + " seconds";
```

#### Calculating request processing time

```vcl
declare local var.request_start_time TIME;
declare local var.request_end_time TIME;
declare local var.processing_time RTIME;

# Set request start time (example: 100ms ago)
set var.request_start_time = time.add(now, -100ms);
set var.request_end_time = now;

# Calculate processing time
set var.processing_time = time.sub(var.request_end_time, var.request_start_time);

# Log processing time
log "Request processing time: " + var.processing_time + " seconds";
```

#### Calculating time since last modification

```vcl
declare local var.last_modified TIME;
declare local var.time_since_modified RTIME;

# Set last modified time (example: 3 days ago)
set var.last_modified = time.add(now, -3d);

# Calculate time since last modification
set var.time_since_modified = time.sub(now, var.last_modified);

# Log time since last modification
log "Time since last modified: " + var.time_since_modified + " seconds";
```

## time.is_after

Checks if one time is after another.

### Syntax

```vcl
BOOL time.is_after(TIME time1, TIME time2)
```

### Parameters

- `time1`: The first time value
- `time2`: The second time value

### Return Value

- TRUE if time1 is after time2
- FALSE otherwise

### Examples

#### Basic time comparison

```vcl
declare local var.time1 TIME;
declare local var.time2 TIME;
declare local var.is_after BOOL;

# Set two times
set var.time1 = now;
set var.time2 = time.add(now, -1h);  # 1 hour ago

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
set var.expires_time = time.add(now, -24h);

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
set var.window_start = time.add(now, -1h);  # 1 hour ago
set var.window_end = time.add(now, 1h);     # 1 hour from now

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
set var.event_time = time.add(now, -2d);

# Check if the event has passed
set var.event_passed = time.is_after(now, var.event_time);

# Log the result
log "Has the event passed? " + if(var.event_passed, "Yes", "No");  # Should be "Yes"
```

## time.hex_to_time

Converts a hexadecimal string to a time value.

### Syntax

```vcl
TIME time.hex_to_time(STRING hex)
```

### Parameters

- `hex`: A hexadecimal string representing a Unix timestamp

### Return Value

The corresponding time value

### Examples

#### Basic hex to time conversion

```vcl
declare local var.hex_time STRING;
declare local var.time_value TIME;

# Set a hexadecimal time value (example: 0x5F7D7E98 = 1602086552 = 2020-10-07 14:29:12 UTC)
set var.hex_time = "5F7D7E98";

# Convert hex to time
set var.time_value = time.hex_to_time(var.hex_time);

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
  set var.header_time = time.hex_to_time(var.header_hex_time);
  
  # Set a formatted time header
  set req.http.X-Timestamp = strftime("%Y-%m-%d %H:%M:%S", var.header_time);
}
```

#### Calculating time difference from hex timestamp

```vcl
declare local var.event_hex_time STRING;
declare local var.event_time TIME;
declare local var.time_since_event RTIME;

# Set a hexadecimal event time
set var.event_hex_time = "5F7D7E98";  # 2020-10-07 14:29:12 UTC

# Convert hex to time
set var.event_time = time.hex_to_time(var.event_hex_time);

# Calculate time since event
set var.time_since_event = time.sub(now, var.event_time);

# Log the result
log "Time since event: " + var.time_since_event + " seconds";
```

#### Checking if a hex timestamp is in the future

```vcl
declare local var.future_hex_time STRING;
declare local var.future_time TIME;
declare local var.is_future BOOL;

# Set a hexadecimal future time (this example uses a fixed value, but in practice would be dynamic)
set var.future_hex_time = "FFFFFFFF";  # Far in the future

# Convert hex to time
set var.future_time = time.hex_to_time(var.future_hex_time);

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
set var.created_time = time.hex_to_time(var.created_hex);
set var.updated_time = time.hex_to_time(var.updated_hex);

# Log the results
log "Created: " + strftime("%Y-%m-%d %H:%M:%S", var.created_time);
log "Updated: " + strftime("%Y-%m-%d %H:%M:%S", var.updated_time);

# Check which is more recent
if (time.is_after(var.updated_time, var.created_time)) {
  log "Item has been updated since creation";
}
```

## strftime

Formats a time value as a string.

### Syntax

```vcl
STRING strftime(STRING format, TIME time)
```

### Parameters

- `format`: The format string (similar to C's strftime)
- `time`: The time value to format

### Return Value

The formatted time string

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

## time.zone

Converts a time value to a specific timezone.

### Syntax

```vcl
TIME time.zone(TIME time, STRING timezone)
```

### Parameters

- `time`: The time value to convert
- `timezone`: The timezone to convert to (e.g., "America/New_York", "Europe/London")

### Return Value

The time value adjusted for the specified timezone

### Examples

#### Basic timezone conversion

```vcl
declare local var.utc_time TIME;
declare local var.ny_time TIME;
declare local var.london_time TIME;
declare local var.tokyo_time TIME;

# Get the current UTC time
set var.utc_time = now;

# Convert to different timezones
set var.ny_time = time.zone(var.utc_time, "America/New_York");
set var.london_time = time.zone(var.utc_time, "Europe/London");
set var.tokyo_time = time.zone(var.utc_time, "Asia/Tokyo");

# Log the times in different timezones
log "UTC time: " + strftime("%Y-%m-%d %H:%M:%S", var.utc_time);
log "New York time: " + strftime("%Y-%m-%d %H:%M:%S", var.ny_time);
log "London time: " + strftime("%Y-%m-%d %H:%M:%S", var.london_time);
log "Tokyo time: " + strftime("%Y-%m-%d %H:%M:%S", var.tokyo_time);
```

#### Timezone-specific headers

```vcl
declare local var.user_timezone STRING;
declare local var.user_time TIME;

# Get user timezone from a header
set var.user_timezone = req.http.X-User-Timezone;

if (var.user_timezone) {
  # Convert current time to user's timezone
  set var.user_time = time.zone(now, var.user_timezone);
  
  # Set a header with the user's local time
  set req.http.X-User-Local-Time = strftime("%Y-%m-%d %H:%M:%S", var.user_time);
}
```

#### Business hours check

```vcl
declare local var.business_timezone STRING;
declare local var.business_time TIME;
declare local var.hour INTEGER;
declare local var.is_business_hours BOOL;

# Set business timezone
set var.business_timezone = "America/New_York";

# Convert current time to business timezone
set var.business_time = time.zone(now, var.business_timezone);

# Get the hour in the business timezone
set var.hour = std.atoi(strftime("%H", var.business_time));

# Check if it's business hours (9 AM to 5 PM)
set var.is_business_hours = (var.hour >= 9 && var.hour < 17);

# Set a header indicating business hours
set req.http.X-Business-Hours = if(var.is_business_hours, "open", "closed");
```

#### Timezone-aware scheduling

```vcl
declare local var.event_timezone STRING;
declare local var.event_time TIME;
declare local var.event_local_time TIME;
declare local var.time_until_event RTIME;

# Set event details
set var.event_timezone = "Europe/London";
set var.event_time = time.hex_to_time("5F7D7E98");  # Some fixed time

# Convert event time to local timezone
set var.event_local_time = time.zone(var.event_time, var.event_timezone);

# Calculate time until event
set var.time_until_event = time.sub(var.event_local_time, time.zone(now, var.event_timezone));

# Log event details
log "Event time (UTC): " + strftime("%Y-%m-%d %H:%M:%S", var.event_time);
log "Event time (local): " + strftime("%Y-%m-%d %H:%M:%S", var.event_local_time);
log "Time until event: " + var.time_until_event + " seconds";
```

#### Multi-timezone display

```vcl
declare local var.current_utc TIME;
declare local var.timezones STRING;
declare local var.timezone_times STRING;

# Get current UTC time
set var.current_utc = now;

# Define timezones to display
set var.timezones = "UTC,America/New_York,Europe/London,Asia/Tokyo,Australia/Sydney";

# Build a string with times in different timezones
set var.timezone_times = "Current times: ";

# This is a simplified example; in practice, you would need to handle each timezone individually
set var.timezone_times = var.timezone_times + "UTC=" + strftime("%H:%M", var.current_utc);
set var.timezone_times = var.timezone_times + ", NY=" + strftime("%H:%M", time.zone(var.current_utc, "America/New_York"));
set var.timezone_times = var.timezone_times + ", London=" + strftime("%H:%M", time.zone(var.current_utc, "Europe/London"));
set var.timezone_times = var.timezone_times + ", Tokyo=" + strftime("%H:%M", time.zone(var.current_utc, "Asia/Tokyo"));
set var.timezone_times = var.timezone_times + ", Sydney=" + strftime("%H:%M", time.zone(var.current_utc, "Australia/Sydney"));

# Log the timezone times
log var.timezone_times;
```

## Integrated Example: Complete Time Management System

This example demonstrates how multiple time functions can work together to create a comprehensive time management system.

```vcl
sub vcl_recv {
  # Step 1: Determine the user's timezone
  declare local var.user_timezone STRING;
  declare local var.user_time TIME;
  
  # Get user timezone from a header or cookie
  if (req.http.X-User-Timezone) {
    set var.user_timezone = req.http.X-User-Timezone;
  } else if (req.http.Cookie:timezone) {
    set var.user_timezone = req.http.Cookie:timezone;
  } else {
    # Default to UTC
    set var.user_timezone = "UTC";
  }
  
  # Convert current time to user's timezone
  set var.user_time = time.zone(now, var.user_timezone);
  
  # Step 2: Format times for headers and logging
  declare local var.current_utc_formatted STRING;
  declare local var.user_time_formatted STRING;
  
  # Format current UTC time
  set var.current_utc_formatted = strftime("%Y-%m-%d %H:%M:%S GMT", now);
  
  # Format user's local time
  set var.user_time_formatted = strftime("%Y-%m-%d %H:%M:%S", var.user_time);
  
  # Set time-related headers
  set req.http.X-Current-UTC = var.current_utc_formatted;
  set req.http.X-User-Local-Time = var.user_time_formatted;
  
  # Step 3: Check for time-based conditions
  declare local var.hour INTEGER;
  declare local var.day_of_week INTEGER;
  declare local var.is_weekend BOOL;
  declare local var.is_business_hours BOOL;
  
  # Get hour and day of week in user's timezone
  set var.hour = std.atoi(strftime("%H", var.user_time));
  set var.day_of_week = std.atoi(strftime("%w", var.user_time));  # 0 = Sunday, 6 = Saturday
  
  # Check if it's a weekend
  set var.is_weekend = (var.day_of_week == 0 || var.day_of_week == 6);
  
  # Check if it's business hours (9 AM to 5 PM, Monday to Friday)
  set var.is_business_hours = (!var.is_weekend && var.hour >= 9 && var.hour < 17);
  
  # Set condition headers
  set req.http.X-Is-Weekend = if(var.is_weekend, "true", "false");
  set req.http.X-Is-Business-Hours = if(var.is_business_hours, "true", "false");
  
  # Step 4: Calculate time windows and expirations
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
  
  # Step 5: Check for scheduled maintenance
  declare local var.maintenance_start TIME;
  declare local var.maintenance_end TIME;
  declare local var.maintenance_active BOOL;
  declare local var.time_until_maintenance RTIME;
  
  # Set maintenance window (example: next Sunday from 2 AM to 4 AM UTC)
  # In practice, these would come from a configuration source
  
  # Find the next Sunday
  declare local var.days_until_sunday INTEGER;
  set var.days_until_sunday = 7 - var.day_of_week;
  if (var.days_until_sunday == 7) {
    set var.days_until_sunday = 0;  # Today is already Sunday
  }
  
  # Set maintenance start time (next Sunday at 2 AM UTC)
  set var.maintenance_start = now;
  set var.maintenance_start = time.add(var.maintenance_start, var.days_until_sunday * 24h);  # Add days until Sunday
  # Reset to 2 AM on that day (simplified approach)
  set var.maintenance_start = time.add(var.maintenance_start, 2h - var.hour * 1h);
  
  # Set maintenance end time (2 hours after start)
  set var.maintenance_end = time.add(var.maintenance_start, 2h);
  
  # Check if maintenance is active
  set var.maintenance_active = (now >= var.maintenance_start && now <= var.maintenance_end);
  
  # Calculate time until maintenance
  if (!var.maintenance_active && time.is_after(var.maintenance_start, now)) {
    set var.time_until_maintenance = time.sub(var.maintenance_start, now);
    set req.http.X-Time-Until-Maintenance = var.time_until_maintenance;
  }
  
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
   - Use strftime for consistent time formatting
   - Use standard formats for HTTP headers (RFC 7231)
   - Document the format strings used in your code

3. Timezone Handling:
   - Be explicit about timezones when working with times
   - Use time.zone to convert between timezones
   - Default to UTC when no timezone is specified

4. Time Calculations:
   - Use time.add for adding time offsets
   - Use time.sub for calculating time differences
   - Use time.is_after for time comparisons

5. Performance Considerations:
   - Cache time values that are used multiple times
   - Minimize the number of time calculations in high-traffic code paths
   - Be aware of the performance impact of timezone conversions

6. Error Handling:
   - Validate time values before using them
   - Provide sensible defaults for missing or invalid times
   - Handle edge cases (e.g., leap years, daylight saving time)

7. Time-Based Logic:
   - Use time windows for scheduling and rate limiting
   - Consider the implications of time-based logic across timezones
   - Document the expected behavior of time-based features