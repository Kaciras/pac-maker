import { mkdir, readFile } from "fs/promises";
import { fileURLToPath, pathToFileURL } from "url";
import { dirname, resolve } from "path";

/** Path of pac-maker root directory */
export const root = dirname(dirname(fileURLToPath(import.meta.url)));

export function getSettings(file) {
	file ??= resolve(root, "pac.config.js");
	file = pathToFileURL(file);
	return import(file).then(m => m.default);
}

export function ensureDirectory(file) {
	return mkdir(dirname(file), { recursive: true });
}

/**
 * Import a json file as module from project root directory.
 *
 * Currently json module is experimental:
 * https://nodejs.org/api/esm.html#esm_no_json_module_loading
 *
 * @param file file to import
 * @return {Promise<any>} json module
 */
export async function importJson(file) {
	const url = new URL(file, import.meta.url);
	return JSON.parse(await readFile(url, "utf8"));
}
