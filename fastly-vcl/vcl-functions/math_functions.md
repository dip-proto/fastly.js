# Math Functions

This file demonstrates comprehensive examples of Math Functions in VCL.
These functions provide mathematical operations for numerical computations
at the edge, enabling sophisticated data processing and transformations.

## FUNCTION GROUP: BASIC ARITHMETIC AND ROUNDING FUNCTIONS

These functions handle basic arithmetic operations and rounding:
- math.ceil: Rounds up to the nearest integer
- math.floor: Rounds down to the nearest integer
- math.round: Rounds to the nearest integer
- math.trunc: Truncates the decimal part (rounds toward zero)
- math.roundeven: Rounds to the nearest even integer when exactly halfway
- math.roundhalfup: Rounds up when exactly halfway
- math.roundhalfdown: Rounds down when exactly halfway

### FUNCTION: math.ceil

PURPOSE: Rounds up to the nearest integer
SYNTAX: math.ceil(FLOAT x)

PARAMETERS:
- x: The floating-point value to round up

RETURN VALUE: The smallest integer greater than or equal to x

### FUNCTION: math.floor

PURPOSE: Rounds down to the nearest integer
SYNTAX: math.floor(FLOAT x)

PARAMETERS:
- x: The floating-point value to round down

RETURN VALUE: The largest integer less than or equal to x

### FUNCTION: math.round

PURPOSE: Rounds to the nearest integer
SYNTAX: math.round(FLOAT x)

PARAMETERS:
- x: The floating-point value to round

RETURN VALUE: The nearest integer to x, rounding halfway cases away from zero

### FUNCTION: math.trunc

PURPOSE: Truncates the decimal part (rounds toward zero)
SYNTAX: math.trunc(FLOAT x)

PARAMETERS:
- x: The floating-point value to truncate

RETURN VALUE: The integer part of x (removes decimal portion)

### FUNCTION: math.roundeven

PURPOSE: Rounds to the nearest even integer when exactly halfway
SYNTAX: math.roundeven(FLOAT x)

PARAMETERS:
- x: The floating-point value to round

RETURN VALUE: The nearest integer to x, rounding halfway cases to the nearest even integer

### FUNCTION: math.roundhalfup

PURPOSE: Rounds up when exactly halfway
SYNTAX: math.roundhalfup(FLOAT x)

PARAMETERS:
- x: The floating-point value to round

RETURN VALUE: The nearest integer to x, rounding halfway cases away from zero

### FUNCTION: math.roundhalfdown

PURPOSE: Rounds down when exactly halfway
SYNTAX: math.roundhalfdown(FLOAT x)

PARAMETERS:
- x: The floating-point value to round

RETURN VALUE: The nearest integer to x, rounding halfway cases toward zero

### Examples

#### Basic rounding operations

```vcl
declare local var.value FLOAT;
declare local var.ceil_result FLOAT;
declare local var.floor_result FLOAT;
declare local var.round_result FLOAT;
declare local var.trunc_result FLOAT;

set var.value = 3.7;

# Apply different rounding functions
set var.ceil_result = math.ceil(var.value);    # 4.0
set var.floor_result = math.floor(var.value);  # 3.0
set var.round_result = math.round(var.value);  # 4.0
set var.trunc_result = math.trunc(var.value);  # 3.0

# Log the results
log "Original value: " + var.value;
log "Ceiling: " + var.ceil_result;
log "Floor: " + var.floor_result;
log "Round: " + var.round_result;
log "Truncate: " + var.trunc_result;
```

#### Handling negative numbers

```vcl
declare local var.neg_value FLOAT;
declare local var.neg_ceil FLOAT;
declare local var.neg_floor FLOAT;
declare local var.neg_round FLOAT;
declare local var.neg_trunc FLOAT;

set var.neg_value = -2.3;

# Apply rounding functions to negative numbers
set var.neg_ceil = math.ceil(var.neg_value);    # -2.0
set var.neg_floor = math.floor(var.neg_value);  # -3.0
set var.neg_round = math.round(var.neg_value);  # -2.0
set var.neg_trunc = math.trunc(var.neg_value);  # -2.0

# Log the results
log "Original negative value: " + var.neg_value;
log "Ceiling: " + var.neg_ceil;
log "Floor: " + var.neg_floor;
log "Round: " + var.neg_round;
log "Truncate: " + var.neg_trunc;
```

