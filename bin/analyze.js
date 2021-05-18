/**
 * Find what domains are proxied in browser history.
 */
import fs from "fs/promises";
import { loadPac, matchFindProxyFn } from "../lib/generator.js";
import { getSettings, root } from "../lib/utils.js";
import { getAllBrowserHistories } from "../lib/history.js";

process.chdir(root);

const { path } = await getSettings();

const { FindProxyForURL } = loadPac(await fs.readFile(path, "utf8"));

const histories = await getAllBrowserHistories();
const { rules, hostnameSet } = matchFindProxyFn(histories, FindProxyForURL);

console.info(`Inspect ${histories.length} urls, ${hostnameSet.size} distinct hosts.`);
const table = Object.fromEntries(Object.entries(rules).map(([k, v]) => [k, v.length]));
console.table(table, ["matched domains"]);

const file = "matches.json";
await fs.writeFile(file, JSON.stringify(rules, null, "\t"));
console.info(`Rules saved to ${file}`);
