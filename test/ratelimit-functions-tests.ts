/**
 * Rate Limiting Functions Tests
 *
 * Tests for VCL rate limiting functions including:
 * - ratelimit.ratecounter_increment
 * - ratelimit.check_rate
 * - ratelimit.check_rates
 * - ratelimit.penaltybox_add
 * - ratelimit.penaltybox_has
 */

import type { VCLContext, VCLSubroutines } from "../src/vcl-compiler";
import { RateLimitModule } from "../src/vcl-ratelimit";
import { assert, executeSubroutine, runTestSuite } from "./test-framework";

const rateLimitFunctionsTests = {
	name: "Rate Limiting Functions Tests",
	tests: [
		{
			name: "Basic rate counter",
			vclSnippet: `
        ratecounter test_counter {}
        sub vcl_recv {
          set req.http.X-Counter-1 = ratelimit.ratecounter_increment(test_counter, client.ip, 1);
          set req.http.X-Counter-2 = ratelimit.ratecounter_increment(test_counter, client.ip, 2);
          set req.http.X-Counter-3 = ratelimit.ratecounter_increment(test_counter, client.ip, 3);
          return(lookup);
        }
      `,
			run: async (context: VCLContext, subroutines: VCLSubroutines) => {
				RateLimitModule.init();
				context.client = { ip: "127.0.0.1" };
				executeSubroutine(context, subroutines, "vcl_recv");
			},
			assertions: [
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Counter-1"] === "1",
						`Expected X-Counter-1 to be '1', got '${context.req.http["X-Counter-1"]}'`,
					);
				},
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Counter-2"] === "3",
						`Expected X-Counter-2 to be '3', got '${context.req.http["X-Counter-2"]}'`,
					);
				},
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Counter-3"] === "6",
						`Expected X-Counter-3 to be '6', got '${context.req.http["X-Counter-3"]}'`,
					);
				},
			],
		},

		{
			name: "Rate limit checking",
			vclSnippet: `
        ratecounter rc_test {}
        penaltybox pb_test {}
        sub vcl_recv {
          # check_rate: 5 requests in 60s window, increment by 6 -> exceeds threshold
          set req.http.X-Rate-Exceeded = ratelimit.check_rate(client.ip, rc_test, 5, 60, 6, pb_test, 30s);

          # Client should now be in the penalty box
          set req.http.X-In-Penalty = ratelimit.penaltybox_has(pb_test, client.ip);

          return(lookup);
        }
      `,
			run: async (context: VCLContext, subroutines: VCLSubroutines) => {
				RateLimitModule.init();
				context.client = { ip: "10.0.0.1" };
				executeSubroutine(context, subroutines, "vcl_recv");
			},
			assertions: [
				(context: VCLContext) => {
					return assert(
						context.req.http["X-Rate-Exceeded"] === "true",
						`Expected X-Rate-Exceeded to be 'true', got '${context.req.http["X-Rate-Exceeded"]}'`,
					);
				},
				(context: VCLContext) => {
					return assert(
						context.req.http["X-In-Penalty"] === "true",
						`Expected X-In-Penalty to be 'true', got '${context.req.http["X-In-Penalty"]}'`,
					);
				},
			],
		},

		{
			name: "Penalty box",
			vclSnippet: `
        penaltybox test_pb {}
        sub vcl_recv {
          # Add client to penalty box for 10 seconds
          set req.http.X-Add = ratelimit.penaltybox_add(test_pb, client.ip, 10);

          # Check if client is in penalty box (should be true)
          set req.http.X-In-Penalty-1 = ratelimit.penaltybox_has(test_pb, client.ip);

          # Check if another client is in penalty box (should be false)
          set req.http.X-In-Penalty-2 = ratelimit.penaltybox_has(test_pb, "192.168.1.2");

          return(lookup);
        }
      `,
			run: async (context: VCLContext, subroutines: VCLSubroutines) => {
				RateLimitModule.init();
				context.client = { ip: "192.168.1.1" };
				executeSubroutine(context, subroutines, "vcl_recv");
			},
			assertions: [
				(context: VCLContext) => {
					return assert(
						context.req.http["X-In-Penalty-1"] === "true",
						`Expected X-In-Penalty-1 to be 'true', got '${context.req.http["X-In-Penalty-1"]}'`,
					);
				},
				(context: VCLContext) => {
					return assert(
						context.req.http["X-In-Penalty-2"] === "false",
						`Expected X-In-Penalty-2 to be 'false', got '${context.req.http["X-In-Penalty-2"]}'`,
					);
				},
			],
		},
	],
};

runTestSuite(rateLimitFunctionsTests);

export default rateLimitFunctionsTests;
