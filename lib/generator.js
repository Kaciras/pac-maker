import fs from "fs/promises";
import vm from "vm";
import { join } from "path";
import { ensureDirectory, projectRoot } from "./utils.js";

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
 * @param options
 * @return {Promise<string>} the PAC file content
 */
export async function buildPac(options) {
	const { direct, domains } = options;
	const packageJson = JSON.parse(await fs.readFile(join(projectRoot, "package.json")));

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

	const file = join(projectRoot, "lib/template.js");
	const template = await fs.readFile(file, { encoding: "UTF8" });
	return template.replaceAll(placeholder, (_, v) => replacements[v]);
}

export async function generate(options) {
	const { path, direct, rules } = options;

	const domains = {};
	for (const [k, v] of Object.entries(rules)) {
		domains[k] = (await Promise.all(v)).flat();
	}

	const result = await buildPac({ direct, domains });

	await ensureDirectory(path);
	await fs.writeFile(path, result, { encoding: "UTF8" });
}
