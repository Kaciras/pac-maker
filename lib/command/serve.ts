import Koa from "koa";
import cors from "@koa/cors";
import { buildPAC, HostnameListLoader } from "../generator.js";
import { PACMakerConfig } from "../config.js";

interface CliOptions {
	host?: string;
	port?: number;
	config?: string;
}

export default async function (argv: CliOptions, config: PACMakerConfig) {
	const { host, port = 7568 } = argv;
	const { direct, sources } = config;

	let script: string;

	async function rebuildPACScript() {
		script = buildPAC(loader.getRules(), direct);
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
	return app.listen(port, host, () => {
		console.info(`server started, http://localhost:${port}/proxy.pac`);
	});
}
