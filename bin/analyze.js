/**
 *
 */
import fs from "fs/promises";
import { getAllBrowserHistories } from "../lib/history.js";
import { root } from "../lib/utils.js";
import { loadPac, matchFindProxyFn } from "../lib/generator.js";

process.chdir(root);

async function match() {
	const pac = await fs.readFile("dist/proxy.pac", "utf8");
	const { FindProxyForURL } = loadPac(pac);

	const histories = await getAllBrowserHistories();
	const { rules, domains } = matchFindProxyFn(histories, FindProxyForURL);

	console.info(`Inspect ${histories.length} urls, ${domains.size} distinct domains.`);
	const table = Object.fromEntries(Object.entries(rules).map(([k, v]) => [k, v.length]));
	console.table(table, ["matched domains"]);

	const file = "matches.json";
	await fs.writeFile(file, JSON.stringify(rules, null, "\t"));
	console.info(`Rules saved to ${file}`);
}

match().catch(err => console.error(err));
