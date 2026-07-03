# VCL Operators Reference

VCL (Varnish Configuration Language) operators perform operations on values and expressions. This document provides a reference for the standard VCL operators supported by Fastly.JS.

## Overview

VCL operators are organized into several categories:

1. **Arithmetic Operators**: Perform mathematical calculations
2. **Comparison Operators**: Compare values
3. **Logical Operators**: Combine boolean expressions
4. **String Operators**: Manipulate strings
5. **Assignment Operators**: Assign values to variables, including compound
   arithmetic, logical, and bitwise forms
6. **Conditional Expression**: Choose a value with the `if()` function

Note that bitwise operations exist only as compound assignment operators
(`&=`, `|=`, `^=`, `<<=`, `>>=`, `rol=`, `ror=`); there are no infix bitwise
operators in expressions.

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

Divides one value by another. INTEGER division truncates toward zero; if
either operand is a FLOAT, the result is a FLOAT.

**Syntax:**
```vcl
value1 / value2
```

**Example:**
```vcl
set var.quotient = 7 / 2;  // 3 for INTEGERs, 3.5 if either side is a FLOAT
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
if (!req.http.cookie) {
  # Do something
}
```

(Header lookups are case-sensitive, and Fastly.JS stores incoming request and
origin response header names in lowercase — hence `req.http.cookie` rather
than `req.http.Cookie` when reading a client-supplied header.)

## String Operators

### Concatenation (+)

Concatenates two strings.

**Syntax:**
```vcl
string1 + string2
```

**Example:**
```vcl
set var.full_url = "https://" + req.http.host + req.url;
```

### Implicit Concatenation

Adjacent values without an operator between them are also concatenated. This
is the idiomatic form in Fastly VCL.

**Syntax:**
```vcl
string1 string2
```

**Example:**
```vcl
set var.full_url = "https://" req.http.host req.url;
```

### Regular Expression Match (~)

Checks if a string matches a regular expression. Capture groups from the most
recent successful match are available as `re.group.1` through `re.group.9`
(and `re.group.0` for the whole match). There is no `~*` operator; use an
inline `(?i)` flag for case-insensitive matching. When the right-hand side
names an ACL, `~` performs an ACL membership check instead.

**Syntax:**
```vcl
string ~ regex
ip ~ acl_name
```

**Example:**
```vcl
if (req.url ~ "^/api/") {
  # Do something
}
if (req.http.user-agent ~ "(?i)mobile") {
  # Case-insensitive match
}
if (client.ip ~ internal_ips) {
  # ACL check
}
```

An ACL match follows Fastly's rules: the most specific (longest-prefix) entry
that contains the address decides the outcome, and a negated entry (`! "..."`)
excludes it.
So a negated `/32` inside a positive `/24` carves out that one address.
The `"localhost"` entry stands for exactly `127.0.0.1` and `::1`, a bare IPv4
entry is a `/32` and a bare IPv6 entry a `/128`, and a value that is not a valid
IP never matches.

### Regular Expression Not Match (!~)

Checks if a string does not match a regular expression (or, with an ACL name
on the right, that an IP is not in the ACL).

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
Division or modulo by zero is a runtime error.

**Syntax:**
```vcl
variable %= value
```

**Example:**
```vcl
set var.count %= 10;
```

### Logical Assignment (&&=, ||=)

Combines the variable with a value using boolean AND/OR and assigns the
result.

**Example:**
```vcl
set var.ok &&= var.authenticated;
set var.flagged ||= var.suspicious;
```

### Bitwise Assignment (&=, |=, ^=, <<=, >>=, rol=, ror=)

Applies a 64-bit integer bitwise operation to the variable and assigns the
result: AND, OR, XOR, left shift, arithmetic right shift, rotate left, and
rotate right. These are the only bitwise operations in VCL; there are no
infix bitwise operators.

**Example:**
```vcl
declare local var.bits INTEGER;
set var.bits = 5;
set var.bits &= 3;    // 1
set var.bits <<= 2;   // 4
set var.bits rol= 1;  // 8
```

## Conditional Expression

VCL has no `? :` ternary operator. To pick between two values based on a
condition, use the `if()` function instead.

**Syntax:**
```vcl
if(condition, value_if_true, value_if_false)
```

**Example:**
```vcl
set var.device_type = if(req.http.user-agent ~ "Mobile", "mobile", "desktop");
```

## Operator Precedence

Operators in VCL are evaluated in the following order of precedence (from highest to lowest):

1. Parentheses `()`
2. Unary operators `!`, `-` (negation)
3. Implicit concatenation (adjacent values)
4. Multiplicative operators `*`, `/`, `%`
5. Additive operators `+`, `-`
6. Regular expression / ACL operators `~`, `!~`
7. Comparison operators `<`, `>`, `<=`, `>=`
8. Equality operators `==`, `!=`
9. Logical AND `&&`
10. Logical OR `||`

Assignment (including the compound forms) is not an expression operator; it
only appears in `set` statements.

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
set var.score = if(req.http.user-agent ~ "Mobile", 10, 5) + if(req.url ~ "^/api/", 20, 0);
```

## Conclusion

VCL operators provide a powerful way to manipulate values and control the flow of execution during the request-response lifecycle. By understanding and using these operators effectively, you can implement complex caching strategies, security measures, and content transformation logic.

For more information on VCL, see the [VCL Subroutines Reference](./vcl-subroutines.md), [VCL Variables Reference](./vcl-variables.md), [VCL Functions Reference](./vcl-functions.md), and [VCL Statements Reference](./vcl-statements.md).
