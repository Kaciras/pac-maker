import { env, platform } from "process";
import { join } from "path";
import { readFileSync, statSync } from "fs";
import ini from "ini";
import sqlite3 from "sqlite3";
import { open } from "sqlite";

export interface HistoryEntry {
	id: number;
	url: string;
}

export interface BrowserData {

	getHistories(): Promise<HistoryEntry[]>;
}

export class Chromium implements BrowserData {

	private readonly directory: string;

	constructor(directory: string) {
		this.directory = directory;

		if (!statSync(directory).isDirectory()) {
			throw new Error(`${directory} is not a directory`);
		}
	}

	toString() {
		return `Chromium - ${this.directory}`;
	}

	async getHistories(afterBy?: HistoryEntry) {
		const db = await open({
			filename: join(this.directory, "Default/History"),
			driver: sqlite3.Database,
			mode: sqlite3.OPEN_READONLY,
		});
		const id = afterBy ? afterBy.id : 0;
		return db.all<HistoryEntry[]>("SELECT id,url FROM urls WHERE id > ?", id);
	}
}

export class Firefox implements BrowserData {

	private readonly directory: string;

	constructor(directory: string) {
		this.directory = directory;

		if (!statSync(directory).isDirectory()) {
			throw new Error(`${directory} is not a directory`);
		}
	}

	toString() {
		return `Firefox - ${this.directory}`;
	}

	async getHistories(afterBy?: HistoryEntry) {
		const db = await open({
			filename: join(this.directory, "places.sqlite"),
			driver: sqlite3.Database,
			mode: sqlite3.OPEN_READONLY,
		});
		const id = afterBy ? afterBy.id : 0;
		return db.all<HistoryEntry[]>("SELECT id,url FROM moz_places WHERE id > ?", id);
	}
}

export function firefox() {
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
 * Get Edge browser history, only support Edge 79+
 */
export function edge() {
	if (process.platform !== "win32") {
		throw new Error("Unsupported platform: " + process.platform);
	}
	return new Chromium(join(env.LOCALAPPDATA!, "Microsoft/Edge/User Data"));
}

export function chrome() {
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

function silence<T>(fn: () => T) {
	try {
		return fn();
	} catch {
		return undefined;
	}
}

export function findBrowserData() {
	const browsers: Array<() => BrowserData> = [firefox, edge, chrome];
	return browsers.map(silence).filter(Boolean) as BrowserData[];
}
