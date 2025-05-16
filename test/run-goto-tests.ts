import { gotoTests } from "./goto-tests";
import { runAllTests } from "./test-framework";

runAllTests([gotoTests]).catch((error) => {
	console.error("Error running tests:", error);
	process.exit(1);
});
