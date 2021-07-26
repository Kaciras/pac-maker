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
 * The PAC generated from ../template/default.js expose those members.
 */
export interface BuiltinPAC extends PACGlobals {
	direct: string;
	proxies: string[];
	rules: Record<string, number>;
}

/**
 * Load a PAC file, return an object includes all global variables defined in the PAC.
 *
 * SECURITY NOTICE:
 * PAC file will be executed as JavaScript, so you should only load the code from trusted source.
 *
 * @param code the PAC script content.
 * @return an object represent the script exports.
 */
export function loadPAC<T = PACGlobals>(code: string) {
	const context = Object.create(EnvFunctions);
	vm.runInNewContext(code, context, { timeout: 5000 });
	return Object.assign(Object.create(null), context) as T;
}
