import { generate } from "../lib/generator";
import { builtInRuleSet, gfwlist } from "../lib/source";
import { root } from "../lib/utils";

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
