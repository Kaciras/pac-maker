import { isIP } from "net";
import { setFlagsFromString } from "v8";
import { runInNewContext } from "vm";
import { expect, jest } from "@jest/globals";
import chalk from "chalk";

/**
 * Ensure consistent time tag in generated PAC.
 *
 * Don't use `jest.setSystemTime(mockTime)` as fake timers will break `fetch`.
 */
const mockTime = Date.UTC(2021, 5, 17);
process.env.MOCK_TIME = mockTime.toString();

// We do assertion with console outputs for some tests.
console.warn = jest.fn();
console.info = jest.fn();
console.error = jest.fn();
console.debug = jest.fn();
console.log = jest.fn();

// Enable colors for CI.
chalk.level = 2;

/*
 * Expose gc() function to global without any Node arguments.
 * Because --expose-gc cannot be passed through NODE_OPTIONS.
 *
 * Inspired by https://github.com/legraphista/expose-gc, The project
 * missing undo for changed flags, so we implemented it ourselves.
 */
setFlagsFromString("--expose_gc");
global.gc = runInNewContext("gc");
setFlagsFromString("--no-expose-gc");

// https://stackoverflow.com/a/106223
const hostname = /^(([a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9])\.)*([A-Za-z0-9]|[A-Za-z0-9][A-Za-z0-9-]*[A-Za-z0-9])$/;

expect.extend({
	toBeHostname(received: string) {
		if (isIP(received) || hostname.test(received)) {
			return {
				pass: true,
				message: () => `${received} is a valid hostname`,
			};
		}
		return {
			pass: false,
			message: () => `${received} is not a hostname`,
		};
	},
});
