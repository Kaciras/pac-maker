import fs from "fs/promises";
import vm from "vm";
import { join } from "path";
import { ensureDirectory, root } from "./utils.js";
import { URL } from "url";

const placeholder = /__(.+?)__/g;

/**
 * Load a PAC file, return the modified global object.
 *
 * SECURITY NOTICE:
 * PAC file will be executed as JavaScript, so you should only load the code from trusted source.
 *
 * @param code PAC file content.
 * @return object the object represent the script exports.
 */
export function loadPac(code) {
	const contextObject = {};
	vm.runInNewContext(code, contextObject, { timeout: 5000 });
	return contextObject;
}

/**
 * Generate a PAC script use the built-in template.
 *
 * @param options An object that contain proxy and rules
 * @return {Promise<string>} the PAC file content
 */
export async function buildPac(options) {
	const { direct, domains } = options;
	const packageJson = JSON.parse(await fs.readFile(join(root, "package.json")));

	const proxies = [];
	const domainMap = {};

	for (const [k, v] of Object.entries(domains)) {
		const i = proxies.length;
		proxies.push(k);
		v.forEach(domain => domainMap[domain] = i);
	}

	const replacements = {
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

export async function generate(options) {
	const { path, direct, rules } = options;

	const domains = {};
	for (const [k, v] of Object.entries(rules)) {
		const tasks = v.map(s => s.getDomains());
		domains[k] = (await Promise.all(tasks)).flat();
	}

	const result = await buildPac({ direct, domains });

	await ensureDirectory(path);
	await fs.writeFile(path, result, "utf8");
}

export function matchFindProxyFn(urls, fn) {
	const rules = {};
	const domains = new Set();

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

	return { rules, domains };
}
