/**
 * Serve PAC file with http protocol, and update when source have changes.
 */
import cors from "@koa/cors";
import Koa from "koa";
import { buildPac, getRuleFromSources } from "../lib/generator.js";
import { getSettings } from "../lib/utils.js";

let script = "";

const app = new Koa();
app.use(cors());

app.use(ctx => {
	ctx.type = "application/x-ns-proxy-autoconfig";
	ctx.body = script;
});

app.on("error", err => console.error(err));

const { direct, sources } = await getSettings();

async function refresh() {
	const rules = await getRuleFromSources(sources);
	script = await buildPac(rules, direct);
	console.info("PAC file updated at " + new Date());
}

for (const list of Object.values(sources)) {
	list.forEach(source => source.watch(refresh));
}

await refresh();

app.listen(7568, "localhost", () => {
	console.info("server started on http://localhost:7568/proxy.pac");
});
