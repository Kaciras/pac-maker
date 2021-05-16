import fs from "fs/promises";
import vm from "vm";
import { join } from "path";
import { URL } from "url";
import { HistoryEntry } from "./history";
import { ensureDirectory, root } from "./utils";

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
 * @param options An object that contain proxy and rules
 * @return the PAC file content
 */
export async function buildPac(options: BuildPacOptions) {
	const { direct, domains } = options;
	const packageJson = JSON.parse(await fs.readFile(join(root, "package.json"), "utf8"));

	const proxies: string[] = [];
	const domainMap: Record<string, number> = {};

	for (const [k, v] of Object.entries(domains)) {
		const i = proxies.length;
		proxies.push(k);
		v.forEach(domain => domainMap[domain] = i);
	}

	const replacements: Record<any, string> = {
		VERSION: packageJson.version,
		DIRECT: JSON.stringify(direct),
		PROXIES: JSON.stringify(proxies, null, "\t"),
		RULES: JSON.stringify(domainMap, null, "\t"),
		TIME: new Date().toISOString(),
	};

	const file = join(root, "lib/template.js");
	const template = await fs.readFile(file, "utf8");
	return template.replaceAll(placeholder, (_, v) => replacements[v]);
}

interface PacMakerConfig {
	path: string;
	direct: string;
	rules: Record<string, Promise<string[]>[]>;
}

export async function generate(options: PacMakerConfig) {
	const { path, direct, rules } = options;

	const domains: Record<string, string[]> = {};
	for (const [k, v] of Object.entries(rules)) {
		domains[k] = (await Promise.all(v)).flat();
	}

	const result = await buildPac({ direct, domains });

	await ensureDirectory(path);
	await fs.writeFile(path, result, "utf8");
}

interface DomainMatchResult {
	domains: Set<string>;
	rules: Record<string, string[]>;
}

export function matchFindProxyFn(urls: HistoryEntry[], fn: FinProxyFn) {
	const domains = new Set<string>();
	const rules: Record<string, string[]> = {};

	for (const { url } of urls) {
		if (!/^https?:/.test(url)) {
			continue;
		}
		const host = new URL(url).hostname;
		if (domains.has(host)) {
			continue;
		}
		domains.add(host);
		const proxy = fn(url, host);
		(rules[proxy] ?? (rules[proxy] = [])).push(host);
	}

	return { rules, domains } as DomainMatchResult;
}
