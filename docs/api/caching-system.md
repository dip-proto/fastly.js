# Caching System

Fastly.JS does not ship a separate caching library. The cache is a plain in-memory `Map` created by the proxy in [`index.ts`](../../index.ts) and driven by `runPipeline` in [`src/runtime/pipeline.ts`](../../src/runtime/pipeline.ts) — lookup, freshness decisions, and storage all live there. VCL steers it through the standard `vcl_hash`, `vcl_hit`, `vcl_miss`, `vcl_fetch`, and `vcl_deliver` subroutines and the TTL fields on `beresp`. This document describes how that machinery actually works so that you can reason about caching behaviour from VCL — there is no `createCache`, `generateCacheKey`, or `calculateTTL` function to import.

## Where the cache lives

`index.ts` creates a single `Map<string, CacheEntry>` shared across every request and passes it to `runPipeline` (as `PipelineOptions.cache`):

```typescript
const cache = new Map();
```

Each request gets its own `VCLContext`; the proxy also assigns this same shared map to `context.cache` so VCL-visible state points at it. There is no eviction policy beyond explicit deletion when an entry expires past its grace window: long-running processes will accumulate entries until restart, which is fine for a development tool but worth knowing.

## Cache keys

The cache key is built in `vcl_hash`. VCL code controls what goes into it through the `hash_data` statement, which appends to `context.hashData`:

```vcl
sub vcl_hash {
  hash_data(req.url);
  hash_data(req.http.host);
  return(hash);
}
```

After `vcl_hash` runs, the proxy joins `context.hashData` with `":"` to form the key. If `hashData` is empty, the proxy falls back to `${req.url}:${req.http.host || ""}`. There is no separate generator function — whatever your `vcl_hash` builds is exactly the key.

## Cache lookup, hits, and misses

After `vcl_recv` returns `lookup`, the pipeline:

1. Runs `vcl_hash` and computes the key.
2. Calls `cache.has(key)`. If present, decides between *fresh*, *stale*, or *expired* using timestamps stored on the entry.
3. On a fresh or stale hit, calls `vcl_hit`. If the subroutine returns `deliver`, the cached body and headers are sent back with `X-Cache: HIT` (or `HIT-STALE`), `X-Cache-Hits: 1`, and an `X-Cache-Age` header in seconds. A stale entry is deleted immediately after being served, so the next request refetches.
4. On a miss (or after expiry past the grace window), calls `vcl_miss`, then proceeds to fetch from the backend.

## TTL, grace, and stale-while-revalidate

These are the only three knobs that determine how long a response stays cached. They are properties of `beresp` set in `vcl_fetch`:

```vcl
sub vcl_fetch {
  set beresp.ttl = 1h;
  set beresp.grace = 24h;
  set beresp.stale_while_revalidate = 30s;
  return(deliver);
}
```

After `vcl_fetch` finishes, the proxy stamps the entry with three timestamps:

- `expires = now + ttl`
- `staleUntil = now + ttl + grace + stale_while_revalidate`
- `created = now`

When `beresp.ttl` is still `0` after `vcl_fetch` (i.e. the VCL never set it), the pipeline applies defaults of `ttl=300s`, `grace=3600s`, and `stale_while_revalidate=10s`. An entry is considered:

- **Fresh** while `now < expires`.
- **Stale** while `expires <= now < staleUntil` — still served, flagged with `X-Cache: HIT-STALE`, and deleted right after delivery.
- **Expired** otherwise — deleted on access; the request falls through to `vcl_miss`.

Note that `set beresp.ttl = 0s;` does *not* disable caching — a zero TTL reads as "unset" and triggers the defaults above. To keep a response out of the cache, set a negative TTL, or bypass the cache entirely by returning `pass` from `vcl_recv`. A response is only stored when the request went through the lookup path and `vcl_fetch` returned `deliver`.

## Cache entry shape

Each entry stored in the map has the following shape (the `CacheEntry` interface is defined and exported in [`src/runtime/pipeline.ts`](../../src/runtime/pipeline.ts)):

```typescript
interface CacheEntry {
  resp:       { status: number; statusText: string; http: Record<string, string> };
  body:       Uint8Array;
  created:    number;                    // ms since epoch
  expires:    number;
  staleUntil: number;
  beresp:     VCLContext["beresp"];      // includes ttl/grace/stale_while_revalidate
}
```

The body is stored as a `Uint8Array`, so binary responses round-trip cleanly.

## Headers added on delivery

The proxy adds bookkeeping headers to every response:

| Header        | Set on   | Value                                                           |
|---------------|----------|------------------------------------------------------------------|
| `X-Cache`     | hit      | `"HIT"` for fresh, `"HIT-STALE"` for stale-revalidate          |
| `X-Cache`     | miss     | `"MISS"`                                                        |
| `X-Cache-Hits`| hit      | `"1"`                                                           |
| `X-Cache-Age` | hit      | seconds since the entry was created                            |
| `X-Backend`   | miss     | the name of the backend that served the response               |

## Custom keys and per-route TTLs from VCL

Everything you would normally do through a "cache options" object is expressed in VCL itself:

```vcl
sub vcl_hash {
  hash_data(req.url);
  hash_data(req.http.host);
  # incoming header names are stored lowercase, and lookups are case-sensitive
  if (req.http.accept-language) {
    hash_data(req.http.accept-language);
  }
  return(hash);
}

sub vcl_fetch {
  if (req.url ~ "\.(jpg|jpeg|png|gif|css|js)$") {
    set beresp.ttl = 1h;
    set beresp.grace = 24h;
  } else if (req.url ~ "^/api/") {
    set beresp.ttl = 60s;
  } else {
    set beresp.ttl = 5m;
  }
  return(deliver);
}
```

## Manipulating the cache from JavaScript

If you embed Fastly.JS as a library you can interact with the underlying map directly. You own the map — create it yourself, hand it to `runPipeline`, and all the usual `Map` operations apply. (Note that `createVCLContext()` gives each context a fresh empty `context.cache`; sharing across requests only happens because the host assigns the same map to every context, as `index.ts` does.)

```typescript
import type { CacheEntry } from "../src/runtime/pipeline";

const cache = new Map<string, CacheEntry>();
// pass as PipelineOptions.cache, and optionally: context.cache = cache;

cache.delete("/some/key");
cache.clear();
console.log(cache.size);
```

There is no purge-by-pattern helper — iterate the keys and call `delete` if you need that behaviour:

```typescript
for (const key of cache.keys()) {
  if (key.startsWith("/api/")) cache.delete(key);
}
```

## See also

- [VCL Runtime](./vcl-runtime.md) for the context object the cache lives on.
- [HTTP Object Model](./http-object-model.md) for the `req`, `beresp`, and `resp` shapes referenced above.
- [Caching Strategies tutorial](../tutorials/03-caching-strategies.md) for VCL-level recipes built on this machinery.
