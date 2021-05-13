/**
 *
 */
import { URL } from "url";
import fs from "fs";
import { firefox } from "../lib/history.js";
import { root } from "../lib/utils.js";
import { loadPac } from "../lib/generator.js";

process.chdir(root);

async function match() {
	const pac = fs.readFileSync("dist/proxy.pac", "utf8");
	const { FindProxyForURL } = loadPac(pac);

	const histories = await firefox();
	const map = {};
	const visited = new Set();

	for (const { url } of histories) {
		if (!/^https?:/.test(url)) {
			continue;
		}
		const host = new URL(url).hostname;
		if (visited.has(host)) {
			continue;
		}
		visited.add(host);
		const proxy = FindProxyForURL(url, host);
		(map[proxy] ?? (map[proxy] = [])).push(host);
	}

	console.info(`Inspect ${histories.length} urls, ${visited.size} distinct domains.`);
	const table = Object.fromEntries(Object.entries(map).map(([k, v]) => [k, v.length]));
	console.table(table, ["matched domains"]);
}

console.info("");
match().catch(err => console.error(err));
