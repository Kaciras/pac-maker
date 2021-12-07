import { readFile } from "fs/promises";
import { join } from "path";
import { HostnameSource } from "./source.js";
import { importJson, root } from "./utils.js";

/**
 * Key is a PAC proxy string, value is an array of hostnames.
 */
export type HostRules = Record<string, string[]>;

const placeholder = /__(.+?)__/g;

/**
 * Generate a PAC script use the built-in template.
 *
 * @param rules Proxy route rules.
 * @param direct The value should be returned from FindProxyForURL if no rule matching.
 * @return the PAC script content
 */
export async function buildPAC(rules: HostRules, direct = "DIRECT") {
	const packageJson = await importJson("../package.json");

	const proxies: string[] = [];
	const hostMap: Record<string, number> = {};

	for (const [k, v] of Object.entries(rules)) {
		const index = proxies.length;
		proxies.push(k);

		for (const hostname of v) {
			if (hostname in hostMap) {
				throw new Error(hostname + " already exists");
			}
			hostMap[hostname] = index;
		}
	}

	const replacements: Record<any, string> = {
		VERSION: packageJson.version,
		FALLBACK: JSON.stringify(direct),
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
	const template = await readFile(join(root, "template/default.js"), "utf8");
	return template.replaceAll(placeholder, (_, v) => replacements[v]);
}

/**
 * This class aggregate hostname sources.
 */
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

	/**
	 * Force reload hostnames from all sources, this method muse be called before
	 * others in HostnameListLoader.
	 */
	async refresh() {
		this.lists = await Promise.all(this.sources.map(s => s.getHostnames()));
	}

	getRules() {
		const { proxies, lists } = this;

		if (lists.length !== proxies.length) {
			throw new Error("Please call refresh() first");
		}

		const rules: HostRules = {};
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
