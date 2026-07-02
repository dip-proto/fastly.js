# HTTP Object Model

In Fastly.JS the HTTP request and response are not separate, importable types — they are plain objects living on the per-request `VCLContext` produced by `createVCLContext()`. The shape is defined in [`src/vcl-compiler.ts`](../../src/vcl-compiler.ts), and these are the same objects VCL code reads and writes via `req.*`, `bereq.*`, `beresp.*`, `resp.*`, and `obj.*`.

There is no `createRequest`, `createResponse`, `parseHeaders`, or `parseCookies` helper to import; if you need a context, call `createVCLContext()` and mutate the fields you care about.

## The five objects

Every context exposes five HTTP-shaped objects, each with its own role:

| Object   | Direction | When it's populated                                            |
|----------|-----------|---------------------------------------------------------------|
| `req`    | client → proxy | Set up before `vcl_recv` from the inbound HTTP request   |
| `bereq`  | proxy → backend | Built from `req` after `vcl_miss` / `vcl_pass`           |
| `beresp` | backend → proxy | Filled in from the backend response, visible in `vcl_fetch`|
| `resp`   | proxy → client | Mirrors `beresp` (or a cached entry) before `vcl_deliver` |
| `obj`    | error / synthetic | Used by `error`, `synthetic`, and `vcl_error`           |

## Request: `req` and `bereq`

```typescript
req: {
  url: string;                       // path + query, e.g. "/api/users?page=2"
  method: string;                    // "GET", "POST", ...
  http: Record<string, string>;      // request headers, lowercased keys
  backend?: string;                  // selected backend name
  restarts?: number;                 // 0 on the first pass, incremented per restart
};

bereq: {
  url: string;                       // absolute URL sent to the backend
  method: string;
  http: Record<string, string>;
};
```

`req.url` is the path-and-query as seen by the proxy. `bereq.url` is the absolute URL that will be issued to the backend, with the chosen backend's host, port, and scheme baked in.

Header keys are matched exactly against the record — there is no case normalisation at lookup time. Headers arriving from the client are stored lowercased by the proxy (`index.ts` lowercases them before `vcl_recv`), and headers set from VCL keep whatever case the VCL source used. In practice this means VCL running behind the proxy should read client headers with lowercase names (`req.http.host`, `req.http.cookie`), while a header it set itself is read back with the same spelling it was written with.

## Response: `beresp` and `resp`

```typescript
beresp: {
  status: number;
  statusText: string;
  http: Record<string, string>;
  ttl: number;                       // seconds; 0 means "unset" — defaults apply after vcl_fetch
  grace?: number;                    // seconds
  stale_while_revalidate?: number;   // seconds
  do_esi?: boolean;                  // when true, vcl_deliver triggers ESI processing
};

resp: {
  status: number;
  statusText: string;
  http: Record<string, string>;
};
```

`beresp` is what the backend returned (and what `vcl_fetch` runs against); `resp` is what will go to the client (and what `vcl_deliver` runs against). The proxy copies `beresp.http` into `resp.http` and adds the bookkeeping headers `X-Cache` and `X-Backend`. Backend header names are lowercased as they land on `beresp.http`. The response *body* is not stored on either object — it's a `Uint8Array` carried by the surrounding pipeline (or, for synthetic responses, by `obj.response`).

## Errors and synthetic responses: `obj`

```typescript
obj: {
  status: number;
  response?: string;      // body for synthetic responses and error pages; unset until one is produced
  http: Record<string, string>;
  hits: number;
};
```

`obj` is the canvas used by `error 4xx "Reason";` and `synthetic { ... };`. The `vcl_error` subroutine reads and writes `obj.status`, `obj.response`, and `obj.http`; whatever it leaves there becomes the body delivered to the client when `vcl_error` returns `deliver`.

## Headers

Headers are plain JavaScript records. Both incoming directions normalise keys to lowercase before exposing them to VCL (client headers in `index.ts`, backend headers in the pipeline), so a `Host` header set by the client is found with the lowercase name:

```vcl
sub vcl_recv {
  set req.http.X-Original-Host = req.http.host;   # finds the inbound header
  # req.http.Host would NOT match — lookups are exact, not case-insensitive
}
```

Subfield syntax (`req.http.Foo:bar`) is recognised by the parser and mapped to substring lookups inside the header value. The standard library also exposes a programmatic interface on `context.std.header`; unlike direct property access, `get` and `remove` match the header name case-insensitively:

```typescript
context.std.header.get(headers, "X-Token");          // -> string | null
context.std.header.set(headers, "X-Token", "abc");
context.std.header.remove(headers, "X-Token");
context.std.header.filter(headers, "^X-Internal-");        // delete matches
context.std.header.filter_except(headers, "^Cache-");      // keep matches
```

## Query strings

Query parsing is exposed via `context.querystring` (mounted from `src/vcl-querystring.ts`) rather than as a parsed `req.query` field on the request object. From VCL:

```vcl
set req.url = querystring.set(req.url, "page", "2");
set req.url = querystring.globfilter(req.url, "utm_*");  # drop matching params
set req.url = querystring.sort(req.url);
set req.url = querystring.remove(req.url);               # strip the whole query string
```

Note that `querystring.remove(url)` takes a single argument and removes the entire query string; to drop individual parameters use `filter` (exact names, separated by `querystring.filtersep()`), `globfilter`, or `regfilter`.

If you need the parsed parameters as a record from JavaScript, call `URL` on the path:

```typescript
const params = new URL(context.req.url, "http://localhost").searchParams;
```

## Cookies

There is no separate `cookies` field on `req` or `resp`. Cookies travel in the regular `Cookie` and `Set-Cookie` headers and are read or written like any other header:

```vcl
sub vcl_recv {
  if (req.http.cookie ~ "session=([^;]+)") {
    set req.http.X-Session = re.group.1;
  }
}
```

For more sophisticated parsing, use the regex helpers under `std` or fall back to JavaScript by reading `context.req.http.cookie` directly.

## Constructing a context from JavaScript

If you embed Fastly.JS as a library, build a context with `createVCLContext()` and mutate it directly:

```typescript
import { createVCLContext } from "../src/vcl";

const context = createVCLContext();
context.req.method = "POST";
context.req.url = "/api/users";
context.req.http = {
  host: "example.com",
  "content-type": "application/json",
};

context.client = { ip: "203.0.113.7" };
```

Cloning the plain `req` / `bereq` / `beresp` / `resp` / `obj` objects is just `structuredClone` (the full context is not cloneable — it carries the standard library functions). There is no `cloneRequest` / `cloneResponse` helper — TypeScript's structural typing makes that unnecessary.

## See also

- [VCL Runtime](./vcl-runtime.md) for the surrounding `VCLContext` and how subroutines are dispatched.
- [Caching System](./caching-system.md) for how `beresp.ttl`, `grace`, and `stale_while_revalidate` interact with the cache map.
- [VCL Variables reference](../reference/vcl-variables.md) for the full list of `req.*`, `bereq.*`, `beresp.*`, `resp.*`, and `obj.*` properties accessible from VCL.
