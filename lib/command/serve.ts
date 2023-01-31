import Koa from "koa";
import cors from "@koa/cors";
import { buildPAC, HostnameListLoader } from "../generator.js";
import { PACMakerConfig } from "../config.js";

interface ServeOptions {
	host?: string;
	port?: number;
	config?: string;
}

export default async function (argv: ServeOptions, config: PACMakerConfig) {
	const { host, port = 7568 } = argv;
	const { fallback, sources } = config;

	let script: string;

	function rebuildPACScript() {
		script = buildPAC(loader.getRules(), fallback);
		console.info("PAC updated at " + new Date());
	}

	const loader = await HostnameListLoader.create(sources);
	rebuildPACScript();
	loader.on("update", rebuildPACScript);

	const app = new Koa();
	app.on("error", err => console.error(err));
	app.use(cors());
	app.use(ctx => {
		ctx.type = "application/x-ns-proxy-autoconfig";
		ctx.body = script;
	});
	return app.listen(port, host, () => {
		console.info(`server started, http://localhost:${port}/proxy.pac`);
	});
}
