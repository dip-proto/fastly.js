# Simple HTTP Proxy

A TypeScript HTTP proxy server built with Bun that forwards requests from 127.0.0.1:8000 to [neverssl.com](http://neverssl.com).

## Features

- Listens on 127.0.0.1:8000
- Proxies all HTTP requests to [neverssl.com](http://neverssl.com)
- Preserves request methods, headers, and body
- Forwards response status, headers, and body back to the client

## Requirements

- [Bun](https://bun.sh) runtime (v1.0.0 or higher)

## Installation

```bash
# Clone the repository
git clone <repository-url>
cd <repository-directory>

# Install dependencies
bun install
```

## Usage

Start the proxy server:

```bash
bun run index.ts
```

Then, open your browser and navigate to:

```text
http://127.0.0.1:8000
```

All requests will be proxied to [neverssl.com](http://neverssl.com).

## Configuration

You can modify the following constants in `index.ts` to change the proxy settings:

- `TARGET_HOST`: The host to proxy requests to (default: "neverssl.com")
- `PROXY_HOST`: The host to listen on (default: "127.0.0.1")
- `PROXY_PORT`: The port to listen on (default: 8000)

## License

MIT

---

This project was created using `bun init` in bun v1.2.13. [Bun](https://bun.sh) is a fast all-in-one JavaScript runtime.
