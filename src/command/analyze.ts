import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import { HostnameListLoader, HostRules } from "../generator.js";
import { loadPAC, PACMakerConfig } from "../loader.js";
import { BrowserEngine, findAllBrowsers } from "../browser.js";

interface AnalyzeOptions {
	json?: string;
}

interface PACAnalyzeResult {
	/**
	 * Hostnames from `config.sources` that you visited with browsers.
	 */
	used: string[];

	/**
	 * Generate PAC rules from browser history and existing PAC file,
	 * by run the `FindProxyForURL` function with visited urls.
	 */
	routes: HostRules;
}

function getVisitedHosts(browsers: BrowserEngine[]) {
	return browsers.map(b => b.getHistories())
		.flatMap(e => e.map(h => h.url))
		.filter(url => /^https?:/.test(url))
		.map(url => new URL(url).hostname)
		.reduce((set, host) => set.add(host), new Set<string>());
}

async function getMatchedHosts(visited: Set<string>, hosts: string[]) {
	const segments = new Set<string>();
	for (let host of visited) {
		let pos = 0;
		while (pos >= 0) {
			pos = host.indexOf(".");
			segments.add(host);
			host = host.slice(pos + 1);
		}
	}
	return new Set(hosts.filter(h => segments.has(h)));
}

function percentage(numerator: any, denominator: any) {
	const dividend = numerator.size ?? numerator.length;
	const divisor = denominator.size ?? denominator.length;
	return (dividend / divisor * 100).toFixed(2) + "%";
}

export default async function (argv: AnalyzeOptions, config: PACMakerConfig) {
	const { path } = config;
	console.info("Finding what hosts will be proxied by PAC in browser history...\n");

	const browsers = findAllBrowsers();
	if (browsers.length) {
		console.info(`Read histories from ${browsers.length} browsers:`);
		for (const browser of browsers) {
			console.log(browser.toString());
		}
	} else {
		return console.info("No browser found in your computer.");
	}

	const hostSet = getVisitedHosts(browsers);

	const { FindProxyForURL } = loadPAC(readFileSync(path, "utf8"));
	const routes: HostRules = {};
	for (const host of hostSet) {
		const route = FindProxyForURL("", host) || "DIRECT";
		(routes[route] ??= []).push(host);
	}

	console.info(`\nInspect ${hostSet.size} distinct hosts.`);
	console.table(Object.entries(routes).map(([proxy, matches]) => ({
		"Proxy": proxy,
		"Matched Hosts": matches.length,
		"Percentage": percentage(matches, hostSet),
	})));

	const loader = await HostnameListLoader.create(config.sources);
	const hostOfRules = Object.values(loader.getRules()).flat();

	console.info("\nFinding visited hostnames of rules...");
	const used = await getMatchedHosts(hostSet, hostOfRules);
	console.info(`${used.size}(${percentage(used, hostOfRules)}) hostnames are used.`);

	const result: PACAnalyzeResult = {
		routes,
		used: Array.from(used),
	};
	const { json = "matches.json" } = argv;
	writeFileSync(json, JSON.stringify(result, null, "\t"));
	console.info(`\nResult is saved to ${resolve(json)}`);
}
