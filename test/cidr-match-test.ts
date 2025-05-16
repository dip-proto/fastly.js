import { describe, expect, it } from "bun:test";
import { createVCLContext } from "../src/vcl";

describe("CIDR Matching Tests", () => {
	it("should correctly match IPv4 addresses in CIDR ranges", () => {
		const context = createVCLContext();

		// Add an ACL
		context.std.acl.add("test_ipv4");

		// Add entries to the ACL
		context.std.acl.add_entry("test_ipv4", "192.168.0.0", 24);
		context.std.acl.add_entry("test_ipv4", "10.0.0.0", 8);
		context.std.acl.add_entry("test_ipv4", "172.16.0.0", 12);
		context.std.acl.add_entry("test_ipv4", "127.0.0.1"); // Single IP

		// Test exact match
		expect(context.std.acl.check("127.0.0.1", "test_ipv4")).toBe(true);
		expect(context.std.acl.check("127.0.0.2", "test_ipv4")).toBe(false);

		// Test CIDR matches
		// 192.168.0.0/24 should match 192.168.0.1 through 192.168.0.255
		expect(context.std.acl.check("192.168.0.1", "test_ipv4")).toBe(true);
		expect(context.std.acl.check("192.168.0.255", "test_ipv4")).toBe(true);
		expect(context.std.acl.check("192.168.1.1", "test_ipv4")).toBe(false);

		// 10.0.0.0/8 should match 10.0.0.0 through 10.255.255.255
		expect(context.std.acl.check("10.0.0.1", "test_ipv4")).toBe(true);
		expect(context.std.acl.check("10.255.255.255", "test_ipv4")).toBe(true);
		expect(context.std.acl.check("11.0.0.1", "test_ipv4")).toBe(false);

		// 172.16.0.0/12 should match 172.16.0.0 through 172.31.255.255
		expect(context.std.acl.check("172.16.0.1", "test_ipv4")).toBe(true);
		expect(context.std.acl.check("172.31.255.255", "test_ipv4")).toBe(true);
		expect(context.std.acl.check("172.32.0.1", "test_ipv4")).toBe(false);
	});

	it("should correctly match IPv6 addresses in CIDR ranges", () => {
		const context = createVCLContext();

		// Add an ACL
		context.std.acl.add("test_ipv6");

		// Add entries to the ACL
		context.std.acl.add_entry("test_ipv6", "2001:db8::", 32);
		context.std.acl.add_entry("test_ipv6", "fe80::", 10);
		context.std.acl.add_entry("test_ipv6", "::1"); // Single IP (localhost)

		// Test exact match
		expect(context.std.acl.check("::1", "test_ipv6")).toBe(true);
		expect(context.std.acl.check("::2", "test_ipv6")).toBe(false);

		// Test CIDR matches
		// 2001:db8::/32 should match 2001:db8:: through 2001:db8:ffff:ffff:ffff:ffff:ffff:ffff
		expect(context.std.acl.check("2001:db8::1", "test_ipv6")).toBe(true);
		expect(
			context.std.acl.check(
				"2001:db8:ffff:ffff:ffff:ffff:ffff:ffff",
				"test_ipv6",
			),
		).toBe(true);
		expect(context.std.acl.check("2001:db9::", "test_ipv6")).toBe(false);

		// fe80::/10 should match fe80:: through febf:ffff:ffff:ffff:ffff:ffff:ffff:ffff
		expect(context.std.acl.check("fe80::1", "test_ipv6")).toBe(true);
		expect(
			context.std.acl.check(
				"febf:ffff:ffff:ffff:ffff:ffff:ffff:ffff",
				"test_ipv6",
			),
		).toBe(true);
		expect(context.std.acl.check("fec0::", "test_ipv6")).toBe(false);
	});

	it("should handle IPv6 address normalization", () => {
		const context = createVCLContext();

		// Add an ACL
		context.std.acl.add("test_ipv6_norm");

		// Add entries to the ACL
		context.std.acl.add_entry("test_ipv6_norm", "2001:db8::", 32);
		context.std.acl.add_entry("test_ipv6_norm", "::ffff:192.168.0.0", 120); // IPv4-mapped IPv6 with /120 (equivalent to /24 in IPv4)

		// Test with abbreviated IPv6 addresses
		expect(
			context.std.acl.check("2001:db8:0:0:0:0:0:1", "test_ipv6_norm"),
		).toBe(true);
		expect(context.std.acl.check("2001:db8::1", "test_ipv6_norm")).toBe(true);

		// Test with IPv4-mapped IPv6 addresses
		expect(context.std.acl.check("::ffff:192.168.0.1", "test_ipv6_norm")).toBe(
			true,
		);
		expect(context.std.acl.check("::ffff:192.168.1.1", "test_ipv6_norm")).toBe(
			false,
		);
	});

	it("should handle invalid IP addresses gracefully", () => {
		const context = createVCLContext();

		// Add an ACL
		context.std.acl.add("test_invalid");
		context.std.acl.add_entry("test_invalid", "192.168.0.0", 24);
		context.std.acl.add_entry("test_invalid", "2001:db8::", 32);

		// Test with invalid IPv4 addresses
		expect(context.std.acl.check("192.168.0.256", "test_invalid")).toBe(false);
		expect(context.std.acl.check("192.168.0", "test_invalid")).toBe(false);
		expect(context.std.acl.check("not-an-ip", "test_invalid")).toBe(false);

		// Test with invalid IPv6 addresses
		expect(context.std.acl.check("2001:db8:::1", "test_invalid")).toBe(false);
		expect(context.std.acl.check("2001:db8:gggg::", "test_invalid")).toBe(
			false,
		);
	});

	it("should handle IP type mismatches gracefully", () => {
		const context = createVCLContext();

		// Add an ACL
		context.std.acl.add("test_ipv4");
		context.std.acl.add("test_ipv6");

		// Add entries to the ACLs
		context.std.acl.add_entry("test_ipv4", "192.168.0.0", 24);
		context.std.acl.add_entry("test_ipv6", "2001:db8::", 32);

		// Test with mismatched IP types
		expect(context.std.acl.check("2001:db8::1", "test_ipv4")).toBe(false);
		expect(context.std.acl.check("192.168.0.1", "test_ipv6")).toBe(false);
	});
});
