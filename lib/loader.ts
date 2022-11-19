import { runInNewContext } from "vm";
import * as EnvFunctions from "./includes.js";

/**
 * Signature of FindProxyForURL.
 */
export type FindProxy = (url: string, host: string) => string;

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

/**
 * Parse the return value of `FindProxyForURL()`.
 *
 * Unlike browsers, this function will throw an error if the value is blank
 * or contains invalid blocks.
 *
 * @param value the proxy string
 * @return parsed proxy description array
 */
export function parseProxies(value: string) {
	return value.split(";").map(block => {
		const match = blockRE.exec(block);
		if (!match) {
			throw new Error(`"${block}" is not a valid proxy`);
		}

		const [, protocol, host = "", hostname = "", p] = match;
		if (protocol === "DIRECT") {
			if (host) {
				throw new Error("Cannot specific host for DIRECT connection");
			}
		} else if (!host) {
			throw new Error(`"${block}" is not a valid proxy`);
		}

		const port = p ? parseInt(p) : NaN;
		return { protocol, host, hostname, port } as ParsedProxy;
	});
}