#### Special rounding modes for tie-breaking

```vcl
declare local var.tie_value FLOAT;
declare local var.roundeven_result FLOAT;
declare local var.roundhalfup_result FLOAT;
declare local var.roundhalfdown_result FLOAT;

# Value exactly halfway between integers
set var.tie_value = 2.5;

# Apply different tie-breaking rounding functions
set var.roundeven_result = math.roundeven(var.tie_value);        # 2.0 (nearest even)
set var.roundhalfup_result = math.roundhalfup(var.tie_value);    # 3.0 (rounds up)
set var.roundhalfdown_result = math.roundhalfdown(var.tie_value); # 2.0 (rounds down)

# Log the results
log "Tie-breaking value: " + var.tie_value;
log "Round to even: " + var.roundeven_result;
log "Round half up: " + var.roundhalfup_result;
log "Round half down: " + var.roundhalfdown_result;
```

#### Practical application - price rounding

```vcl
declare local var.price FLOAT;
declare local var.rounded_price FLOAT;
declare local var.ceiling_price FLOAT;
declare local var.floor_price FLOAT;

set var.price = 19.237;

# Round to 2 decimal places (cents)
set var.rounded_price = math.round(var.price * 100) / 100;  # 19.24

# Ceiling to nearest dollar (always round up)
set var.ceiling_price = math.ceil(var.price);  # 20.0

# Floor to nearest dollar (always round down)
set var.floor_price = math.floor(var.price);  # 19.0

# Log the results
log "Original price: " + var.price;
log "Rounded price (2 decimals): " + var.rounded_price;
log "Ceiling price (nearest dollar): " + var.ceiling_price;
log "Floor price (nearest dollar): " + var.floor_price;
```

## FUNCTION GROUP: TRIGONOMETRIC FUNCTIONS

These functions handle trigonometric operations:
- math.sin, math.cos, math.tan: Standard trigonometric functions
- math.asin, math.acos, math.atan, math.atan2: Inverse trigonometric functions
- math.sinh, math.cosh, math.tanh: Hyperbolic functions
- math.asinh, math.acosh, math.atanh: Inverse hyperbolic functions

### FUNCTION: math.sin

PURPOSE: Calculates the sine of an angle in radians
SYNTAX: math.sin(FLOAT x)

PARAMETERS:
- x: The angle in radians

RETURN VALUE: The sine of x

### FUNCTION: math.cos

PURPOSE: Calculates the cosine of an angle in radians
SYNTAX: math.cos(FLOAT x)

PARAMETERS:
- x: The angle in radians

RETURN VALUE: The cosine of x

### FUNCTION: math.tan

PURPOSE: Calculates the tangent of an angle in radians
SYNTAX: math.tan(FLOAT x)

PARAMETERS:
- x: The angle in radians

RETURN VALUE: The tangent of x

### FUNCTION: math.asin

PURPOSE: Calculates the arcsine (inverse sine) of a value
SYNTAX: math.asin(FLOAT x)

PARAMETERS:
- x: The value whose arcsine is to be calculated (between -1 and 1)

RETURN VALUE: The arcsine of x in radians (between -π/2 and π/2)

### FUNCTION: math.acos

PURPOSE: Calculates the arccosine (inverse cosine) of a value
SYNTAX: math.acos(FLOAT x)

PARAMETERS:
- x: The value whose arccosine is to be calculated (between -1 and 1)

RETURN VALUE: The arccosine of x in radians (between 0 and π)

### FUNCTION: math.atan

PURPOSE: Calculates the arctangent (inverse tangent) of a value
SYNTAX: math.atan(FLOAT x)

PARAMETERS:
- x: The value whose arctangent is to be calculated

RETURN VALUE: The arctangent of x in radians (between -π/2 and π/2)

### FUNCTION: math.atan2

PURPOSE: Calculates the arctangent of y/x, using the signs of both arguments to determine the quadrant
SYNTAX: math.atan2(FLOAT y, FLOAT x)

PARAMETERS:
- y: The y-coordinate
- x: The x-coordinate

RETURN VALUE: The arctangent of y/x in radians (between -π and π)

### FUNCTION: math.sinh

PURPOSE: Calculates the hyperbolic sine of a value
SYNTAX: math.sinh(FLOAT x)

PARAMETERS:
- x: The value whose hyperbolic sine is to be calculated

