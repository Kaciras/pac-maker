import { mkdir, readFile } from "fs/promises";
import { fileURLToPath, pathToFileURL, URL } from "url";
import { dirname, resolve } from "path";
import { HostnameSource } from "./source";

/** Path of pac-maker root directory */
export const root = dirname(dirname(fileURLToPath(import.meta.url)));

export interface PacMakerConfig {
	path: string;
	direct: string;
	sources: Record<string, HostnameSource[]>;
}

export function getSettings(file?: string) {
	file ??= resolve(root, "pac.config.js");
	const url = pathToFileURL(file).toString();
	return import(url).then<PacMakerConfig>(m => m.default);
}

export function ensureDirectory(file: string) {
	return mkdir(dirname(file), { recursive: true });
}

/**
 * Import a json file as module from project root directory.
 *
 * Currently json module is experimental:
 * https://nodejs.org/api/esm.html#esm_no_json_module_loading
 *
 * @param file file to import
 * @return imported json module
 */
export async function importJson(file: string) {
	const url = new URL(file, import.meta.url);
	return JSON.parse(await readFile(url, "utf8"));
}
