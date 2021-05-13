import { generate } from "../lib/generator.js";
import { builtInRuleSet, gfwlist } from "../lib/source.js";
import { projectRoot } from "../lib/utils.js";

process.chdir(projectRoot);

const config = {
	path: "dist/proxy.pac",
	direct: "DIRECT",
	rules: {
		"SOCKS5 localhost:2080": [
			gfwlist(),
			builtInRuleSet("default"),
		],
	},
};

generate(config).catch(e => console.error(e));
