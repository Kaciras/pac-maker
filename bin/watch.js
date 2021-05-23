/**
 * Serve PAC file with http protocol, and update when source have changes.
 * Usage: node bin/watch.js [--save]
 */
import fs from "fs/promises";
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import Koa from "koa";
import cors from "@koa/cors";
import { buildPac, HostnameListLoader } from "../lib/generator.js";
import { ensureDirectory, getSettings, root } from "../lib/utils.js";

const { argv } = yargs(hideBin(process.argv));
const { path, direct, sources } = await getSettings();

process.chdir(root);

const loader = new HostnameListLoader(sources);
await loader.refresh();

let script = "";

async function refreshScript() {
	script = await buildPac(loader.getRules(), direct);

	if (argv.save) {
		await ensureDirectory(path);
		await fs.writeFile(path, script, "utf8");
	}

	console.info("PAC file updated at " + new Date());
}

await refreshScript();
loader.watch(refreshScript);

const app = new Koa();
app.use(cors());
app.use(ctx => {
	ctx.type = "application/x-ns-proxy-autoconfig";
	ctx.body = script;
});
app.on("error", err => console.error(err));
app.listen(7568, "localhost", () => {
	console.info("server started, http://localhost:7568/proxy.pac");
});
