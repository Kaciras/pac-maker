import { generate } from "../lib/generator.js";
import { builtInRuleSet, gfwlist } from "../lib/source.js";
import { root } from "../lib/utils.js";

process.chdir(root);

const config = {
	path: "dist/proxy.pac",
	direct: "DIRECT",
	rules: {
		"SOCKS5 localhost:1080": [
			gfwlist(),
			builtInRuleSet("default"),
		],
	},
};

generate(config).catch(e => console.error(e));
