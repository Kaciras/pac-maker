import fs from "fs/promises";
import fetch from "node-fetch";

export async function gfwlist() {
	const response = await fetch("https://raw.githubusercontent.com/gfwlist/gfwlist/master/gfwlist.txt");
	const buffer = (await response).arrayBuffer();
	const content = Buffer.from(buffer, "base64").toString();

	const result = [];
	for (const line of content.split("\n")) {
		if (/^[[!]?\s*$/.test(line)) {
			continue; // 注释和空行
		}
		if (line.startsWith("@@")) {
			continue; // 白名单
		}
	}
	return result;
}

export async function ruleFile(file) {
	const content = await fs.readFile(file, { encoding: "UTF8"});
	return content.split("\n").map(line => line.trim()).filter(line => line.length > 0);
}
