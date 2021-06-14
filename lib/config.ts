import { pathToFileURL } from "url";
import { builtinList, gfwlist, HostnameSource } from "./index.js";

export interface PACMakerConfig {

	/** Location of the generated PAC file */
	path?: string;

	/** Fallback when no rule matching in source */
	direct?: string;

	/**
	 * Proxy source map, the key is a proxy sorting (e.g. SOCKS5 127.0.0.1:1080),
	 * value is an array of HostnameSource.
	 *
	 * pac-maker will get hostnames from all sources in array and map it to the corresponding key.
	 */
	sources?: Record<string, HostnameSource[]>;
}

const defaultConfig: PACMakerConfig = {
	path: "dist/proxy.pac",
	direct: "DIRECT",
	sources: {
		"SOCKS5 localhost:2080": [
			gfwlist(),
			builtinList("default"),
			builtinList("forbidden"),
		],
	},
};

export async function getOptions(file = "pac.config.js") {
	let user = {};

	try {
		const url = pathToFileURL(file).toString();
		user = (await import(url)).default;
	} catch (e) {
		if (e.code !== "ERR_MODULE_NOT_FOUND") {
			throw e;
		}
	}
	return { ...defaultConfig, ...user } as PACMakerConfig;
}
