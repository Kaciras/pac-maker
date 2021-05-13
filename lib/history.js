import { join } from "path";
import fs from "fs/promises";
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

	const content = await fs.readFile(join(directory, "profiles.ini"), "utf8");
	const config = ini.parse(content);

	return config[Object.keys(config).find(s => s.startsWith("Install"))].Default;
}

export async function firefox(profile) {
	if (!profile) {
		profile = await getFirefoxProfilePath();
	}
	const db = await open({
		filename: join(profile, "places.sqlite"),
		driver: sqlite3.Database,
		mode: sqlite3.OPEN_READONLY,
	});
	return await db.all("SELECT id,url,title,last_visit_date FROM moz_places");
}
