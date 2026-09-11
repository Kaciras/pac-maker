#!/usr/bin/env node
import { parseArgs } from "node:util";
import { importCWD } from "@kaciras/utilities/node";
import { commands, PACMakerConfig } from "./index.ts";

type Command = (argv: any, config: PACMakerConfig) => Promise<unknown>;

const default_: PACMakerConfig = {
	path: "proxy.pac",
	sources: {},
	fallback: "DIRECT",
};

const { values, positionals: [name] } = parseArgs({
	options: {
		config: {
			type: 'string',
		},
	},
	allowPositionals: true,
	args: process.argv.slice(2),
});

const config = await importCWD(values.config, ["pac.config.js"]);

const commandFn = (commands as Record<string, Command>)[name];
if (commandFn) {
	await commandFn(values, { ...default_, ...config });
} else {
	throw new Error(`Unknown command: ${name}, see README.md for all supported commands`);
}
