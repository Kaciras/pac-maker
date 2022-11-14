import { isIP } from "net";
import { expect } from "@jest/globals";
import { mockTime } from "./share.js";

/**
 * Ensure consistent time tag in generated PAC.
 *
 * Don't use `jest.setSystemTime(mockTime)` as fake timers will break `fetch`.
 */
process.env.MOCK_TIME = mockTime.toString();

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
