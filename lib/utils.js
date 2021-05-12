import fs from "fs/promises";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

export function projectFile(path) {
	return join(ROOT, path);
}

export function ensureDirectory(file) {
	return fs.mkdir(dirname(file), { recursive: true });
}
