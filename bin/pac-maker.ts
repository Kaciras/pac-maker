#!/usr/bin/env node
import yargs, { Argv } from "yargs";
import { loadConfig } from "../lib/config.js";
import { commands } from "../lib/index.js";

interface BaseOptions {
	config?: string;
}

const argv = (yargs(process.argv.slice(2)) as Argv<BaseOptions>).parseSync();
const [name] = argv._;

const configFile = argv.config ?? "pac.config.js";
const required = !!argv.config;
const config = await loadConfig(configFile, required);

const commandFn = commands[name];
if (commandFn) {
	await commandFn(argv, config);
} else {
	throw new Error(`Unknown command: ${name}, see README.md for all supported commands`);
}
