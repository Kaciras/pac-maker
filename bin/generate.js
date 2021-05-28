#!/usr/bin/env node
import fs from "fs/promises";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { ensureDirectory, getSettings, root } from "../lib/utils.js";
import { buildPac, HostnameListLoader } from "../lib/generator.js";

process.chdir(root);

const { argv } = yargs(hideBin(process.argv));
const { path, direct, sources } = await getSettings(argv.config);

const loader = new HostnameListLoader(sources);
await loader.refresh();

async function rebuildPACScript() {
	const script = await buildPac(loader.getRules(), direct);
	await ensureDirectory(path);
	await fs.writeFile(path, script, "utf8");
	console.info("PAC script updated at " + new Date());
}

await rebuildPACScript();

if (argv.watch) {
	loader.watch(rebuildPACScript);
	console.info("pac-maker is watching for updates...");
}
