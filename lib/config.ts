import { pathToFileURL } from "url";
import { HostnameSource } from "./index.js";

export interface PACMakerConfig {

	/**
	 * Location of the generated PAC file.
	 *
	 * @default "proxy.pac"
	 */
	path: string;

	/**
	 * Fallback when no rule matching in `sources`.
	 *
	 * @default "DIRECT"
	 */
	direct: string;

	/**
	 * Proxy source map, the key is a proxy sorting, value is an array of HostnameSource.
	 * pac-maker will get hostnames from all sources and route them to the corresponding key.
	 *
	 * @default {}
	 */
	sources: Record<string, HostnameSource[]>;
}

const defaultConfig: PACMakerConfig = {
	path: "proxy.pac",
	direct: "DIRECT",
	sources: {},
};

export async function loadConfig(file: string, required = true) {
	let userConfig = {};

	try {
		const url = pathToFileURL(file).toString();
		userConfig = (await import(url)).default;
	} catch (e) {
		if (required || e.code !== "MODULE_NOT_FOUND") {
			throw e;
		}
	}
	return { ...defaultConfig, ...userConfig } as PACMakerConfig;
}
