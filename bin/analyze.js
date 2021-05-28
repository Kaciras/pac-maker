#!/usr/bin/env node
import fs from "fs/promises";
import { resolve } from "path";
import { URL } from "url";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { loadPac } from "../lib/generator.js";
import { getAllBrowserHistories } from "../lib/history.js";
import { getSettings, root } from "../lib/utils.js";

process.chdir(root);

const { argv, json = "matches.json" } = yargs(hideBin(process.argv));
const { path } = await getSettings(argv.config);

console.info("Finding what hosts will be proxied by PAC in browser history...\n");

export function matchFindProxyFn(histories, fn) {
	const rules = {};
	const hostnameSet = new Set();

	for (const { url } of histories) {
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

const { FindProxyForURL } = loadPac(await fs.readFile(path, "utf8"));
const histories = await getAllBrowserHistories();
const { rules, hostnameSet } = matchFindProxyFn(histories, FindProxyForURL);

console.info(`Inspect ${histories.length} urls, ${hostnameSet.size} distinct hosts.`);
const table = Object.entries(rules).map(([k, v]) => ({ Proxy: k, "Matched Hosts": v.length }));
console.table(table);

await fs.writeFile(json, JSON.stringify(rules, null, "\t"));
console.info(`\nRules are saved to ${resolve(json)}`);
