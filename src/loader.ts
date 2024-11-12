import { runInNewContext } from "node:vm";
import { noop } from "@kaciras/utilities/node";
import * as EnvFunctions from "./context.js";
import { HostnameSource } from "./source.js";

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

/**
 * Signature of FindProxyForURL.
 */
export type FindProxy = (url: string, host: string) => string | null;

/**
 * Essential type that PAC should expose.
 */
export interface PACGlobals {
	FindProxyForURL: FindProxy;
}

/**
 * The PAC generated with internal template(template/default.js) exposes those members.
 */
export interface BuiltinPAC extends PACGlobals {
	/**
	 * If no rule matched, this value will be returned from FindProxyForURL().
	 *
	 * "default" is better for name, but it's a JavaScript keyword.
	 */
	fallback: string;

	/**
	 * proxy string array.
	 */
	proxies: string[];

	/**
	 * key is a hostname, value is an index of the `proxies` array.
	 */
	rules: Record<string, number>;
}

/**
 * Load a PAC file, return an object includes all global variables defined in the PAC.
 *
 * SECURITY NOTICE:
 * PAC file will be executed as JavaScript, you should only load the code from trusted source.
 *
 * @param code the PAC script text.
 * @param timeout The number of milliseconds to execute code before terminating execution.
 * @return an object represent the script exports.
 */
export function loadPAC<T = PACGlobals>(code: string, timeout = 5000) {
	const context = Object.create(EnvFunctions);
	runInNewContext(code, context, { timeout });
	return Object.assign(Object.create(null), context) as T;
}

export interface ParsedProxy {
	protocol: string;
	host: string;
	port: number;
	hostname: string;
}

const blockRE = /^\s*(\w+)(?:\s+(([\w.]+|\[[\d:]+]):(\d+)))?\s*$/;

function throwError(block: string) {
	throw new Error(`"${block}" is not a valid proxy`);
}

/**
 * Parse the return value of `FindProxyForURL()`.
 *
 * @param value the proxy string
 * @param strict true to throw an error if the value contains invalid block.
 * 				 false to ignore them, just like browser.
 * @return parsed proxy description array
 */
export function parseProxies(value: string, strict = false) {
	const invalid = strict ? throwError : noop;

	function parseBlock(block: string) {
		const match = blockRE.exec(block);
		if (!match) {
			return invalid(block);
		}

		const [, protocol, host = "", hostname = "", p] = match;
		if (protocol === "DIRECT") {
			if (strict && host) {
				throw new Error("Cannot specific host for DIRECT connection");
			}
		} else if (!host) {
			return invalid(block);
		}

		const port = p ? parseInt(p) : NaN;
		return { protocol, host, hostname, port } as ParsedProxy;
	}

	return value.split(";").map(parseBlock).filter(Boolean) as ParsedProxy[];
}
