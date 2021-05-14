import { builtInRuleSet, gfwlist } from "../lib/source";
import { isIP } from "net";

const domainName = /^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9](?:\.[a-zA-Z]{2,})+$/;

expect.extend({
	toBeDomain(received) {
		if (isIP(received) || domainName.test(received)) {
			return {
				pass: true,
				message: () => `${received} is a valid domain`,
			};
		}
		return {
			pass: false,
			message: () => `${received} is not a domain`,
		};
	},
});

/**
 * This test may fail with bad network.
 */
it("should parse gfwlist", async () => {
	const list = await gfwlist();

	for (const item of list) {
		expect(item).toBeDomain();
	}
	expect(list.length).toBeGreaterThan(5700);
});

it("should load built-in rule set", async () => {
	const list = await builtInRuleSet("default");
	expect(list).not.toContain("");
	expect(list).toContain("www.tianshie.com");
});

it("should failed with invalid rule set name", async () => {
	expect(() => builtInRuleSet("../default")).toThrow();
});
