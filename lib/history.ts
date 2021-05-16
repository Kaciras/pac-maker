import { join } from "path";
import fs from "fs/promises";
import ini from "ini";
import sqlite3 from "sqlite3";
import { open } from "sqlite";

export interface HistoryEntry {
	id: number;
	url: string;
}

async function getFirefoxProfilePath(): Promise<string> {
	let file;

	switch (process.platform) {
		case "win32":
			file = join(process.env.APPDATA!, "Mozilla/Firefox");
			break;
		case "darwin":
			file = join(process.env.HOME!, "Library/Application Support/Firefox");
			break;
		default:
			throw new Error("Unsupported platform: " + process.platform);
	}

	file = join(file, "profiles.ini");
	const content = await fs.readFile(file, "utf8");
	const config = ini.parse(content);

	const install = Object.keys(config).find(s => s.startsWith("Install"));
	if (install) {
		return config[install].Default;
	}
	throw new Error("Can not find install section in profiles.ini.");
}

/**
 * Get Firefox browser history.
 *
 * @param profile Profile directory, if not specific
 * @return histories
 */
export async function firefox(profile?: string) {
	if (!profile) {
		profile = await getFirefoxProfilePath();
	}
	const db = await open({
		filename: join(profile, "places.sqlite"),
		driver: sqlite3.Database,
		mode: sqlite3.OPEN_READONLY,
	});
	return db.all<HistoryEntry>("SELECT id,url FROM moz_places");
}

export async function edge() {
	const profile = join(process.env.LOCALAPPDATA!, "Microsoft/Edge/User Data/Default");
	const db = await open({
		filename: join(profile, "History"),
		driver: sqlite3.Database,
		mode: sqlite3.OPEN_READONLY,
	});
	return db.all<HistoryEntry>("SELECT id,url FROM urls");
}

export async function getAllBrowserHistories() {
	const tasks = await Promise.allSettled([firefox(), edge()]);
	return tasks
		.filter(t => t.status === "fulfilled")
		.flatMap(t => (t as PromiseFulfilledResult<HistoryEntry>).value);
}