RETURN VALUE: The hyperbolic sine of x

### FUNCTION: math.cosh

PURPOSE: Calculates the hyperbolic cosine of a value
SYNTAX: math.cosh(FLOAT x)

PARAMETERS:
- x: The value whose hyperbolic cosine is to be calculated

RETURN VALUE: The hyperbolic cosine of x

### FUNCTION: math.tanh

PURPOSE: Calculates the hyperbolic tangent of a value
SYNTAX: math.tanh(FLOAT x)

PARAMETERS:
- x: The value whose hyperbolic tangent is to be calculated

RETURN VALUE: The hyperbolic tangent of x

### FUNCTION: math.asinh

PURPOSE: Calculates the inverse hyperbolic sine of a value
SYNTAX: math.asinh(FLOAT x)

PARAMETERS:
- x: The value whose inverse hyperbolic sine is to be calculated

RETURN VALUE: The inverse hyperbolic sine of x

### FUNCTION: math.acosh

PURPOSE: Calculates the inverse hyperbolic cosine of a value
SYNTAX: math.acosh(FLOAT x)

PARAMETERS:
- x: The value whose inverse hyperbolic cosine is to be calculated (must be ≥ 1)

RETURN VALUE: The inverse hyperbolic cosine of x

### FUNCTION: math.atanh

PURPOSE: Calculates the inverse hyperbolic tangent of a value
SYNTAX: math.atanh(FLOAT x)

PARAMETERS:
- x: The value whose inverse hyperbolic tangent is to be calculated (between -1 and 1)

RETURN VALUE: The inverse hyperbolic tangent of x

### Examples

#### Basic trigonometric functions

```vcl
declare local var.angle_degrees FLOAT;
declare local var.angle_radians FLOAT;
declare local var.sin_result FLOAT;
declare local var.cos_result FLOAT;
declare local var.tan_result FLOAT;

# Convert degrees to radians (π radians = 180 degrees)
set var.angle_degrees = 45.0;
set var.angle_radians = var.angle_degrees * math.pi / 180.0;

# Calculate trigonometric values
set var.sin_result = math.sin(var.angle_radians);  # ~0.7071
set var.cos_result = math.cos(var.angle_radians);  # ~0.7071
set var.tan_result = math.tan(var.angle_radians);  # ~1.0

# Log the results
log "Angle in degrees: " + var.angle_degrees;
log "Angle in radians: " + var.angle_radians;
log "Sine: " + var.sin_result;
log "Cosine: " + var.cos_result;
log "Tangent: " + var.tan_result;
```

#### Inverse trigonometric functions

```vcl
declare local var.value FLOAT;
declare local var.asin_result FLOAT;
declare local var.acos_result FLOAT;
declare local var.atan_result FLOAT;

set var.value = 0.5;

# Calculate inverse trigonometric values
set var.asin_result = math.asin(var.value);  # ~0.5236 radians (30 degrees)
set var.acos_result = math.acos(var.value);  # ~1.0472 radians (60 degrees)
set var.atan_result = math.atan(var.value);  # ~0.4636 radians (~26.57 degrees)

# Convert results back to degrees
declare local var.asin_degrees FLOAT;
declare local var.acos_degrees FLOAT;
declare local var.atan_degrees FLOAT;

set var.asin_degrees = var.asin_result * 180.0 / math.pi;
set var.acos_degrees = var.acos_result * 180.0 / math.pi;
set var.atan_degrees = var.atan_result * 180.0 / math.pi;

# Log the results
log "Value: " + var.value;
log "Arcsine: " + var.asin_result + " radians (" + var.asin_degrees + " degrees)";
log "Arccosine: " + var.acos_result + " radians (" + var.acos_degrees + " degrees)";
log "Arctangent: " + var.atan_result + " radians (" + var.atan_degrees + " degrees)";
```

#### Using atan2 for angle calculation

```vcl
declare local var.x FLOAT;
declare local var.y FLOAT;
declare local var.angle FLOAT;
declare local var.angle_deg FLOAT;

set var.x = 3.0;
set var.y = 4.0;

# Calculate the angle using atan2
set var.angle = math.atan2(var.y, var.x);  # ~0.9273 radians (~53.13 degrees)
set var.angle_deg = var.angle * 180.0 / math.pi;

# Log the results
log "Point coordinates: (" + var.x + ", " + var.y + ")";
log "Angle from positive x-axis: " + var.angle + " radians (" + var.angle_deg + " degrees)";
```

