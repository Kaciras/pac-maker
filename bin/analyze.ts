#!/usr/bin/env node
import { readFile, writeFile } from "fs/promises";
import { resolve } from "path";
import { URL } from "url";
import yargs, { Argv } from "yargs";
import { FinProxyFn, HostRules, loadPac } from "../lib/generator.js";
import { getAllBrowserHistories, HistoryEntry } from "../lib/history.js";
import { getSettings, root } from "../lib/utils.js";

process.chdir(root);

interface CliOptions {
	json?: string;
	config?: string;
}

const { argv } = yargs(process.argv.slice(2)) as Argv<CliOptions>;
const { path } = await getSettings(argv.config);

console.info("Finding what hosts will be proxied by PAC in browser history...\n");

interface MatchResult {
	rules: HostRules;
	hostnameSet: Set<string>;
}

export function match(histories: HistoryEntry[], fn: FinProxyFn) {
	const rules: HostRules = {};
	const hostnameSet = new Set<string>();

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
		(rules[proxy] ??= []).push(host);
	}

	return { rules, hostnameSet } as MatchResult;
}

const { FindProxyForURL } = loadPac(await readFile(path, "utf8"));
const histories = await getAllBrowserHistories();
const { rules, hostnameSet } = match(histories, FindProxyForURL);

console.info(`Inspect ${histories.length} urls, ${hostnameSet.size} distinct hosts.`);
const table = Object.entries(rules).map(([k, v]) => ({ Proxy: k, "Matched Hosts": v.length }));
console.table(table);

const { json = "matches.json" } = argv;
await writeFile(json, JSON.stringify(rules, null, "\t"));
console.info(`\nRules are saved to ${resolve(json)}`);
