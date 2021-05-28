import { builtinList, gfwlist } from "./lib/source.js";

export default {
	// Location of the generated PAC file.
	path: "dist/proxy.pac",

	// Fallback when no match any rule.
	direct: "DIRECT",

	// Proxy rule map, { proxy: [hostname sources] }
	sources: {
		"SOCKS5 localhost:2080": [
			gfwlist(),
			builtinList("default"),
			builtinList("forbidden"),
		],
	},
};
