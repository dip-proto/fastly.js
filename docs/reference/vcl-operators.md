# VCL Operators Reference

VCL (Varnish Configuration Language) operators perform operations on values and expressions. This document provides a reference for the standard VCL operators supported by Fastly.JS.

## Overview

VCL operators are organized into several categories:

1. **Arithmetic Operators**: Perform mathematical calculations
2. **Comparison Operators**: Compare values
3. **Logical Operators**: Combine boolean expressions
4. **String Operators**: Manipulate strings
5. **Assignment Operators**: Assign values to variables
6. **Bitwise Operators**: Perform bitwise operations
7. **Ternary Operator**: Conditional expression

## Arithmetic Operators

### Addition (+)

Adds two values.

**Syntax:**
```vcl
value1 + value2
```

**Example:**
```vcl
set var.sum = 1 + 2;  // 3
set var.concat = "Hello, " + "World!";  // "Hello, World!"
```

### Subtraction (-)

Subtracts one value from another.

**Syntax:**
```vcl
value1 - value2
```

**Example:**
```vcl
set var.diff = 5 - 2;  // 3
```

### Multiplication (*)

Multiplies two values.

**Syntax:**
```vcl
value1 * value2
```

**Example:**
```vcl
set var.product = 2 * 3;  // 6
```

### Division (/)

Divides one value by another.

**Syntax:**
```vcl
value1 / value2
```

**Example:**
```vcl
set var.quotient = 6 / 2;  // 3
```

### Modulo (%)

Returns the remainder of a division.

**Syntax:**
```vcl
value1 % value2
```

**Example:**
```vcl
set var.remainder = 5 % 2;  // 1
```

## Comparison Operators

### Equal (==)

Checks if two values are equal.

**Syntax:**
```vcl
value1 == value2
```

**Example:**
```vcl
if (req.method == "GET") {
  # Do something
}
```

### Not Equal (!=)

Checks if two values are not equal.

**Syntax:**
```vcl
value1 != value2
```

**Example:**
```vcl
if (req.method != "GET") {
  # Do something
}
```

### Less Than (<)

Checks if one value is less than another.

**Syntax:**
```vcl
value1 < value2
```

**Example:**
```vcl
if (var.count < 10) {
  # Do something
}
```

### Greater Than (>)

Checks if one value is greater than another.

**Syntax:**
```vcl
value1 > value2
```

**Example:**
```vcl
if (var.count > 10) {
  # Do something
}
```

### Less Than or Equal (<=)

Checks if one value is less than or equal to another.

**Syntax:**
```vcl
value1 <= value2
```

**Example:**
```vcl
if (var.count <= 10) {
  # Do something
}
```

### Greater Than or Equal (>=)

Checks if one value is greater than or equal to another.

**Syntax:**
```vcl
value1 >= value2
```

**Example:**
```vcl
if (var.count >= 10) {
  # Do something
}
```

## Logical Operators

### Logical AND (&&)

Returns true if both expressions are true.

**Syntax:**
```vcl
expression1 && expression2
```

**Example:**
```vcl
if (req.method == "GET" && req.url ~ "^/api/") {
  # Do something
}
```

### Logical OR (||)

Returns true if either expression is true.

**Syntax:**
```vcl
expression1 || expression2
```

**Example:**
```vcl
if (req.method == "GET" || req.method == "HEAD") {
  # Do something
}
```

### Logical NOT (!)

Returns the opposite of the expression.

**Syntax:**
```vcl
!expression
```

**Example:**
```vcl
if (!req.http.Cookie) {
  # Do something
}
```

## String Operators

### Concatenation (+)

Concatenates two strings.

**Syntax:**
```vcl
string1 + string2
```

**Example:**
```vcl
set var.full_url = "https://" + req.http.Host + req.url;
```

### Regular Expression Match (~)

Checks if a string matches a regular expression.

**Syntax:**
```vcl
string ~ regex
```

**Example:**
```vcl
if (req.url ~ "^/api/") {
  # Do something
}
```

### Regular Expression Not Match (!~)

Checks if a string does not match a regular expression.

**Syntax:**
```vcl
string !~ regex
```

**Example:**
```vcl
if (req.url !~ "^/api/") {
  # Do something
}
```

### Case-Insensitive Regular Expression Match (~*)

Checks if a string matches a case-insensitive regular expression.

**Syntax:**
```vcl
string ~* regex
```

**Example:**
```vcl
if (req.http.User-Agent ~* "mobile") {
  # Do something
}
```

### Case-Insensitive Regular Expression Not Match (!~*)

Checks if a string does not match a case-insensitive regular expression.

