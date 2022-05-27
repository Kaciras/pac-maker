import { readFile, writeFile } from "fs/promises";
import { resolve } from "path";
import { URL } from "url";
import { HostnameListLoader, HostRules } from "../generator.js";
import { loadPAC } from "../loader.js";
import { findBrowserData } from "../browser.js";
import { PACMakerConfig } from "../config.js";

interface CliOptions {
	json?: string;
	config?: string;
}

interface PACAnalyzeResult {
	used: string[];
	routes: HostRules;
}

async function getMatchedHosts(list: Set<string>, config: PACMakerConfig) {
	const loader = new HostnameListLoader(config.sources);
	await loader.refresh();
	const rules = loader.getRules();

	const segments = new Set<string>();
	for (let host of list) {
		let pos = 0;
		while (pos >= 0) {
			pos = host.indexOf(".");
			segments.add(host);
			host = host.slice(pos + 1);
		}
	}

	const hostOfRules = Object.values(rules).flat();
	return new Set(hostOfRules.filter(h => segments.has(h)));
}

export default async function (argv: CliOptions, config: PACMakerConfig) {
	const { path } = config;
	console.info("Finding what hosts will be proxied by PAC in browser history...\n");

	const browsers = findBrowserData();
	if (browsers.length) {
		console.info(`Read histories from ${browsers.length} browsers:`);
		for (const browser of browsers) {
			console.log(browser.toString());
		}
	} else {
		return console.info("No browser found in your computer.");
	}

	const list = await Promise.all(browsers.map(b => b.getHistories()));
	const hostSet = new Set<string>();

	for (const entries of list) {
		for (const { url } of entries) {
			if (!/^https?:/.test(url)) {
				continue;
			}
			const host = new URL(url).hostname;
			hostSet.add(host);
		}
	}

	const { FindProxyForURL } = loadPAC(await readFile(path, "utf8"));
	const routes: HostRules = {};
	for (const host of hostSet) {
		(routes[FindProxyForURL("", host)] ??= []).push(host);
	}

	console.info(`\nInspect ${hostSet.size} distinct hosts.`);
	const table = Object.entries(routes).map(([k, v]) => ({
		"Proxy": k,
		"Matched Hosts": v.length,
		"Percentage": `${(v.length / hostSet.size * 100).toFixed(2)}%`,
	}));
	console.table(table);

	const used = await getMatchedHosts(hostSet, config);
	console.log(`${used.size} hostnames are used`);

	const result: PACAnalyzeResult = {
		routes,
		used: Array.from(used),
	};
	const { json = "matches.json" } = argv;
	await writeFile(json, JSON.stringify(result, null, "\t"));
	console.info(`\nResult is saved to ${resolve(json)}`);
}
