import { createServer } from "http";
import { buildPAC, HostnameListLoader } from "../generator.js";


import { PACMakerConfig } from "../loader.js";

interface ServeOptions {
	host?: string;
	port?: number;
	config?: string;
}

const headers = {
	"Content-Type": "application/x-ns-proxy-autoconfig",
	"Access-Control-Allow-Origin": "*",
};

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

	const app = createServer((_, response) => {
		response.writeHead(200, headers).end(script);
	});
	app.on("error", err => console.error(err));

	return app.listen(port, host, () => {
		console.info(`server started, http://localhost:${port}/proxy.pac`);
	});
}
