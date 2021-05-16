import fs from "fs/promises";
import { basename, join } from "path";
import { URL } from "url";
import fetch from "node-fetch";
import { root } from "./utils";

/**
 * Fetch domains from https://github.com/gfwlist/gfwlist
 *
 * @return domain list
 */
export async function gfwlist() {
	const response = await fetch("https://raw.githubusercontent.com/gfwlist/gfwlist/master/gfwlist.txt");
	const content = Buffer.from(await response.text(), "base64").toString();

	const result = [];

	for (let line of content.split("\n")) {
		if (line.includes("General List End")) {
			break; // rules after this are unusable
		}
		if (/^\s*$/.test(line)) {
			continue; // blank line
		}
		if (/^[[!]/.test(line)) {
			continue; // comment
		}
		if (line.startsWith("/")) {
			continue; // regexp
		}
		if (line.startsWith("@@")) {
			continue; // white list
		}
		if (line.includes("*")) {
			continue; // wildcard is not supported
		}

		line = line.replaceAll(/^[|.]+/g, "");
		if (!/^https?:/.test(line)) {
			line = "http://" + line;
		}
		result.push(new URL(decodeURIComponent(line)).hostname);
	}

	return result;
}

/**
 * Read domains from rule file.
 *
 * @param file the file path
 * @return domain list
 */
export async function ruleFile(file: string) {
	const content = await fs.readFile(file, "utf8");
	return content.split("\n")
		.map(line => line.trim())
		.filter(line => line.length > 0 && !line.startsWith("#"));
}

/**
 * Read domains from built-in rule file.
 *
 * @param name filename without extension
 * @return domain list
 */
export function builtInRuleSet(name: string) {
	if (name !== basename(name)) {
		throw new Error("Invalid rule set name: " + name);
	}
	return ruleFile(join(root, "rules", name + ".txt"));
}
