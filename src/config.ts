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
	fallback: string;

	/**
	 * Proxy source map, the key is a proxy sorting, value is an array of HostnameSource.
	 * pac-maker will get hostnames from all sources and route them to the corresponding key.
	 *
	 * @default {}
	 */
	sources: Record<string, HostnameSource[]>;
}
