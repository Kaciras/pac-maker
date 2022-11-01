import { pathToFileURL } from "url";
import { builtinList, HostnameSource } from "./index.js";

export interface PACMakerConfig {

	/**
	 * Location of the generated PAC file, default is "dist/proxy.pac".
	 */
	path: string;

	/**
	 * Fallback when no rule matching in `sources`, default is "DIRECT".
	 */
	direct: string;

	/**
	 * Proxy source map, the key is a proxy sorting, value is an array of HostnameSource.
	 * pac-maker will get hostnames from all sources and route them to the corresponding key.
	 *
	 * Default read hostnames from built-in lists, route them to "SOCKS5 localhost:2080".
	 */
	sources: Record<string, HostnameSource[]>;
}

const defaultConfig: PACMakerConfig = {
	path: "dist/proxy.pac",
	direct: "DIRECT",
	sources: {
		"SOCKS5 localhost:2080": [
			builtinList("default"),
			builtinList("forbidden"),
			builtinList("unicom"),
		],
	},
};

export async function loadConfig(file: string, required = true) {
	let userConfig = {};

	try {
		const url = pathToFileURL(file).toString();
		userConfig = (await import(url)).default;
	} catch (e) {
		if (required || e.code !== "ERR_MODULE_NOT_FOUND") {
			throw e;
		}
	}
	return { ...defaultConfig, ...userConfig } as PACMakerConfig;
}
