#!/usr/bin/env node
import yargs, { Argv } from "yargs";
import Koa from "koa";
import cors from "@koa/cors";
import { buildPAC, HostnameListLoader } from "../lib/generator.js";
import { getSettings, root } from "../lib/utils.js";

interface CliOptions {
	host?: string;
	port?: number;
	config?: string;
}

const { argv } = yargs(process.argv.slice(2)) as Argv<CliOptions>;
const { direct, sources } = await getSettings(argv.config);

process.chdir(root);

let script = "";

async function rebuildPACScript() {
	script = await buildPAC(loader.getRules(), direct);
	console.info("PAC file updated at " + new Date());
}

const loader = new HostnameListLoader(sources);
await loader.refresh();
await rebuildPACScript();

const { host, port = 7568 } = argv;
const app = new Koa();
app.on("error", err => console.error(err));
app.use(cors());
app.use(ctx => {
	ctx.type = "application/x-ns-proxy-autoconfig";
	ctx.body = script;
});
app.listen(port, host, () => {
	console.info(`server started, http://localhost:${port}/proxy.pac`);
});
