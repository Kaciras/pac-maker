/**
 * Serve PAC file with http protocol, and update when source have changes.
 * Usage: node bin/watch.js [--save]
 */
import fs from "fs/promises";
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import Koa from "koa";
import cors from "@koa/cors";
import { buildPac, getRuleFromSources } from "../lib/generator.js";
import { ensureDirectory, getSettings, root } from "../lib/utils.js";

const { argv } = yargs(hideBin(process.argv));
const { path, direct, sources } = await getSettings();

process.chdir(root);

let script = "";

async function refresh() {
	const rules = await getRuleFromSources(sources);
	script = await buildPac(rules, direct);

	if (argv.save) {
		await ensureDirectory(path);
		await fs.writeFile(path, script, "utf8");
	}

	console.info("PAC file updated at " + new Date());
}

for (const list of Object.values(sources)) {
	list.forEach(source => source.watch(refresh));
}

const app = new Koa();
app.use(cors());

app.use(ctx => {
	ctx.type = "application/x-ns-proxy-autoconfig";
	ctx.body = script;
});

app.on("error", err => console.error(err));

await refresh();

app.listen(7568, "localhost", () => {
	console.info("server started on http://localhost:7568/proxy.pac");
});