#### Hyperbolic functions

```vcl
declare local var.value FLOAT;
declare local var.sinh_result FLOAT;
declare local var.cosh_result FLOAT;
declare local var.tanh_result FLOAT;

set var.value = 1.0;

# Calculate hyperbolic values
set var.sinh_result = math.sinh(var.value);  # ~1.1752
set var.cosh_result = math.cosh(var.value);  # ~1.5431
set var.tanh_result = math.tanh(var.value);  # ~0.7616

# Log the results
log "Value: " + var.value;
log "Hyperbolic sine: " + var.sinh_result;
log "Hyperbolic cosine: " + var.cosh_result;
log "Hyperbolic tangent: " + var.tanh_result;
```

#### Inverse hyperbolic functions

```vcl
declare local var.asinh_result FLOAT;
declare local var.acosh_result FLOAT;
declare local var.atanh_result FLOAT;

# Calculate inverse hyperbolic values
set var.asinh_result = math.asinh(var.sinh_result);  # Should be close to 1.0
set var.acosh_result = math.acosh(var.cosh_result);  # Should be close to 1.0
set var.atanh_result = math.atanh(var.tanh_result);  # Should be close to 1.0

# Log the results
log "Inverse hyperbolic sine: " + var.asinh_result;
log "Inverse hyperbolic cosine: " + var.acosh_result;
log "Inverse hyperbolic tangent: " + var.atanh_result;
```

#### Practical application - calculating distance

```vcl
declare local var.lat1 FLOAT;
declare local var.lon1 FLOAT;
declare local var.lat2 FLOAT;
declare local var.lon2 FLOAT;
declare local var.distance FLOAT;

# Coordinates in radians (convert from degrees if needed)
set var.lat1 = 40.7128 * math.pi / 180.0;  # New York
set var.lon1 = -74.0060 * math.pi / 180.0;
set var.lat2 = 34.0522 * math.pi / 180.0;  # Los Angeles
set var.lon2 = -118.2437 * math.pi / 180.0;

# Calculate distance using the Haversine formula
declare local var.dlat FLOAT;
declare local var.dlon FLOAT;
declare local var.a FLOAT;
declare local var.c FLOAT;
declare local var.r FLOAT;

set var.dlat = var.lat2 - var.lat1;
set var.dlon = var.lon2 - var.lon1;
set var.a = math.sin(var.dlat/2) * math.sin(var.dlat/2) + 
           math.cos(var.lat1) * math.cos(var.lat2) * 
           math.sin(var.dlon/2) * math.sin(var.dlon/2);
set var.c = 2 * math.atan2(math.sqrt(var.a), math.sqrt(1-var.a));
set var.r = 6371.0;  # Earth's radius in kilometers
set var.distance = var.r * var.c;

# Log the result
log "Distance between New York and Los Angeles: " + var.distance + " km";
## FUNCTION GROUP: EXPONENTIAL AND LOGARITHMIC FUNCTIONS

These functions handle exponential and logarithmic operations:
- math.exp: Calculates e^x
- math.exp2: Calculates 2^x
- math.log: Calculates the natural logarithm (base e)
- math.log2: Calculates the logarithm base 2
- math.sqrt: Calculates the square root

### FUNCTION: math.exp

PURPOSE: Calculates e^x (e raised to the power of x)
SYNTAX: math.exp(FLOAT x)

PARAMETERS:
- x: The exponent

RETURN VALUE: e^x

### FUNCTION: math.exp2

PURPOSE: Calculates 2^x (2 raised to the power of x)
SYNTAX: math.exp2(FLOAT x)

PARAMETERS:
- x: The exponent

RETURN VALUE: 2^x

### FUNCTION: math.log

PURPOSE: Calculates the natural logarithm (base e) of a value
SYNTAX: math.log(FLOAT x)

PARAMETERS:
- x: The value whose logarithm is to be calculated (must be > 0)

RETURN VALUE: The natural logarithm of x

### FUNCTION: math.log2

PURPOSE: Calculates the logarithm base 2 of a value
SYNTAX: math.log2(FLOAT x)

PARAMETERS:
- x: The value whose logarithm is to be calculated (must be > 0)

RETURN VALUE: The logarithm base 2 of x

### FUNCTION: math.sqrt

PURPOSE: Calculates the square root of a value
SYNTAX: math.sqrt(FLOAT x)

PARAMETERS:
- x: The value whose square root is to be calculated (must be ≥ 0)

RETURN VALUE: The square root of x

### Examples

#### Basic exponential functions

```vcl
declare local var.value FLOAT;
declare local var.exp_result FLOAT;
declare local var.exp2_result FLOAT;

