import fs from "fs/promises";
import { fileURLToPath } from "url";
import { dirname } from "path";

export const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));

export function ensureDirectory(file) {
	return fs.mkdir(dirname(file), { recursive: true });
}
