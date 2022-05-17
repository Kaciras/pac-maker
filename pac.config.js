import { readFileSync } from "fs";
import { builtinList, gfwlist, PACDispatcher } from "./lib/index.js";

const pac = readFileSync("dist/proxy.pac", "utf8");
const dispatcher = new PACDispatcher(pac);

// The config used to generate dist/proxy.pac
export default {
	path: "dist/proxy.pac",
	direct: "DIRECT",
	sources: {
		"SOCKS5 localhost:2080": [
			gfwlist({ dispatcher }),
			builtinList("default"),
			builtinList("unicom"),
			builtinList("forbidden"),
		],
	},
};
