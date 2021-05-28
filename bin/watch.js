#!/usr/bin/env node
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import Koa from "koa";
import cors from "@koa/cors";
import { buildPac, HostnameListLoader } from "../lib/generator.js";
import { getSettings, root } from "../lib/utils.js";

const { argv, port = 7568 } = yargs(hideBin(process.argv));
const { direct, sources } = await getSettings(argv.config);

process.chdir(root);

let script = "";

async function rebuildPACScript() {
	script = await buildPac(loader.getRules(), direct);
	console.info("PAC file updated at " + new Date());
}

const loader = new HostnameListLoader(sources);
await loader.refresh();
await rebuildPACScript();

const app = new Koa();
app.on("error", err => console.error(err));
app.use(cors());
app.use(ctx => {
	ctx.type = "application/x-ns-proxy-autoconfig";
	ctx.body = script;
});
app.listen(port, "localhost", () => {
	console.info(`server started, http://localhost:${port}/proxy.pac`);
});
