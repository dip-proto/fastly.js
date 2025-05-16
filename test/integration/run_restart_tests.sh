#!/bin/bash

# Run all restart integration tests

echo "Running restart integration tests..."
echo "===================================="

# Run URL normalization test
echo -e "\n\n=== URL Normalization Test ==="
bun run test/integration/restart_url_normalization_test.ts

# Run authentication test
echo -e "\n\n=== Authentication Test ==="
bun run test/integration/restart_auth_token_test.ts

# Run backend failover test
echo -e "\n\n=== Backend Failover Test ==="
bun run test/integration/restart_backend_failover_test.ts

# Run A/B testing test
echo -e "\n\n=== A/B Testing Test ==="
bun run test/integration/restart_ab_testing_test.ts

echo -e "\n\n=== All Tests Completed ==="
