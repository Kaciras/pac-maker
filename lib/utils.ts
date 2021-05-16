import fs from "fs/promises";
import { fileURLToPath } from "url";
import { dirname } from "path";

/** Path of pac-maker root directory */
export const root = dirname(dirname(fileURLToPath(import.meta.url)));

export function ensureDirectory(file: string) {
	return fs.mkdir(dirname(file), { recursive: true });
}
