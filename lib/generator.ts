import { readFile } from "fs/promises";
import vm from "vm";
import { join } from "path";
import * as EnvFunctions from "./includes.js";
import { HostnameSource } from "./source.js";
import { importJson, root } from "./utils.js";

export type FindProxy = (url: string, host: string) => string;

export interface PACGlobals {
	FindProxyForURL: FindProxy;
}

export interface BuiltinPAC extends PACGlobals {
	direct: string;
	proxies: string[];
	rules: Record<string, number>;
}

const placeholder = /__(.+?)__/g;

/**
 * Load a PAC file, return the modified global object.
 *
 * SECURITY NOTICE:
 * PAC file will be executed as JavaScript, so you should only load the code from trusted source.
 *
 * @param code PAC file content.
 * @return an object represent the script exports.
 */
export function loadPAC<T = PACGlobals>(code: string) {
	const context = Object.create(EnvFunctions);
	vm.runInNewContext(code, context, { timeout: 5000 });
	return Object.assign({}, context) as T;
}

/**
 * Key is a PAC proxy string, value is a array of HostnameSource.
 */
export type HostRules = Record<string, string[]>;

/**
 * Generate a PAC script use the built-in template.
 *
 * @return the PAC file content
 */
export async function buildPAC(rules: HostRules, direct = "DIRECT") {
	const packageJson = await importJson("../package.json");

	const proxies: string[] = [];
	const hostMap: Record<string, number> = {};

	for (const [k, v] of Object.entries(rules)) {
		const i = proxies.length;
		proxies.push(k);
		v.forEach(domain => hostMap[domain] = i);
	}

	const replacements: Record<any, string> = {
		VERSION: packageJson.version,
		DIRECT: JSON.stringify(direct),
		PROXIES: JSON.stringify(proxies, null, "\t"),
		RULES: JSON.stringify(hostMap, null, "\t"),
		TIME: new Date().toISOString(),
	};

	// Make time consistent in tests, also can be specified by user.
	const mockTime = process.env.MOCK_TIME;
	if (mockTime) {
		const value = parseInt(mockTime);
		if (!Number.isInteger(value)) {
			throw new Error("Invalid MOCK_TIME:" + mockTime);
		}
		replacements.TIME = new Date(value).toISOString();
	}

	/*
	 * Since TypeScript don't preserve empty lines, we still use JavaScript for template.
	 * A PR about this feature:
	 * https://github.com/microsoft/TypeScript/pull/42303
	 */
	const template = await readFile(join(root, "lib/template.js"), "utf8");
	return template.replaceAll(placeholder, (_, v) => replacements[v]);
}

export class HostnameListLoader {

	private readonly sources: HostnameSource[];
	private readonly proxies: string[];

	private lists: string[][];
	private onRuleUpdated?: () => void;

	constructor(map: Record<string, HostnameSource[]>) {
		this.sources = [];
		this.proxies = [];
		this.lists = [];

		const { sources, proxies } = this;

		for (const k of Object.keys(map)) {
			for (const source of map[k]) {
				proxies.push(k);
				sources.push(source);
			}
		}
	}

	async refresh() {
		this.lists = await Promise.all(this.sources.map(s => s.getHostnames()));
	}

	getRules() {
		const { proxies, lists } = this;

		if (lists.length !== proxies.length) {
			throw new Error("Please call refresh() first");
		}

		const rules: Record<string, string[]> = {};
		for (let i = 0; i < lists.length; i++) {
			const p = proxies[i];
			(rules[p] ??= []).push(...lists[i]);
		}
		return rules;
	}

	watch(onRuleUpdated: () => void) {
		const { sources, lists } = this;

		if (lists.length !== sources.length) {
			throw new Error("Please call refresh() first");
		}
		if (this.onRuleUpdated) {
			throw new Error("Already watched");
		}

		for (let i = 0; i < sources.length; i++) {
			sources[i].watch(v => {
				lists[i] = v;
				onRuleUpdated();
			});
		}
		this.onRuleUpdated = onRuleUpdated;
	}
}
