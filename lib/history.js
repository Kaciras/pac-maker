import { join } from "path";
import { readFile } from "fs/promises";
import ini from "ini";
import sqlite3 from "sqlite3";
import { open } from "sqlite";

async function getFirefoxProfilePath() {
	let directory;

	switch (process.platform) {
		case "win32":
			directory = join(process.env.APPDATA, "Mozilla/Firefox");
			break;
		case "darwin":
			directory = join(process.env.HOME, "Library/Application Support/Firefox");
			break;
		default:
			throw new Error("Unsupported platform: " + process.platform);
	}

	const content = await readFile(join(directory, "profiles.ini"), "utf8");
	const config = ini.parse(content);

	return config[Object.keys(config).find(s => s.startsWith("Install"))].Default;
}

async function getFromChromiumBased(profilePath, afterBy) {
	const db = await open({
		filename: join(profilePath, "Default/History"),
		driver: sqlite3.Database,
		mode: sqlite3.OPEN_READONLY,
	});
	const id = afterBy ? afterBy.id : 0;
	return db.all("SELECT id,url FROM urls WHERE id > ?", id);
}

/**
 * Get Firefox browser history.
 *
 * @param profile Profile directory, use current user default if not specified.
 * @param afterBy Only fetch rows after this history entry
 * @return {Promise<any[]>} histories
 */
export async function firefox(profile, afterBy) {
	if (!profile) {
		profile = await getFirefoxProfilePath();
	}
	const db = await open({
		filename: join(profile, "places.sqlite"),
		driver: sqlite3.Database,
		mode: sqlite3.OPEN_READONLY,
	});
	const id = afterBy ? afterBy.id : 0;
	return db.all("SELECT id,url FROM moz_places WHERE id > ?", id);
}

/**
 * Get Edge browser history, only support Edge 79+
 *
 * @return {Promise<any[]>} histories
 */
export async function edge(afterBy) {
	if (process.platform !== "win32") {
		throw new Error("Unsupported platform: " + process.platform);
	}
	const profile = join(process.env.LOCALAPPDATA, "Microsoft/Edge/User Data");
	return getFromChromiumBased(profile, afterBy);
}

export async function chrome(afterBy) {
	let profile;
	switch (process.platform) {
		case "win32":
			profile = join(process.env.LOCALAPPDATA, "Google/Chrome/User Data");
			break;
		case "darwin":
			profile = join(process.env.HOME, "Library/Application Support/Google/Chrome");
			break;
		case "linux":
			profile = join(process.env.HOME, ".config/google-chrome");
			break;
		default:
			throw new Error("Unsupported platform: " + process.platform);
	}
	return getFromChromiumBased(profile, afterBy);
}

export async function getAllBrowserHistories() {
	const tasks = await Promise.allSettled([firefox(), edge(), chrome()]);
	return tasks
		.filter(t => t.status === "fulfilled")
		.flatMap(t => t.value);
}
