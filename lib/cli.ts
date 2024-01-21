#!/usr/bin/env node
import yargs, { Argv } from "yargs";
import { loadConfig, PACMakerConfig } from "./config.js";
import { commands } from "./index.js";

type Command = (argv: any, config: PACMakerConfig) => Promise<unknown>;

interface BaseOptions {
	config?: string;
}

const argv = (yargs(process.argv.slice(2)) as Argv<BaseOptions>).parseSync();
const [name] = argv._;

const configFile = argv.config ?? "pac.config.js";
const required = !!argv.config;
const config = await loadConfig(configFile, required);

const commandFn = (commands as Record<string, Command>)[name];
if (commandFn) {
	await commandFn(argv, config);
} else {
	throw new Error(`Unknown command: ${name}, see README.md for all supported commands`);
}
