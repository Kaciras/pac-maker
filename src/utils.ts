import { mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

/**
 * Path of the pac-maker root directory.
 */
export const root = dirname(import.meta.dirname);

/**
 * Ensures that the file can be created, If the directory that the file located
 * is not exist, this directory is created.
 *
 * @param file The file's path
 */
export function ensureDirectory(file: string) {
	return mkdirSync(dirname(file), { recursive: true });
}

/**
 * Import a JSON file as module from project root directory.
 *
 * Currently, JSON module is experimental:
 * https://nodejs.org/api/esm.html#json-modules
 *
 * @param file file to import
 * @return imported json module
 */
export function importJson(file: string) {
	return JSON.parse(readFileSync(join(root, file), "utf8"));
}
