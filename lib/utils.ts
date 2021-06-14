import { mkdir, readFile } from "fs/promises";
import { fileURLToPath, pathToFileURL, URL } from "url";
import { dirname, resolve } from "path";
import { HostnameSource } from "./source";

/**
 * Path of the pac-maker root directory.
 */
export const root = dirname(dirname(fileURLToPath(import.meta.url)));

export interface PACMakerConfig {

	/** Location of the generated PAC file */
	path: string;

	/** Fallback when no rule matching in source */
	direct: string;

	/**
	 * Proxy source map, the key is a proxy sorting (e.g. SOCKS5 127.0.0.1:1080),
	 * value is an array of HostnameSource.
	 *
	 * pac-maker will get hostnames from all sources in array and map it to the corresponding key.
	 */
	sources: Record<string, HostnameSource[]>;
}

export function getSettings(file?: string) {
	file ??= resolve(root, "pac.config.js");
	const url = pathToFileURL(file).toString();
	return import(url).then<PACMakerConfig>(m => m.default);
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
