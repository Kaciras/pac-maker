import { readFileSync } from "fs";
import { builtinList, gfwlist, PACDispatcher } from "./lib/index.js";

const pac = readFileSync("dist/blacklist.pac", "utf8");
const dispatcher = new PACDispatcher(pac);

// The config used to generate dist/blacklist.pac
export default {
	path: "dist/blacklist.pac",
	sources: {
		"SOCKS5 localhost:2080": [
			gfwlist({ dispatcher }),
			builtinList("default"),
			builtinList("unicom"),
			builtinList("forbidden"),
		],
		"DIRECT": [
			builtinList("no-proxy"),
		],
	},
};
