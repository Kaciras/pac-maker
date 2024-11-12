import { env, platform } from "node:process";
import { join } from "node:path";
import { existsSync, readFileSync, statSync } from "node:fs";
import * as ini from "ini";

let Driver: undefined | typeof import("better-sqlite3");

try {
	Driver = (await import("node:sqlite")).DatabaseSync as any;
} catch {
	try {
		Driver = (await import("better-sqlite3")).default;
	} catch {
		// Do not throw any errors until it is used.
	}
}

function openSqlite(file: string) {
	if (Driver === undefined) {
		throw new Error("No Sqlite driver, please install better-sqlite3 or enable Node builtin sqlite module");
	}
	return new Driver(file, { readonly: true });
}

export interface HistoryEntry {
	id: number;
	url: string;
}

export interface BrowserEngine {

	getHistories(): HistoryEntry[];
}

export class Safari implements BrowserEngine {

	readonly directory: string;

	constructor(directory: string) {
		this.directory = directory;

		if (!statSync(directory).isDirectory()) {
			throw new Error(`${directory} is not a directory`);
		}
	}

	toString() {
		return `Safari - ${this.directory}`;
	}

	getHistories() {
		const db = openSqlite(join(this.directory, "History.db"));
		return db.prepare<[], HistoryEntry>("SELECT id,url FROM history_items").all();
	}
}

export class Chromium implements BrowserEngine {

	readonly directory: string;

	constructor(directory: string) {
		this.directory = directory;

		if (!statSync(directory).isDirectory()) {
			throw new Error(`${directory} is not a directory`);
		}
	}

	toString() {
		return `Chromium - ${this.directory}`;
	}

	getHistories() {
		let profile = join(this.directory, "Default");
		if (!existsSync(profile)) {
			const state = JSON.parse(readFileSync(join(this.directory, "Local State"), "utf8"));
			profile = join(this.directory, state.profile.last_used);
		}
		const db = openSqlite(join(profile, "History"));
		return db.prepare<[], HistoryEntry>("SELECT id,url FROM urls").all();
	}
}

export class Firefox implements BrowserEngine {

	readonly directory: string;

	constructor(directory: string) {
		this.directory = directory;

		if (!statSync(directory).isDirectory()) {
			throw new Error(`${directory} is not a directory`);
		}
	}

	toString() {
		return `Firefox - ${this.directory}`;
	}

	getHistories() {
		const db = openSqlite(join(this.directory, "places.sqlite"));
		return db.prepare<[], HistoryEntry>("SELECT id,url FROM moz_places").all();
	}
}

/**
 * Find Firefox profile of current user in your computer.
 */
export function findFirefox() {
	let userDir;

	switch (platform) {
		case "win32":
			userDir = join(env.APPDATA!, "Mozilla/Firefox");
			break;
		case "darwin":
			userDir = join(env.HOME!, "Library/Application Support/Firefox");
			break;
		default:
			throw new Error("Unsupported platform: " + platform);
	}

	const file = join(userDir, "profiles.ini");
	const config = ini.parse(readFileSync(file, "utf8"));

	const install = Object.keys(config).find(s => s.startsWith("Install"));
	if (install) {
		return new Firefox(config[install].Default);
	}
	throw new Error("Can not find [Install*] section in profiles.ini");
}

/**
 * Find Edge data of current user in your computer.
 * Only support Edge 79+
 */
export function findEdge() {
	if (process.platform !== "win32") {
		throw new Error("Unsupported platform: " + process.platform);
	}
	return new Chromium(join(env.LOCALAPPDATA!, "Microsoft/Edge/User Data"));
}

/**
 * Find Chrome data of current user in your computer.
 */
export function findChrome() {
	switch (platform) {
		case "win32":
			return new Chromium(join(env.LOCALAPPDATA!, "Google/Chrome/User Data"));
		case "linux":
			return new Chromium(join(env.HOME!, ".config/google-chrome"));
		case "darwin":
			return new Chromium(join(env.HOME!, "Library/Application Support/Google/Chrome"));
		default:
			throw new Error("Unsupported platform: " + platform);
	}
}

export function findSafari() {
	return new Safari(join(env.HOME!, "Library", "Safari"));
}

function silence<T>(fn: () => T) {
	try {
		return fn();
	} catch {
		return undefined;
	}
}

export function findAllBrowsers() {
	const browsers: Array<() => BrowserEngine> = [findFirefox, findEdge, findChrome, findSafari];
	return browsers.map(silence).filter(Boolean) as BrowserEngine[];
}
