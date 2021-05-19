/**
 * Find what domains are proxied in browser history.
 */
import fs from "fs/promises";
import { loadPac, matchFindProxyFn } from "../lib/generator.js";
import { getSettings, root } from "../lib/utils.js";
import { getAllBrowserHistories } from "../lib/history.js";

process.chdir(root);

const { path } = await getSettings();
const file = "matches.json";

const { FindProxyForURL } = loadPac(await fs.readFile(path, "utf8"));

const histories = await getAllBrowserHistories();
const { rules, hostnameSet } = matchFindProxyFn(histories, FindProxyForURL);

console.info(`Inspect ${histories.length} urls, ${hostnameSet.size} distinct hosts.`);
const table = Object.entries(rules).map(([k, v]) => ({ Proxy: k, "Matched Hosts": v.length }));
console.table(table);

await fs.writeFile(file, JSON.stringify(rules, null, "\t"));
console.info(`Rules saved to ${file}`);