set var.value = 2.0;

# Calculate exponential values
set var.exp_result = math.exp(var.value);   # e^2 ≈ 7.3891
set var.exp2_result = math.exp2(var.value); # 2^2 = 4.0

# Log the results
log "Value: " + var.value;
log "e^x: " + var.exp_result;
log "2^x: " + var.exp2_result;
```

#### Logarithmic functions

```vcl
declare local var.log_result FLOAT;
declare local var.log2_result FLOAT;

# Calculate logarithmic values
set var.log_result = math.log(var.exp_result);   # Should be close to 2.0
set var.log2_result = math.log2(var.exp2_result); # Should be close to 2.0

# Log the results
log "Natural logarithm (base e): " + var.log_result;
log "Logarithm base 2: " + var.log2_result;
```

#### Square root function

```vcl
declare local var.sqrt_result FLOAT;

# Calculate square root
set var.sqrt_result = math.sqrt(var.value);  # √2 ≈ 1.4142

# Log the result
log "Square root: " + var.sqrt_result;
```

#### Practical application - compound interest

```vcl
declare local var.principal FLOAT;
declare local var.rate FLOAT;
declare local var.time FLOAT;
declare local var.compound_interest FLOAT;

set var.principal = 1000.0;  # Initial investment
set var.rate = 0.05;         # 5% annual interest rate
set var.time = 10.0;         # 10 years

# Calculate compound interest: P * e^(rt)
set var.compound_interest = var.principal * math.exp(var.rate * var.time);

# Log the result
log "Principal: $" + var.principal;
log "Annual interest rate: " + (var.rate * 100) + "%";
log "Time period: " + var.time + " years";
log "Final amount with compound interest: $" + var.compound_interest;
```

#### Practical application - binary data units conversion

```vcl
declare local var.bytes FLOAT;
declare local var.kilobytes FLOAT;
declare local var.megabytes FLOAT;
declare local var.gigabytes FLOAT;

set var.bytes = 1073741824.0;  # 1 GB in bytes

# Convert to different units
set var.kilobytes = var.bytes / math.exp2(10);
set var.megabytes = var.bytes / math.exp2(20);
set var.gigabytes = var.bytes / math.exp2(30);

# Log the results
log "Bytes: " + var.bytes;
log "Kilobytes: " + var.kilobytes;
log "Megabytes: " + var.megabytes;
log "Gigabytes: " + var.gigabytes;
```

## FUNCTION GROUP: SPECIAL NUMBER CHECKING FUNCTIONS

These functions check for special floating-point values:
- math.is_finite: Checks if a value is finite
- math.is_infinite: Checks if a value is infinite
- math.is_nan: Checks if a value is NaN (Not a Number)
- math.is_normal: Checks if a value is normal
- math.is_subnormal: Checks if a value is subnormal

### FUNCTION: math.is_finite

PURPOSE: Checks if a value is finite
SYNTAX: math.is_finite(FLOAT x)

PARAMETERS:
- x: The value to check

RETURN VALUE: TRUE if x is finite, FALSE otherwise

### FUNCTION: math.is_infinite

PURPOSE: Checks if a value is infinite
SYNTAX: math.is_infinite(FLOAT x)

PARAMETERS:
- x: The value to check

RETURN VALUE: TRUE if x is infinite, FALSE otherwise

### FUNCTION: math.is_nan

PURPOSE: Checks if a value is NaN (Not a Number)
SYNTAX: math.is_nan(FLOAT x)

PARAMETERS:
- x: The value to check

RETURN VALUE: TRUE if x is NaN, FALSE otherwise

### FUNCTION: math.is_normal

PURPOSE: Checks if a value is normal
SYNTAX: math.is_normal(FLOAT x)

PARAMETERS:
- x: The value to check

RETURN VALUE: TRUE if x is normal, FALSE otherwise

### FUNCTION: math.is_subnormal

PURPOSE: Checks if a value is subnormal
SYNTAX: math.is_subnormal(FLOAT x)

PARAMETERS:
- x: The value to check

RETURN VALUE: TRUE if x is subnormal, FALSE otherwise

### Examples

#### Checking for special values

```vcl
declare local var.regular_value FLOAT;
declare local var.infinite_value FLOAT;
declare local var.nan_value FLOAT;

