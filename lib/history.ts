import { join } from "path";
import { readFile } from "fs/promises";
import ini from "ini";
import sqlite3 from "sqlite3";
import { open } from "sqlite";

export interface HistoryEntry {
	id: number;
	url: string;
}

async function getFirefoxProfilePath(): Promise<string> {
	const { platform, env } = process;
	let directory;

	switch (platform) {
		case "win32":
			directory = join(env.APPDATA!, "Mozilla/Firefox");
			break;
		case "darwin":
			directory = join(env.HOME!, "Library/Application Support/Firefox");
			break;
		default:
			throw new Error("Unsupported platform: " + platform);
	}

	const file = join(directory, "profiles.ini");
	const config = ini.parse(await readFile(file, "utf8"));

	const install = Object.keys(config).find(s => s.startsWith("Install"));
	if (install) {
		return config[install].Default;
	}
	throw new Error("Can not find [Install*] section in profiles.ini");
}

async function getFromChromiumBased(profile: string, afterBy?: HistoryEntry) {
	const db = await open({
		filename: join(profile, "Default/History"),
		driver: sqlite3.Database,
		mode: sqlite3.OPEN_READONLY,
	});
	const id = afterBy ? afterBy.id : 0;
	return db.all<HistoryEntry[]>("SELECT id,url FROM urls WHERE id > ?", id);
}

/**
 * Get Firefox browser history.
 *
 * @param profile Profile directory, use current user default if not specified.
 * @param afterBy Only fetch rows after this history entry
 */
export async function firefox(profile?: string, afterBy?: HistoryEntry) {
	if (!profile) {
		profile = await getFirefoxProfilePath();
	}
	const db = await open({
		filename: join(profile, "places.sqlite"),
		driver: sqlite3.Database,
		mode: sqlite3.OPEN_READONLY,
	});
	const id = afterBy ? afterBy.id : 0;
	return db.all<HistoryEntry[]>("SELECT id,url FROM moz_places WHERE id > ?", id);
}

/**
 * Get Edge browser history, only support Edge 79+
 */
export async function edge(afterBy?: HistoryEntry) {
	if (process.platform !== "win32") {
		throw new Error("Unsupported platform: " + process.platform);
	}
	const profile = join(process.env.LOCALAPPDATA!, "Microsoft/Edge/User Data");
	return getFromChromiumBased(profile, afterBy);
}

export async function chrome(afterBy?: HistoryEntry) {
	const { platform, env } = process;
	let profile;

	switch (platform) {
		case "win32":
			profile = join(env.LOCALAPPDATA!, "Google/Chrome/User Data");
			break;
		case "linux":
			profile = join(env.HOME!, ".config/google-chrome");
			break;
		case "darwin":
			profile = join(env.HOME!, "Library/Application Support/Google/Chrome");
			break;
		default:
			throw new Error("Unsupported platform: " + platform);
	}

	return getFromChromiumBased(profile, afterBy);
}

export async function getAllBrowserHistories() {
	const tasks = await Promise.allSettled([firefox(), edge(), chrome()]);
	return tasks
		.filter(t => t.status === "fulfilled")
		.flatMap(t => (t as PromiseFulfilledResult<HistoryEntry[]>).value);
}
