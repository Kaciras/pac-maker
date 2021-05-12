import fs from "fs/promises";
import { URL } from "url";
import fetch from "node-fetch";

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

export async function ruleFile(file) {
	const content = await fs.readFile(file, { encoding: "UTF8" });
	return content.split("\n").map(line => line.trim()).filter(line => line.length > 0);
}
