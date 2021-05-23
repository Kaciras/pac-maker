import { builtinList, gfwlist } from "../lib/source";
import { isIP } from "net";

// https://stackoverflow.com/a/106223
const hostname = /^(([a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9])\.)*([A-Za-z0-9]|[A-Za-z0-9][A-Za-z0-9-]*[A-Za-z0-9])$/;

expect.extend({
	toBeDomain(received) {
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

/**
 * This test may fail with bad network.
 */
it("should parse gfwlist", async () => {
	const list = await gfwlist().getHostnames();

	for (const item of list) {
		expect(item).toBeDomain();
	}
	expect(list.length).toBeGreaterThan(5700);
});

it("should load built-in rule set", async () => {
	const list = await builtinList("forbidden").getHostnames();
	expect(list).not.toContain("");
	expect(list).toContain("www.tianshie.com");
});

it("should failed with invalid rule set name", async () => {
	expect(() => builtinList("../default")).toThrow();
});
