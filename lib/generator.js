import fs from "fs/promises";
import vm from "vm";
import { join } from "path";
import { URL } from "url";
import { root } from "./utils.js";

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
 * @return {Promise<string>} the PAC file content
 */
export async function buildPac(rules, direct = "DIRECT") {
	const packageJson = JSON.parse(await fs.readFile(join(root, "package.json")));

	const proxies = [];
	const hostMap = {};

	for (const [k, v] of Object.entries(rules)) {
		const i = proxies.length;
		proxies.push(k);
		v.forEach(domain => hostMap[domain] = i);
	}

	const replacements = {
		VERSION: packageJson.version,
		DIRECT: JSON.stringify(direct),
		PROXIES: JSON.stringify(proxies, null, "\t"),
		RULES: JSON.stringify(hostMap, null, "\t"),
		TIME: new Date().toISOString(),
	};

	const file = join(root, "lib/template.js");
	const template = await fs.readFile(file, "utf8");
	return template.replaceAll(placeholder, (_, v) => replacements[v]);
}

export async function getRuleFromSources(sources) {
	const proxies = [];
	const tasks = [];

	for (const [k, v] of Object.entries(sources)) {
		for (const source of v) {
			proxies.push(k);
			tasks.push(source.getHostnames());
		}
	}
	const results = await Promise.all(tasks);
	const rules = {};
	for (let i = 0; i < proxies.length; i++) {
		const p = proxies[i];
		(rules[p] ?? (rules[p] = [])).push(...results[i]);
	}
	return rules;
}

export function matchFindProxyFn(urls, fn) {
	const rules = {};
	const hostnameSet = new Set();

	for (const { url } of urls) {
		if (!/^https?:/.test(url)) {
			continue;
		}
		const host = new URL(url).hostname;
		if (hostnameSet.has(host)) {
			continue;
		}
		hostnameSet.add(host);
		const proxy = fn(url, host);
		(rules[proxy] ?? (rules[proxy] = [])).push(host);
	}

	return { rules, hostnameSet };
}
