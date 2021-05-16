import { builtInRuleSet, gfwlist } from "../lib/source";

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
