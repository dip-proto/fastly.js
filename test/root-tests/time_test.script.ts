/**
 * Test script for VCL time functions
 */

import { createVCLContext } from "../../src/vcl";

// Create a VCL context
const context = createVCLContext();

// Test time.now function
const now = context.std.time.now();
console.log(`Current time: ${now}`);
console.log(
	`Formatted current time: ${context.std.strftime("%Y-%m-%d %H:%M:%S", now)}`,
);

// Test time.add function
const oneHourLater = context.std.time.add(now, "1h");
const oneDayLater = context.std.time.add(now, "1d");
const oneHourEarlier = context.std.time.add(now, "-1h");

console.log(`\nTime Addition Tests:`);
console.log(`Current time: ${context.std.strftime("%Y-%m-%d %H:%M:%S", now)}`);
console.log(
	`One hour later: ${context.std.strftime("%Y-%m-%d %H:%M:%S", oneHourLater)}`,
);
console.log(
	`One day later: ${context.std.strftime("%Y-%m-%d %H:%M:%S", oneDayLater)}`,
);
console.log(
	`One hour earlier: ${context.std.strftime("%Y-%m-%d %H:%M:%S", oneHourEarlier)}`,
);

// Test time.sub function
const diffOneHour = context.std.time.sub(oneHourLater, now);
const diffOneDay = context.std.time.sub(oneDayLater, now);
const diffNegative = context.std.time.sub(oneHourEarlier, now);

console.log(`\nTime Subtraction Tests:`);
console.log(
	`Difference (one hour): ${diffOneHour} ms (should be close to 3600000)`,
);
console.log(
	`Difference (one day): ${diffOneDay} ms (should be close to 86400000)`,
);
console.log(
	`Difference (negative one hour): ${diffNegative} ms (should be close to -3600000)`,
);

// Test time.is_after function
const isOneHourLaterAfterNow = context.std.time.is_after(oneHourLater, now);
const isOneHourEarlierAfterNow = context.std.time.is_after(oneHourEarlier, now);
const isNowAfterNow = context.std.time.is_after(now, now);

console.log(`\nTime Comparison Tests:`);
console.log(
	`Is one hour later after now? ${isOneHourLaterAfterNow} (should be true)`,
);
console.log(
	`Is one hour earlier after now? ${isOneHourEarlierAfterNow} (should be false)`,
);
console.log(`Is now after now? ${isNowAfterNow} (should be false)`);

// Test time.hex_to_time function
const hexTime = "5F7D7E98"; // 2020-10-07 14:29:12 UTC
const convertedTime = context.std.time.hex_to_time(hexTime);

console.log(`\nHex to Time Conversion Tests:`);
console.log(`Hex time: ${hexTime}`);
console.log(
	`Converted time: ${context.std.strftime("%Y-%m-%d %H:%M:%S", convertedTime)}`,
);
console.log(`Original timestamp: ${convertedTime}`);

// Test with invalid inputs
console.log(`\nError Handling Tests:`);
try {
	const invalidHex = "XYZ";
	const invalidTime = context.std.time.hex_to_time(invalidHex);
	console.log(`Invalid hex conversion: ${invalidHex} -> ${invalidTime}`);
} catch (e) {
	console.log(`Error with invalid hex: ${e}`);
}

try {
	const invalidOffset = "1x";
	const invalidAddition = context.std.time.add(now, invalidOffset);
	console.log(
		`Invalid offset addition: ${invalidOffset} -> ${invalidAddition}`,
	);
} catch (e) {
	console.log(`Error with invalid offset: ${e}`);
}

console.log("\nAll time function tests completed!");
