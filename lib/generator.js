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

export async function buildPac(rules) {
	const packageJson = JSON.parse(await fs.readFile(projectFile("package.json")));

	const replacements = {
		VERSION: packageJson.version,
		RULES: JSON.stringify(rules, "\t"),
		NO_PROXY: JSON.stringify("DIRECT"),
		PROXY: JSON.stringify("SOCKS5 localhost:2080"),
		TIME: new Date().toISOString(),
	};

	const file = projectFile("lib/template.js");
	const template = await fs.readFile(file, { encoding: "UTF8" });
	return template.replaceAll(placeholder, (_, v) => replacements[v]);
}
