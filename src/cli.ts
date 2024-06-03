#!/usr/bin/env node
import yargs, { Argv } from "yargs";
import { importCWD } from "@kaciras/utilities/node";
import { commands, PACMakerConfig } from "./index.js";

type Command = (argv: any, config: PACMakerConfig) => Promise<unknown>;

interface BaseOptions {
	config?: string;
}

const default_: PACMakerConfig = {
	path: "proxy.pac",
	sources: {},
	fallback: "DIRECT",
};

const argv = (yargs(process.argv.slice(2)) as Argv<BaseOptions>).parseSync();
const [name] = argv._;

const config = await importCWD(argv.config, ["pac.config.js"]);

const commandFn = (commands as Record<string, Command>)[name];
if (commandFn) {
	await commandFn(argv, { ...default_, ...config });
} else {
	throw new Error(`Unknown command: ${name}, see README.md for all supported commands`);
}
