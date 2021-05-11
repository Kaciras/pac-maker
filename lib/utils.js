import { join, dirname } from "path";
import { fileURLToPath } from "url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

export function projectFile(path) {
	return join(ROOT, path);
}
