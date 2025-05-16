import acceptHeaderFunctionsTests from "./accept-header-functions-tests";
import addressFunctionsTests from "./address-functions-tests";
import backendErrorTests from "./backend-error-tests";
import basicVCLTests from "./basic-vcl-tests";
import binaryDataFunctionsTests from "./binary-data-functions-tests";
import cachingTests from "./caching-tests";
import comprehensiveVCLTests from "./comprehensive-vcl-tests";
import csrfProtectionTests from "./csrf-protection-tests";
import digestFunctionsTests from "./digest-functions-tests";
import esiFunctionsTests from "./esi-functions-tests";
import { gotoTests } from "./goto-tests";
import httpFunctionsTests from "./http-functions-tests";
import multiFileTests from "./multi-file-tests";
import queryStringFunctionsTests from "./query-string-functions-tests";
import randomFunctionsTests from "./random-functions-tests";
import rateLimitFunctionsTests from "./ratelimit-functions-tests";
import realWorldEcommerceTests from "./real-world-ecommerce-tests";
import realWorldVCLTests from "./real-world-vcl-tests";
import securityFeaturesTests from "./security-features-tests";
import stdlibTests from "./stdlib-tests";
import { runAllTests } from "./test-framework";
import timeFunctionsTests from "./time-functions-tests";
import uuidFunctionsTests from "./uuid-functions-tests";
import vclFileTests from "./vcl-file-tests";
import wafFunctionsTests from "./waf-functions-tests";

runAllTests([
	basicVCLTests,
	stdlibTests,
	cachingTests,
	backendErrorTests,
	randomFunctionsTests,
	vclFileTests,
	securityFeaturesTests,
	acceptHeaderFunctionsTests,
	addressFunctionsTests,
	binaryDataFunctionsTests,
	digestFunctionsTests,
	queryStringFunctionsTests,
	uuidFunctionsTests,
	wafFunctionsTests,
	rateLimitFunctionsTests,
	httpFunctionsTests,
	timeFunctionsTests,
	esiFunctionsTests,
	csrfProtectionTests,
	multiFileTests,
	comprehensiveVCLTests,
	realWorldVCLTests,
	realWorldEcommerceTests,
	gotoTests,
]).catch((error) => {
	console.error("Error running tests:", error);
	process.exit(1);
});