set var.regular_value = 42.0;
set var.infinite_value = 1.0 / 0.0;  # Infinity
set var.nan_value = 0.0 / 0.0;       # NaN

# Check if values are finite
log "Is regular value finite? " + math.is_finite(var.regular_value);   # true
log "Is infinite value finite? " + math.is_finite(var.infinite_value); # false
log "Is NaN value finite? " + math.is_finite(var.nan_value);           # false

# Check if values are infinite
log "Is regular value infinite? " + math.is_infinite(var.regular_value);   # false
log "Is infinite value infinite? " + math.is_infinite(var.infinite_value); # true
log "Is NaN value infinite? " + math.is_infinite(var.nan_value);           # false

# Check if values are NaN
log "Is regular value NaN? " + math.is_nan(var.regular_value);   # false
log "Is infinite value NaN? " + math.is_nan(var.infinite_value); # false
log "Is NaN value NaN? " + math.is_nan(var.nan_value);           # true
```

#### Checking for normal and subnormal values

```vcl
declare local var.normal_value FLOAT;
declare local var.subnormal_value FLOAT;
declare local var.zero_value FLOAT;

set var.normal_value = 1.0e-20;
set var.subnormal_value = 1.0e-310;  # Might be subnormal depending on implementation
set var.zero_value = 0.0;

# Check if values are normal
log "Is regular value normal? " + math.is_normal(var.normal_value);     # true
log "Is subnormal value normal? " + math.is_normal(var.subnormal_value); # false
log "Is zero value normal? " + math.is_normal(var.zero_value);           # false

# Check if values are subnormal
log "Is regular value subnormal? " + math.is_subnormal(var.normal_value);     # false
log "Is subnormal value subnormal? " + math.is_subnormal(var.subnormal_value); # true
log "Is zero value subnormal? " + math.is_subnormal(var.zero_value);           # false
```

#### Practical application - error handling in calculations

```vcl
declare local var.input FLOAT;
declare local var.result FLOAT;
declare local var.is_valid BOOL;

# Get input from a request parameter (simulated)
set var.input = std.atof(header.get(req.http, "X-Value", "0"));

# Perform a calculation that might result in special values
set var.result = math.log(var.input);

# Check if the result is valid
set var.is_valid = math.is_finite(var.result) && !math.is_nan(var.result);

