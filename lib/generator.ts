import { readFile } from "fs/promises";
import vm from "vm";
import { join } from "path";
import { URL } from "url";
import { HistoryEntry } from "./history.js";
import { root } from "./utils.js";
import { HostnameSource } from "./source";
import { importJson, root } from "./utils.js";

export type FinProxyFn = (url: string, host: string) => string;

export interface PacGlobals {
	FindProxyForURL: FinProxyFn;
}

export interface BuiltInPacGlobals extends PacGlobals {
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
export function loadPac<T = PacGlobals>(code: string) {
	const contextObject = {};
	vm.runInNewContext(code, contextObject, { timeout: 5000 });
	return contextObject as T;
}

interface BuildPacOptions {
	direct: string;
	domains: Record<string, string[]>;
}

/**
 * Generate a PAC script use the built-in template.
 *
 * @return {Promise<string>} the PAC file content
 */
export async function buildPac(rules: Record<string, string[]>, direct = "DIRECT") {
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

	const file = join(root, "lib/template.js");
	const template = await readFile(file, "utf8");
	return template.replaceAll(placeholder, (_, v) => replacements[v]);
}

interface PacMakerConfig {
	path: string;
	direct: string;
	rules: Record<string, HostnameSource[]>;
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
