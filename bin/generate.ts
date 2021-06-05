#!/usr/bin/env node
import { writeFile } from "fs/promises";
import yargs, { Argv } from "yargs";
import { ensureDirectory, getSettings, root } from "../lib/utils.js";
import { buildPAC, HostnameListLoader } from "../lib/generator.js";

process.chdir(root);

interface CliOptions {
	watch?: true;
	config?: string;
}

const { argv } = yargs(process.argv.slice(2)) as Argv<CliOptions>;
const { path, direct, sources } = await getSettings(argv.config);

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
	console.info("pac-maker is watching for updates...");
}
