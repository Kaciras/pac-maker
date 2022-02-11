import { mkdir } from "fs/promises";
import { dirname } from "path";
import { fileURLToPath } from "url";

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
