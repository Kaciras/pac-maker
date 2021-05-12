import fs from "fs/promises";
import vm from "vm";
import { projectFile } from "./utils.js";

const placeholder = /__(.+?)__/g;

/**
 * Load and execute a generated PAC file.
 *
 * @param code PAC file content
 * @return object the global object modified by PAC script
 */
export function parse(code) {
	const contextObject = {};
	vm.runInNewContext(code, contextObject, { timeout: 5000 });
	return contextObject;
}

/**
 * Generate a PAC script use the built-in template.
 *
 * @param options
 * @return {Promise<string>} the PAC file content
 */
export async function buildPac(options) {
	const { direct, rules } = options;
	const packageJson = JSON.parse(await fs.readFile(projectFile("package.json")));

	const proxies = [];
	const domains = {};

	for (const [k, v] of Object.entries(rules)) {
		const i = proxies.length;
		proxies.push(k);
		v.forEach(domain => domains[domain] = i);
	}

	const replacements = {
		VERSION: packageJson.version,
		DIRECT: JSON.stringify(direct),
		PROXIES: JSON.stringify(proxies, null,"\t"),
		RULES: JSON.stringify(domains, null,"\t"),
		TIME: new Date().toISOString(),
	};

	const file = projectFile("lib/template.js");
	const template = await fs.readFile(file, { encoding: "UTF8" });
	return template.replaceAll(placeholder, (_, v) => replacements[v]);
}
