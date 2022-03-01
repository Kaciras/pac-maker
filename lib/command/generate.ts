import { readFileSync, writeFileSync } from "fs";
import chalk from "chalk";
import { PACMakerConfig } from "../config.js";
import { buildPAC, HostnameListLoader, HostRules } from "../generator.js";
import { ensureDirectory } from "../utils.js";
import { BuiltinPAC, loadPAC } from "../loader.js";

const { redBright, greenBright } = chalk;

interface CliOptions {
	watch?: true;
	config?: string;
}

function diff(file: string, newRules: HostRules) {
	const { rules } = loadPAC<BuiltinPAC>(readFileSync(file, "utf8"));
	const hosts = Object.values(newRules).flat();

	let intersection = 0;
	for (const host of hosts) {
		if (host in rules) intersection += 1;
	}

	return {
		added: hosts.length - intersection,
		removed: Object.keys(rules).length - intersection,
	};
}

export default async function (argv: CliOptions, config: PACMakerConfig) {
	const { path, direct, sources } = config;

	const loader = new HostnameListLoader(sources);
	await loader.refresh();

	async function rebuildPACScript() {
		const rules = loader.getRules();
		const script = await buildPAC(rules, direct);
		await ensureDirectory(path);

		let detail = "";
		try {
			const { added, removed } = diff(path, rules);
			detail += greenBright(` ${added}+`);
			detail += redBright(`, ${removed}-.`);
		} catch (e) {
			// Old file is not exists or cannot parse
		}

		writeFileSync(path, script, "utf8");
		console.log(`[${new Date()}] PAC updated.${detail}`);
	}

	await rebuildPACScript();

	if (argv.watch) {
		loader.watch(rebuildPACScript);
		console.info("pac-maker is watching for source updates...");
	}
}
