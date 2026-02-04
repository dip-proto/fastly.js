import { describe, expect, it } from "bun:test";
import { createVCLContext } from "../src/vcl";
import { VCLCompiler } from "../src/vcl-compiler";
import { VCLLexer } from "../src/vcl-parser";
import { VCLParser } from "../src/vcl-parser-impl";

describe("Complex ACL Tests", () => {
	it("should correctly handle ACLs in a real-world VCL file", () => {
		// Define a real-world VCL file with ACLs
		const vclCode = `
      # Define ACLs for different types of clients
      acl internal_networks {
        "10.0.0.0"/8;
        "172.16.0.0"/12;
        "192.168.0.0"/16;
        "127.0.0.1";
      }

      acl trusted_partners {
        "203.0.113.0"/24;
        "198.51.100.0"/24;
        "2001:db8::/32";
      }

      acl blocked_ips {
        "192.0.2.0"/24;
        "198.51.100.123";
        "2001:db8:1::/48";
      }

      sub vcl_recv {
        # Allow internal networks to access everything
        if (client.ip ~ internal_networks) {
          set req.http.X-Client-Type = "internal";
          return(pass);
        }

        # Block access from known bad IPs
        if (client.ip ~ blocked_ips) {
          error 403 "Forbidden";
        }

        # Set a header for trusted partners
        if (client.ip ~ trusted_partners) {
          set req.http.X-Client-Type = "trusted";
        } else {
          # Default action
          set req.http.X-Client-Type = "public";
        }

        return(lookup);
      }

      sub vcl_deliver {
        # Remove internal headers before sending to client
        unset resp.http.X-Client-Type;
        return(deliver);
      }
    `;

		// Parse and compile the VCL
		const lexer = new VCLLexer(vclCode);
		const tokens = lexer.tokenize();
		const parser = new VCLParser(tokens, vclCode);
		const parsedVCL = parser.parse();
		const compiler = new VCLCompiler(parsedVCL);
		const compiledVCL = compiler.compile();

		// Manually add the ACLs to the context
		const internalContext = createVCLContext();
		internalContext.acls = {
			internal_networks: {
				name: "internal_networks",
				entries: [
					{ ip: "10.0.0.0", subnet: 8 },
					{ ip: "172.16.0.0", subnet: 12 },
					{ ip: "192.168.0.0", subnet: 16 },
					{ ip: "127.0.0.1" },
				],
			},
			trusted_partners: {
				name: "trusted_partners",
				entries: [
					{ ip: "203.0.113.0", subnet: 24 },
					{ ip: "198.51.100.0", subnet: 24 },
					{ ip: "2001:db8::", subnet: 32 },
				],
			},
			blocked_ips: {
				name: "blocked_ips",
				entries: [
					{ ip: "192.0.2.0", subnet: 24 },
					{ ip: "198.51.100.123" },
					{ ip: "2001:db8:1::", subnet: 48 },
				],
			},
		};
		internalContext.client = { ip: "10.1.2.3" };
		compiledVCL.vcl_recv!(internalContext);
		expect(internalContext.req.http["X-Client-Type"]).toBe("internal");

		// Test with a blocked IP
		const blockedContext = createVCLContext();
		blockedContext.acls = internalContext.acls;
		blockedContext.client = { ip: "192.0.2.123" };

		// Set up an error handler to catch the error
		let errorCaught = false;
		let errorMessage = "";
		let errorStatus = 0;

		blockedContext.error = (status, message) => {
			errorCaught = true;
			errorMessage = message;
			errorStatus = status;
			return "error";
		};

		compiledVCL.vcl_recv!(blockedContext);

		// Check that the error was triggered
		expect(errorCaught).toBe(true);
		expect(errorMessage).toBe("Forbidden");
		expect(errorStatus).toBe(403);

		// Test with a trusted partner IP
		const trustedContext = createVCLContext();
		trustedContext.acls = internalContext.acls;
		trustedContext.client = { ip: "203.0.113.45" };
		compiledVCL.vcl_recv!(trustedContext);
		expect(trustedContext.req.http["X-Client-Type"]).toBe("trusted");

		// Test with a public IP
		const publicContext = createVCLContext();
		publicContext.acls = internalContext.acls;
		publicContext.client = { ip: "8.8.8.8" };
		compiledVCL.vcl_recv!(publicContext);
		expect(publicContext.req.http["X-Client-Type"]).toBe("public");

		// Test with an IPv6 trusted partner
		const ipv6Context = createVCLContext();
		ipv6Context.acls = internalContext.acls;
		ipv6Context.client = { ip: "2001:db8::1234" };
		compiledVCL.vcl_recv!(ipv6Context);
		expect(ipv6Context.req.http["X-Client-Type"]).toBe("trusted");
	});

	it("should handle ACLs with mixed IPv4 and IPv6 addresses", () => {
		// Define a VCL file with mixed IPv4 and IPv6 ACLs
		const vclCode = `
      acl mixed_ips {
        "192.168.0.0"/24;
        "2001:db8::/32";
        "::ffff:10.0.0.0"/104;  # IPv4-mapped IPv6
        "127.0.0.1";
      }

      sub vcl_recv {
        if (client.ip ~ mixed_ips) {
          set req.http.X-In-ACL = "true";
        } else {
          set req.http.X-In-ACL = "false";
        }
        return(lookup);
      }
    `;

		// Parse and compile the VCL
		const lexer = new VCLLexer(vclCode);
		const tokens = lexer.tokenize();
		const parser = new VCLParser(tokens, vclCode);
		const parsedVCL = parser.parse();
		const compiler = new VCLCompiler(parsedVCL);
		const compiledVCL = compiler.compile();

		// Manually add the ACLs to the context
		const mixedContext = createVCLContext();
		mixedContext.acls = {
			mixed_ips: {
				name: "mixed_ips",
				entries: [
					{ ip: "192.168.0.0", subnet: 24 },
					{ ip: "2001:db8::", subnet: 32 },
					{ ip: "::ffff:10.0.0.0", subnet: 104 },
					{ ip: "127.0.0.1" },
				],
			},
		};

		// Test with an IPv4 address in the ACL
		const ipv4Context = createVCLContext();
		ipv4Context.acls = mixedContext.acls;
		ipv4Context.client = { ip: "192.168.0.123" };
		compiledVCL.vcl_recv!(ipv4Context);
		expect(ipv4Context.req.http["X-In-ACL"]).toBe("true");

		// Test with an IPv6 address in the ACL
		const ipv6Context = createVCLContext();
		ipv6Context.acls = mixedContext.acls;
		ipv6Context.client = { ip: "2001:db8::5678" };
		compiledVCL.vcl_recv!(ipv6Context);
		expect(ipv6Context.req.http["X-In-ACL"]).toBe("true");

		// Test with an IPv4-mapped IPv6 address
		const mappedContext = createVCLContext();
		mappedContext.acls = mixedContext.acls;
		mappedContext.client = { ip: "::ffff:10.0.0.123" };
		compiledVCL.vcl_recv!(mappedContext);
		expect(mappedContext.req.http["X-In-ACL"]).toBe("true");

		// Test with localhost
		const localhostContext = createVCLContext();
		localhostContext.acls = mixedContext.acls;
		localhostContext.client = { ip: "127.0.0.1" };
		compiledVCL.vcl_recv!(localhostContext);
		expect(localhostContext.req.http["X-In-ACL"]).toBe("true");

		// Test with an IP not in the ACL
		const outsideContext = createVCLContext();
		outsideContext.acls = mixedContext.acls;
		outsideContext.client = { ip: "8.8.8.8" };
		compiledVCL.vcl_recv!(outsideContext);
		expect(outsideContext.req.http["X-In-ACL"]).toBe("false");
	});
});
