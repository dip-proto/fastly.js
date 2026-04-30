# Caching System

Fastly.JS does not ship a separate caching library. The cache is a plain in-memory `Map` owned by the proxy in [`index.ts`](../../index.ts), driven by VCL through the standard `vcl_hash`, `vcl_hit`, `vcl_miss`, `vcl_fetch`, and `vcl_deliver` subroutines, and parameterised by the TTL fields on `beresp`. This document describes how that machinery actually works so that you can reason about caching behaviour from VCL — there is no `createCache`, `generateCacheKey`, or `calculateTTL` function to import.

## Where the cache lives

`index.ts` creates a single `Map<string, CacheEntry>` shared across every request:

```typescript
const cache = new Map();
```

Each request gets its own `VCLContext`, but `context.cache` points at this same shared map, which is also exposed to VCL through the runtime context. There is no eviction policy beyond explicit deletion when an entry expires past its grace window: long-running processes will accumulate entries until restart, which is fine for a development tool but worth knowing.

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
3. On a fresh or stale hit, calls `vcl_hit`. If the subroutine returns `deliver`, the cached body and headers are sent back with `X-Cache: HIT` (or `HIT-STALE`), `X-Cache-Hits: 1`, and an `X-Cache-Age` header in seconds. Stale entries are scheduled for asynchronous removal.
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

When `vcl_fetch` does not set `beresp.ttl`, the proxy uses defaults of `ttl=300s`, `grace=3600s`, and `stale_while_revalidate=10s`. An entry is considered:

- **Fresh** while `now < expires`.
- **Stale** while `expires <= now < staleUntil` — still served, but flagged with `X-Cache: HIT-STALE` and removed asynchronously.
- **Expired** otherwise — deleted on access; the request falls through to `vcl_miss`.

Setting `beresp.ttl = 0s` disables caching for that response.

## Cache entry shape

Each entry stored in the map has the following shape (defined inline in `index.ts`):

```typescript
type CacheEntry = {
  resp:       VCLContext["resp"];        // status, statusText, http
  body:       ArrayBuffer;
  beresp:     VCLContext["beresp"];      // includes ttl/grace/stale_while_revalidate
  created:    number;                    // ms since epoch
  expires:    number;
  staleUntil: number;
};
```

The body is stored as an `ArrayBuffer`, so binary responses round-trip cleanly.

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
  if (req.http.Accept-Language) {
    hash_data(req.http.Accept-Language);
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

If you embed Fastly.JS as a library you can interact with the underlying map directly. The map is just a plain `Map`, so all the usual operations apply:

```typescript
import { createVCLContext } from "../src/vcl";

const context = createVCLContext();
const cache = context.cache; // Map<string, CacheEntry>

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
