import { writeFile } from "fs/promises";
import { ensureDirectory, PACMakerConfig } from "../utils.js";
import { buildPAC, HostnameListLoader } from "../generator.js";

interface CliOptions {
	watch?: true;
	config?: string;
}

export default async function (argv: CliOptions, config: PACMakerConfig) {
	const { path, direct, sources } = config;

	const loader = new HostnameListLoader(sources);
	await loader.refresh();

	async function rebuildPACScript() {
		const script = await buildPAC(loader.getRules(), direct);
		await ensureDirectory(path);
		await writeFile(path, script, "utf8");
		console.info("PAC script updated at " + new Date());
	}

	await rebuildPACScript();

	if (argv.watch) {
		loader.watch(rebuildPACScript);
		console.info("pac-maker is watching for source updates...");
	}
}
