#!/usr/bin/env node
import yargs, { Argv } from "yargs";
import { getSettings, root } from "../lib/utils.js";
import { commands } from "../lib/index.js";

process.chdir(root);

interface BaseOptions {
	config?: string;
}

const { argv } = yargs(process.argv.slice(2)) as Argv<BaseOptions>;
const [name] = argv._;
const config = await getSettings(argv.config);

const commandFn = commands[name];
if (commandFn) {
	await commandFn(argv, config);
} else {
	throw new Error(`Unknown command: ${name}, see README.md for all supported commands`);
}