if (var.is_valid) {
  # Result is valid
  set req.http.X-Result = var.result;
  set req.http.X-Status = "valid";
} else {
  # Result is invalid
  set req.http.X-Result = "0";
  set req.http.X-Status = "invalid";
  
  # Determine the specific issue
  if (math.is_nan(var.result)) {
    set req.http.X-Error = "Result is NaN";
  } else if (math.is_infinite(var.result)) {
    set req.http.X-Error = "Result is infinite";
  } else {
    set req.http.X-Error = "Unknown error";
  }
}
```

## Integrated Example: Advanced Mathematical Processing System

This example demonstrates how multiple math functions can work together to create a comprehensive mathematical processing system.

```vcl
sub vcl_recv {
  # Step 1: Extract and validate input parameters
  declare local var.x FLOAT;
  declare local var.y FLOAT;
  declare local var.operation STRING;
  declare local var.result FLOAT;
  declare local var.is_valid BOOL;
  
  # Get input parameters (simulated)
  set var.x = std.atof(header.get(req.http, "X-Value-1", "0"));
  set var.y = std.atof(header.get(req.http, "X-Value-2", "0"));
  set var.operation = header.get(req.http, "X-Operation", "add");
  
  # Step 2: Validate inputs
  set var.is_valid = math.is_finite(var.x) && math.is_finite(var.y);
  
  if (!var.is_valid) {
    # Invalid inputs
    set req.http.X-Status = "error";
    set req.http.X-Error = "Invalid input values";
    return;
  }
  
  # Step 3: Perform the requested operation
  if (var.operation == "add") {
    set var.result = var.x + var.y;
  } else if (var.operation == "subtract") {
    set var.result = var.x - var.y;
  } else if (var.operation == "multiply") {
    set var.result = var.x * var.y;
  } else if (var.operation == "divide") {
    # Check for division by zero
    if (var.y == 0) {
      set req.http.X-Status = "error";
      set req.http.X-Error = "Division by zero";
      return;
    }
    set var.result = var.x / var.y;
  } else if (var.operation == "power") {
    # Calculate x^y using exp and log: x^y = e^(y*ln(x))
    # Check for valid inputs for power operation
    if (var.x <= 0) {
      set req.http.X-Status = "error";
      set req.http.X-Error = "Base must be positive for power operation";
      return;
    }
    set var.result = math.exp(var.y * math.log(var.x));
  } else if (var.operation == "sqrt") {
    # Check for negative input
    if (var.x < 0) {
      set req.http.X-Status = "error";
      set req.http.X-Error = "Cannot calculate square root of negative number";
      return;
    }
    set var.result = math.sqrt(var.x);
  } else if (var.operation == "log") {
    # Check for valid input for logarithm
    if (var.x <= 0) {
      set req.http.X-Status = "error";
      set req.http.X-Error = "Cannot calculate logarithm of non-positive number";
      return;
    }
    set var.result = math.log(var.x);
  } else if (var.operation == "sin") {
    # Convert degrees to radians
    set var.result = math.sin(var.x * math.pi / 180.0);
  } else if (var.operation == "cos") {
    # Convert degrees to radians
    set var.result = math.cos(var.x * math.pi / 180.0);
  } else if (var.operation == "tan") {
    # Convert degrees to radians
    set var.result = math.tan(var.x * math.pi / 180.0);
  } else if (var.operation == "round") {
    set var.result = math.round(var.x);
  } else {
    # Unknown operation
    set req.http.X-Status = "error";
    set req.http.X-Error = "Unknown operation: " + var.operation;
    return;
  }
  
  # Step 4: Validate the result
  if (!math.is_finite(var.result)) {
    # Result is not valid
    set req.http.X-Status = "error";
    if (math.is_nan(var.result)) {
      set req.http.X-Error = "Result is not a number";
    } else if (math.is_infinite(var.result)) {
      set req.http.X-Error = "Result is infinite";
    } else {
      set req.http.X-Error = "Invalid result";
    }
    return;
  }
  
  # Step 5: Format and return the result
  set req.http.X-Status = "success";
  set req.http.X-Result = var.result;
  
  # Step 6: Add additional information for certain operations
  if (var.operation == "sin" || var.operation == "cos" || var.operation == "tan") {
    set req.http.X-Input-Degrees = var.x;
    set req.http.X-Input-Radians = var.x * math.pi / 180.0;
  } else if (var.operation == "round") {
    set req.http.X-Original-Value = var.x;
    set req.http.X-Ceiling = math.ceil(var.x);
    set req.http.X-Floor = math.floor(var.x);
  }
}
```

## Best Practices for Math Functions

1. Input Validation:
   - Always validate inputs before performing mathematical operations
   - Check for special values (NaN, infinity) using the appropriate functions
   - Handle edge cases (division by zero, negative inputs for sqrt/log, etc.)

2. Precision Considerations:
   - Be aware of floating-point precision limitations
   - Use rounding functions appropriately for financial calculations
   - Consider using integer arithmetic when exact precision is required

3. Performance Optimization:
   - Avoid unnecessary calculations in high-traffic paths
   - Pre-compute constants where possible
   - Use simpler functions when appropriate (e.g., math.sqrt instead of math.pow)

4. Error Handling:
   - Always check for special values in results
   - Provide meaningful error messages
   - Have fallback strategies for invalid results

5. Trigonometric Functions:
   - Remember that trigonometric functions use radians, not degrees
   - Convert between degrees and radians using the formula: radians = degrees * π/180
   - Be careful with angles near singularities (e.g., tan(90°))

6. Logarithmic and Exponential Functions:
   - Check for valid domains (e.g., positive inputs for logarithms)
   - Be aware of potential overflow/underflow with extreme values
   - Use the appropriate base (natural log, log base 2) for your application

7. Rounding Functions:
   - Choose the appropriate rounding function for your use case
   - Be consistent in rounding approaches throughout your application
   - Pay special attention to rounding in financial calculations