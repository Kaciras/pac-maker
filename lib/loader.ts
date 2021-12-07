import vm from "vm";
import * as EnvFunctions from "./includes.js";

/**
 * Signature of FindProxyForURL.
 */
export type FindProxy = (url: string, host: string) => string;

/**
 * Essential type that PAC should exposed.
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
	 * key is a domain, value is an index of the `proxies` array.
	 */
	rules: Record<string, number>;
}

/**
 * Load a PAC file, return an object includes all global variables defined in the PAC.
 *
 * SECURITY NOTICE:
 * PAC file will be executed as JavaScript, you should only load the code from trusted source.
 *
 * @param code the PAC script content.
 * @return an object represent the script exports.
 */
export function loadPAC<T = PACGlobals>(code: string) {
	const context = Object.create(EnvFunctions);
	vm.runInNewContext(code, context, { timeout: 5000 });
	return Object.assign(Object.create(null), context) as T;
}
