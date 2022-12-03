import { readFileSync } from "fs";
import { DnsmasqLists, PACDispatcher } from "./lib/index.js";

const pac = readFileSync("dist/blacklist.pac", "utf8");
const dispatcher = new PACDispatcher(pac);

// The config used to generate dist/whitelist.pac
export default {
	path: "dist/whitelist.pac",
	fallback: "SOCKS5 localhost:2080",
	sources: {
		"DIRECT": [
			new DnsmasqLists("accelerated-domains", { dispatcher }),
		],
	},
};
