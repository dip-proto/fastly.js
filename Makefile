.PHONY: install start test test-basic test-stdlib test-caching test-backend test-root test-all lint format check typecheck clean

install:
	bun install

start:
	bun run index.ts

test:
	bun run test/run-tests.ts

test-basic:
	bun run test/basic-vcl-tests.ts

test-stdlib:
	bun run test/stdlib-tests.ts

test-caching:
	bun run test/caching-tests.ts

test-backend:
	bun run test/backend-error-tests.ts

test-root:
	bun run test/run-root-tests.ts

test-all: test test-root

lint:
	bun run biome lint .

format:
	bun run biome format --write .

check:
	bun run biome check --write .

typecheck:
	tsc --noEmit
