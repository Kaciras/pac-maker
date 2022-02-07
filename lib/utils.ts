import { mkdir, readFile } from "fs/promises";
import { dirname } from "path";
import { fileURLToPath, URL } from "url";

/**
 * Path of the pac-maker root directory.
 */
export const root = dirname(dirname(fileURLToPath(import.meta.url)));

/**
 * Ensures that the file can be created, If the directory that the file located
 * is not exist, this directory is created.
 *
 * @param file The file's path
 */
export function ensureDirectory(file: string) {
	return mkdir(dirname(file), { recursive: true });
}

/**
 * Import a JSON file as module from project root directory.
 *
 * Currently, JSON module is experimental:
 * https://nodejs.org/api/esm.html#esm_no_json_module_loading
 *
 * @param file file to import
 * @return imported json module
 */
export async function importJson(file: string) {
	const url = new URL(file, import.meta.url);
	return JSON.parse(await readFile(url, "utf8"));
}
