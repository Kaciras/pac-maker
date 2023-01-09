import { readFile, writeFile } from "fs/promises";
import chalk from "chalk";
import { PACMakerConfig } from "../config.js";
import { buildPAC, HostnameListLoader, HostRules } from "../generator.js";
import { ensureDirectory } from "../utils.js";
import { BuiltinPAC, loadPAC } from "../loader.js";

const { redBright, greenBright } = chalk;

interface GenerateOptions {
	watch?: true;
	config?: string;
}

async function diff(file: string, newRules: HostRules) {
	const { rules } = loadPAC<BuiltinPAC>(await readFile(file, "utf8"));
	const hosts = new Set(Object.values(newRules).flat());

	let intersection = 0;
	for (const host of hosts) {
		if (host in rules) intersection += 1;
	}

	return {
		added: hosts.size - intersection,
		removed: Object.keys(rules).length - intersection,
	};
}

export default async function (argv: GenerateOptions, config: PACMakerConfig) {
	const { path, fallback, sources } = config;

	const loader = await HostnameListLoader.create(sources);

	async function rebuildPACScript() {
		const rules = loader.getRules();
		const script = buildPAC(rules, fallback);
		await ensureDirectory(path);

		let detail = "";
		try {
			const { added, removed } = await diff(path, rules);
			const p0 = greenBright(`${added}+`);
			const p1 = redBright(`${removed}-`);
			detail = ` ${p0}, ${p1}.`;
		} catch (e) {
			// Old file is not exists or cannot parse.
		}

		await writeFile(path, script);
		console.info(`[${new Date()}] PAC updated.${detail}`);
	}

	await rebuildPACScript();

	if (argv.watch) {
		loader.on("update", rebuildPACScript);
		console.info("pac-maker is watching for source updates...");
	}
}
