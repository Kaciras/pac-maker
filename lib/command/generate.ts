import { readFileSync, writeFileSync } from "fs";
import chalk from "chalk";
import { PACMakerConfig } from "../config.js";
import { buildPAC, HostnameListLoader } from "../generator.js";
import { ensureDirectory } from "../utils.js";
import { BuiltinPAC, loadPAC } from "../loader.js";

const { redBright, greenBright } = chalk;

interface GenerateOptions {
	watch?: true;
	config?: string;
}

function diff(old: string, code: string) {
	const { rules: rOld } = loadPAC<BuiltinPAC>(readFileSync(old, "utf8"));
	const { rules: rNew } = loadPAC<BuiltinPAC>(code);

	const newKeys = Object.keys(rNew);
	let intersection = 0;
	for (const host of newKeys) {
		if (host in rOld) intersection += 1;
	}

	return {
		added: newKeys.length - intersection,
		removed: Object.keys(rOld).length - intersection,
	};
}

export default async function (argv: GenerateOptions, config: PACMakerConfig) {
	const { path, fallback, sources } = config;
	const loader = await HostnameListLoader.create(sources);

	function rebuildPACScript() {
		const rules = loader.getRules();
		const script = buildPAC(rules, fallback);
		ensureDirectory(path);

		let detail = "";
		try {
			const { added, removed } = diff(path, script);
			const p0 = greenBright(`${added}+`);
			const p1 = redBright(`${removed}-`);
			detail = ` ${p0}, ${p1}.`;
		} catch (e) {
			// Old file is not exists or cannot parse.
		}

		writeFileSync(path, script);
		console.info(`[${new Date()}] PAC updated.${detail}`);
	}

	rebuildPACScript();

	if (argv.watch) {
		loader.on("update", rebuildPACScript);
		console.info("pac-maker is watching for source updates...");
	}
}
