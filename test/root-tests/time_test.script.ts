import "../../src/platform-node";
/**
 * Test script for VCL time functions (real Fastly API: time.add, time.sub,
 * time.is_after, time.hex_to_time, strftime).
 */

import { createVCLContext } from "../../src/vcl";

const context = createVCLContext();
const time = context.time!;
const strftime = context.strftime!;

const now: Date = new Date(context.platform!.now());
console.log(`Current time: ${now.toUTCString()}`);
console.log(`Formatted current time: ${strftime("%Y-%m-%d %H:%M:%S", now)}`);

// time.add / time.sub take a TIME and an RTIME in seconds
const oneHourLater = time.add(now, 3600);
const oneDayLater = time.add(now, 86400);
const oneHourEarlier = time.sub(now, 3600);

console.log(`\nTime Addition Tests:`);
console.log(`One hour later: ${strftime("%Y-%m-%d %H:%M:%S", oneHourLater)}`);
console.log(`One day later: ${strftime("%Y-%m-%d %H:%M:%S", oneDayLater)}`);
console.log(`One hour earlier: ${strftime("%Y-%m-%d %H:%M:%S", oneHourEarlier)}`);

if (oneHourLater.getTime() - now.getTime() !== 3600000) {
	throw new Error("time.add(1h) should advance by 3600000 ms");
}
if (oneDayLater.getTime() - now.getTime() !== 86400000) {
	throw new Error("time.add(1d) should advance by 86400000 ms");
}
if (now.getTime() - oneHourEarlier.getTime() !== 3600000) {
	throw new Error("time.sub(1h) should rewind by 3600000 ms");
}

// time.is_after
const isLaterAfterNow = time.is_after(oneHourLater, now);
const isEarlierAfterNow = time.is_after(oneHourEarlier, now);
const isNowAfterNow = time.is_after(now, now);

console.log(`\nTime Comparison Tests:`);
console.log(`Is one hour later after now? ${isLaterAfterNow} (should be true)`);
console.log(`Is one hour earlier after now? ${isEarlierAfterNow} (should be false)`);
console.log(`Is now after now? ${isNowAfterNow} (should be false)`);

if (isLaterAfterNow !== true || isEarlierAfterNow !== false || isNowAfterNow !== false) {
	throw new Error("time.is_after comparisons returned unexpected results");
}

// time.hex_to_time(divisor, hex): hex is unix seconds after division
const converted = time.hex_to_time(1, "5F7D7E98"); // 2020-10-07 14:02:32 UTC
console.log(`\nHex to Time Conversion Tests:`);
console.log(`Converted time: ${strftime("%Y-%m-%d %H:%M:%S", converted)}`);
if (Math.floor(converted.getTime() / 1000) !== 0x5f7d7e98) {
	throw new Error("time.hex_to_time(1, hex) should decode to unix seconds");
}

// Invalid input returns not-set (null)
const invalid = time.hex_to_time(1, "XYZ");
console.log(`\nError Handling Tests:`);
console.log(`Invalid hex conversion: XYZ -> ${invalid}`);
if (invalid !== null) {
	throw new Error("time.hex_to_time with invalid hex should be not set");
}

console.log("\nAll time function tests completed!");
