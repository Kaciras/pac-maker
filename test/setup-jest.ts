import { isIP } from "net";
import { expect, jest } from "@jest/globals";
import chalk from "chalk";
import { exposeGC } from "../src/command/bench.js";

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


exposeGC();

// https://stackoverflow.com/a/106223
const hostname = /^(([a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9])\.)*([A-Za-z0-9]|[A-Za-z0-9][A-Za-z0-9-]*[A-Za-z0-9])$/;

declare module "expect" {

	// noinspection JSUnusedGlobalSymbols
	interface Matchers<R> {
		toBeHostname(): R;
	}

	// noinspection JSUnusedGlobalSymbols
	interface AsymmetricMatchers {
		toBeHostname(): void;
	}
}

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
