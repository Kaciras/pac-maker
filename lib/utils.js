import fs from "fs/promises";
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
	return fs.mkdir(dirname(file), { recursive: true });
}
