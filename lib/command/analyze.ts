import { readFile, writeFile } from "fs/promises";
import { resolve } from "path";
import { URL } from "url";
import { HostRules } from "../generator.js";
import { FindProxy, loadPAC } from "../loader.js";
import { findBrowserData, HistoryEntry } from "../browser.js";
import { PACMakerConfig } from "../config.js";

interface MatchResult {
	rules: HostRules;
	hostnameSet: Set<string>;
}

function getHostnamesFromBrowser() {

}

export function match(histories: HistoryEntry[], fn: FindProxy) {
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

interface CliOptions {
	json?: string;
	config?: string;
}

export default async function (argv: CliOptions, config: PACMakerConfig) {
	const { path } = config;
	console.info("Finding what hosts will be proxied by PAC in browser history...\n");

	const browsers = findBrowserData();
	if (browsers.length) {
		console.info(`Read histories from ${browsers.length} browsers:`);
	} else {
		return console.info("No browser found in your computer.");
	}

	for (const browser of browsers) {
		console.log(browser.toString());
	}
	const histories = (await Promise.all(browsers.map(b => b.getHistories()))).flat();

	const { FindProxyForURL } = loadPAC(await readFile(path, "utf8"));
	const { rules, hostnameSet } = match(histories, FindProxyForURL);
	const hostSize = hostnameSet.size;

	console.info(`\nInspect ${histories.length} urls, ${hostSize} distinct hosts.`);
	const table = Object.entries(rules).map(([k, v]) => ({
		"Proxy": k,
		"Matched Hosts": v.length,
		"Percentage": `${(v.length / hostSize * 100).toFixed(2)}%`,
	}));
	console.table(table);

	const { json = "matches.json" } = argv;
	await writeFile(json, JSON.stringify(rules, null, "\t"));
	console.info(`\nRules are saved to ${resolve(json)}`);
}
