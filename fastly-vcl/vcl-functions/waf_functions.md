# WAF Functions

Fastly VCL does not provide any WAF functions. Functions such as
`waf.allow()`, `waf.block()`, `waf.log()`, `waf.rate_limit()` or
`waf.rate_limit_tokens()` do not exist on the Fastly platform, and calling
them fails to compile.

WAF integration in Fastly VCL was instead exposed through a set of `waf.*`
variables, populated by the legacy Fastly WAF while it evaluated a request.
These variables belong to the deprecated legacy WAF product and are not
available for general use:

- `waf.executed` (BOOL): whether the WAF ran for this request
- `waf.blocked` (BOOL): whether the WAF blocked the request
- `waf.logged` (BOOL): whether the WAF logged the request
- `waf.passed` (BOOL): whether the request passed the WAF
- `waf.failures` (INTEGER): number of WAF rules that could not complete
- `waf.anomaly_score` (INTEGER): sum of the scores of each matched rule
- `waf.rule_id` (INTEGER), `waf.severity` (INTEGER), `waf.message` (STRING),
  `waf.logdata` (STRING): details of the matched rule
- Attack-category scores (all INTEGER): `waf.sql_injection_score`,
  `waf.xss_score`, `waf.rce_score`, `waf.lfi_score`, `waf.rfi_score`,
  `waf.php_injection_score`, `waf.session_fixation_score`,
  `waf.http_violation_score`

For the use cases the nonexistent functions above suggest, use standard VCL
instead:

- To block a request, use the `error` statement (for example
  `error 403 "Forbidden"`) and customize the response in `vcl_error`.
- To allow or exempt traffic, branch on conditions (client IP against an ACL,
  headers, paths) before applying blocking logic.
- To throttle clients, use the rate limiting functions
  (`ratelimit.check_rate`, `ratelimit.check_rates`,
  `ratelimit.penaltybox_add`, `ratelimit.penaltybox_has`,
  `ratelimit.ratecounter_increment`) documented in
  [rate_limiting_functions.md](rate_limiting_functions.md).
- For managed WAF capabilities, use the Fastly Next-Gen WAF product, which is
  configured outside of VCL.

## Example: security controls without WAF functions

```vcl
acl trusted_ips {
  "10.0.0.0"/8;
  "192.0.2.1";
}

ratecounter abuse_rc {}
penaltybox abuse_pb {}

sub vcl_recv {
  # Exempt trusted clients from the checks below
  if (client.ip ~ trusted_ips) {
    return(lookup);
  }

  # Block requests with suspicious query strings
  if (req.url.qs ~ "(?i)(union|select|insert|update|delete|drop)\s") {
    error 403 "Forbidden";
  }

  # Throttle abusive clients: 10 requests per second, 15 minute penalty
  if (ratelimit.check_rate(client.ip, abuse_rc, 1, 10, 10, abuse_pb, 15m)) {
    error 429 "Too Many Requests";
  }
}
```
