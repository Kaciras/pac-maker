import { readFileSync } from "fs";
import { join } from "path";
import { EventEmitter } from "events";
import { importJson, root } from "./utils.js";
import { HostnameSource } from "./source.js";

/**
 * Key is a PAC proxy string, value is an array of hostnames.
 */
export type HostRules = Record<string, string[]>;

const placeholder = /__(.+?)__/g;

/**
 * Generate a PAC script use the built-in template.
 *
 * @param rules Proxy route rules.
 * @param fallback The value should be returned from FindProxyForURL if no rule matching.
 * @return the PAC script content
 */
export function buildPAC(rules: HostRules, fallback = "DIRECT") {
	const packageJson = importJson("../package.json");
	const proxies: string[] = [];
	const hostMap: Record<string, number> = {};

	for (const [k, v] of Object.entries(rules)) {
		const i = proxies.length;
		proxies.push(k);

		for (const hostname of v) {
			const j = hostMap[hostname];
			if (j === undefined) {
				hostMap[hostname] = i;
			} else if (j !== i) {
				throw new Error(hostname + " already exists");
			}
		}
	}

	const replacements: Record<string, string> = {
		VERSION: packageJson.version,
		FALLBACK: JSON.stringify(fallback),
		PROXIES: JSON.stringify(proxies, null, "\t"),
		RULES: JSON.stringify(hostMap, null, "\t"),
		TIME: new Date().toISOString(),
	};

	// Make time consistent in tests, also can be specified by user.
	const mockTime = process.env.MOCK_TIME;
	if (mockTime) {
		const value = parseInt(mockTime);
		if (!Number.isInteger(value)) {
			throw new Error("Invalid MOCK_TIME: " + mockTime);
		}
		replacements.TIME = new Date(value).toISOString();
	}

	/*
	 * Since TypeScript don't preserve empty lines, we still use JavaScript for template.
	 * A PR about this feature:
	 * https://github.com/microsoft/TypeScript/pull/42303
	 */
	const template = readFileSync(join(root, "template/default.js"), "utf8");
	return template.replaceAll(placeholder, (_, v) => replacements[v]);
}

/**
 * This class aggregate hostname sources.
 *
 * @example
 * const loader = await HostnameListLoader.create({...});
 * const rules = loader.getRules();
 *
 * // Watch for source updates.
 * loader.on("update", rules => {});
 */
export class HostnameListLoader extends EventEmitter {

	static create(map: Record<string, HostnameSource[]>) {
		const loader = new HostnameListLoader(map);
		return loader.refresh().then(() => loader);
	}

	private readonly sources: HostnameSource[] = [];
	private readonly proxies: string[] = [];

	private lists!: string[][];

	private constructor(map: Record<string, HostnameSource[]>) {
		super();
		const { sources, proxies } = this;

		for (const k of Object.keys(map)) {
			for (const source of map[k]) {
				proxies.push(k);
				sources.push(source);
			}
		}

		this.on("newListener", this.onNewListener);
		this.on("removeListener", this.onRemoveListener);
	}

	onNewListener(event: string) {
		if (event === "update" && this.listenerCount(event) === 0) {
			for (let i = 0; i < this.sources.length; i++) {
				this.sources[i].watch(v => {
					this.lists[i] = v;
					this.emit("update", this.getRules());
				});
			}
		}
	}

	onRemoveListener(event: string) {
		if (event === "update" && this.listenerCount(event) === 0) {
			this.sources.forEach(s => s.stopWatching());
		}
	}

	getRules() {
		const { proxies, lists } = this;

		const rules: HostRules = {};
		for (let i = 0; i < lists.length; i++) {
			const p = proxies[i];
			(rules[p] ??= []).push(...lists[i]);
		}
		return rules;
	}

	/**
	 * Force reload hostnames from all sources.
	 */
	async refresh() {
		this.lists = await Promise.all(this.sources.map(s => s.getHostnames()));
	}
}
