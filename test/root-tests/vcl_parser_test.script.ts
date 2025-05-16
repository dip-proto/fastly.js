/**
 * VCL Parser Test
 *
 * This script tests the VCL parser with various VCL code snippets.
 */

import { createVCLContext } from "../../src/vcl";
import { VCLCompiler } from "../../src/vcl-compiler";
import { VCLLexer } from "../../src/vcl-parser";
import { VCLParser } from "../../src/vcl-parser-impl";

// Parse and compile VCL code
function parseVCL(code: string) {
	console.log("Parsing VCL code:");
	console.log(code);

	// Tokenize the VCL code
	const lexer = new VCLLexer(code);
	const tokens = lexer.tokenize();
	console.log(`Tokenized VCL code: ${tokens.length} tokens`);

	// Parse the tokens into an AST (pass both tokens and source code)
	const parser = new VCLParser(tokens, code);
	const ast = parser.parse();
	console.log(`Parsed VCL code: ${ast.subroutines.length} subroutines`);

	// Compile the AST into executable functions
	const compiler = new VCLCompiler(ast);
	const subroutines = compiler.compile();
	console.log(
		`Compiled VCL code: ${Object.keys(subroutines).length} subroutines`,
	);

	return subroutines;
}

// Test 1: Simple VCL code
function testSimpleVCL() {
	console.log("\nTest 1: Simple VCL code");

	const vclCode = `
    sub vcl_recv {
      set req.http.X-Test = "Hello, World!";
      return(lookup);
    }
  `;

	const subroutines = parseVCL(vclCode);

	// Create a context
	const context = createVCLContext();
	context.req.url = "/test";
	context.req.method = "GET";
	context.req.http = {
		Host: "example.com",
		"User-Agent": "Mozilla/5.0",
	};

	// Execute the subroutine
	console.log("\nExecuting vcl_recv...");
	const result = subroutines.vcl_recv(context);

	// Check the result
	console.log(`Result: ${result}`);
	console.log("Headers:");
	console.log(context.req.http);

	// Verify the header was set
	if (context.req.http["X-Test"] === "Hello, World!") {
		console.log("PASS");
	} else {
		console.log("FAIL");
	}
}

// Test 2: Conditional VCL code
function testConditionalVCL() {
	console.log("\nTest 2: Conditional VCL code");

	const vclCode = `
    sub vcl_recv {
      if (req.url ~ "^/api/") {
        set req.http.X-API = "true";
        return(pass);
      } else if (req.url ~ "\\.(jpg|jpeg|png|gif|css|js)$") {
        set req.http.X-Static = "true";
        return(lookup);
      } else {
        set req.http.X-Default = "true";
        return(lookup);
      }
    }
  `;

	const subroutines = parseVCL(vclCode);

	// Test API path
	const apiContext = createVCLContext();
	apiContext.req.url = "/api/users";
	apiContext.req.method = "GET";
	apiContext.req.http = {
		Host: "example.com",
		"User-Agent": "Mozilla/5.0",
	};

	// Execute the subroutine for API path
	console.log("\nAPI Path:");
	const apiResult = subroutines.vcl_recv(apiContext);
	console.log(`Result: ${apiResult}`);
	console.log("Headers:");
	console.log(apiContext.req.http);

	// Test static path
	const staticContext = createVCLContext();
	staticContext.req.url = "/static/css/style.css";
	staticContext.req.method = "GET";
	staticContext.req.http = {
		Host: "example.com",
		"User-Agent": "Mozilla/5.0",
	};

	// Execute the subroutine for static path
	console.log("\nStatic Path:");
	const staticResult = subroutines.vcl_recv(staticContext);
	console.log(`Result: ${staticResult}`);
	console.log("Headers:");
	console.log(staticContext.req.http);

	// Verify the results
	let passed = true;

	if (apiResult !== "pass" || !apiContext.req.http["X-API"]) {
		console.log("FAIL: API path test");
		passed = false;
	}

	if (staticResult !== "lookup" || !staticContext.req.http["X-Static"]) {
		console.log("FAIL: Static path test");
		passed = false;
	}

	if (passed) {
		console.log("PASS: All conditional logic tests");
	}
}

// Run all tests
function runTests() {
	console.log("Running VCL Parser Tests");

	testSimpleVCL();
	testConditionalVCL();

	console.log("\nAll Tests Complete");
}

// Run the tests
runTests();