**Syntax:**
```vcl
string !~* regex
```

**Example:**
```vcl
if (req.http.User-Agent !~* "mobile") {
  # Do something
}
```

## Assignment Operators

### Assignment (=)

Assigns a value to a variable.

**Syntax:**
```vcl
variable = value
```

**Example:**
```vcl
set req.http.X-Custom = "value";
```

### Addition Assignment (+=)

Adds a value to a variable and assigns the result.

**Syntax:**
```vcl
variable += value
```

**Example:**
```vcl
set var.count += 1;
```

### Subtraction Assignment (-=)

Subtracts a value from a variable and assigns the result.

**Syntax:**
```vcl
variable -= value
```

**Example:**
```vcl
set var.count -= 1;
```

### Multiplication Assignment (*=)

Multiplies a variable by a value and assigns the result.

**Syntax:**
```vcl
variable *= value
```

**Example:**
```vcl
set var.count *= 2;
```

### Division Assignment (/=)

Divides a variable by a value and assigns the result.

**Syntax:**
```vcl
variable /= value
```

**Example:**
```vcl
set var.count /= 2;
```

### Modulo Assignment (%=)

Calculates the modulo of a variable and a value and assigns the result.

**Syntax:**
```vcl
variable %= value
```

**Example:**
```vcl
set var.count %= 10;
```

## Bitwise Operators

### Bitwise AND (&)

Performs a bitwise AND operation.

**Syntax:**
```vcl
value1 & value2
```

**Example:**
```vcl
set var.result = 5 & 3;  // 1
```

### Bitwise OR (|)

Performs a bitwise OR operation.

**Syntax:**
```vcl
value1 | value2
```

**Example:**
```vcl
set var.result = 5 | 3;  // 7
```

### Bitwise XOR (^)

Performs a bitwise XOR operation.

**Syntax:**
```vcl
value1 ^ value2
```

**Example:**
```vcl
set var.result = 5 ^ 3;  // 6
```

### Bitwise NOT (~)

Performs a bitwise NOT operation.

**Syntax:**
```vcl
~value
```

**Example:**
```vcl
set var.result = ~5;  // -6
```

### Left Shift (<<)

Performs a left shift operation.

**Syntax:**
```vcl
value1 << value2
```

**Example:**
```vcl
set var.result = 1 << 2;  // 4
```

### Right Shift (>>)

Performs a right shift operation.

**Syntax:**
```vcl
value1 >> value2
```

**Example:**
```vcl
set var.result = 4 >> 1;  // 2
```

## Ternary Operator

### Conditional Expression (? :)

Returns one of two values based on a condition.

**Syntax:**
```vcl
condition ? value_if_true : value_if_false
```

**Example:**
```vcl
set var.device_type = req.http.User-Agent ~ "Mobile" ? "mobile" : "desktop";
```

## Operator Precedence

Operators in VCL are evaluated in the following order of precedence (from highest to lowest):

1. Parentheses `()`
2. Unary operators `!`, `~`, `-` (negation)
3. Multiplicative operators `*`, `/`, `%`
4. Additive operators `+`, `-`
5. Shift operators `<<`, `>>`
6. Bitwise AND `&`
7. Bitwise XOR `^`
8. Bitwise OR `|`
9. Comparison operators `<`, `>`, `<=`, `>=`
10. Equality operators `==`, `!=`
11. Regular expression operators `~`, `!~`, `~*`, `!~*`
12. Logical AND `&&`
13. Logical OR `||`
14. Ternary operator `? :`
15. Assignment operators `=`, `+=`, `-=`, `*=`, `/=`, `%=`

## Examples

### Combining Operators

```vcl
if ((req.method == "GET" || req.method == "HEAD") && req.url ~ "^/api/") {
  set req.http.X-API = "true";
  return(pass);
}
```

### Using Parentheses to Control Precedence

```vcl
set var.result = (2 + 3) * 4;  // 20
set var.result = 2 + (3 * 4);  // 14
```

### Complex Expressions

```vcl
set var.score = (req.http.User-Agent ~ "Mobile" ? 10 : 5) + (req.url ~ "^/api/" ? 20 : 0);
```

## Conclusion

VCL operators provide a powerful way to manipulate values and control the flow of execution during the request-response lifecycle. By understanding and using these operators effectively, you can implement complex caching strategies, security measures, and content transformation logic.

For more information on VCL, see the [VCL Subroutines Reference](./vcl-subroutines.md), [VCL Variables Reference](./vcl-variables.md), [VCL Functions Reference](./vcl-functions.md), and [VCL Statements Reference](./vcl-statements.md).
