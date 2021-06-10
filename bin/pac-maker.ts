#!/usr/bin/env node
import yargs, { Argv } from "yargs";
import { getSettings, PACMakerConfig, root } from "../lib/utils.js";
import analyze from "../lib/command/analyze.js";
import generate from "../lib/command/generate.js";
import serve from "../lib/command/serve.js";

process.chdir(root);

interface BaseOptions {
	config?: string;
}

type CommandHandler = (argv: any, config: PACMakerConfig) => Promise<void>;

const commands: Record<string, CommandHandler> = {
	analyze,
	serve,
	generate,
};

const { argv } = yargs(process.argv.slice(2)) as Argv<BaseOptions>;
const [name] = argv._;
const config = await getSettings(argv.config);

const commandFn = commands[name];
if (commandFn) {
	await commandFn(argv, config);
} else {
	throw new Error(`Unknown command: ${name}, see README.md for all supported commands`);
}
