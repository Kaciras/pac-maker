import { builtInList, gfwlist } from "./lib/source.js";

export default {
	path: "dist/proxy.pac",
	direct: "DIRECT",
	sources: {
		"SOCKS5 localhost:2080": [
			gfwlist(),
			builtInList("default"),
			builtInList("forbidden"),
		],
	},
};
