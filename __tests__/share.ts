import { tmpdir } from "os";
import { join } from "path";
import { mkdirSync, readFileSync, rmSync } from "fs";
import { afterEach, beforeEach } from "@jest/globals";
import { execaNode } from "execa";
import { root } from "../lib/utils.js";
import { loadConfig } from "../lib/config.js";

export const mockTime = Date.UTC(2021, 5, 17);

/**
 * The temporary directory to save test working data.
 */
export const testDir = join(tmpdir(), "pac-maker");

/**
 * Ensure the directory exists before tests and delete it after.
 *
 * @param path A path to a directory
 */
export function useTempDirectory(path: string) {
	beforeEach(() => {
		mkdirSync(path, { recursive: true });
	});
	afterEach(() => {
		rmSync(path, { force: true, recursive: true });
	});
}

/**
 * Get the absolute path of the fixture file.
 *
 * @param filename file name
 */
export function fixturePath(filename: string) {
	return join(root, "__tests__/fixtures", filename);
}

/**
 * Read test fixture file as string.
 */
export function readFixture(filename: string) {
	return readFileSync(fixturePath(filename), "utf8");
}

const configPath = "__tests__/fixtures/test.config.js";

/**
 * Load settings from fixtures/test.config.js
 */
export function getTestSettings() {
	return loadConfig(configPath);
}

/**
 * Execute the command file located /bin with test config.
 *
 * @param name filename without ext
 * @param args additional arguments
 * @return the process object
 */
export function runCommand(name: string, ...args: string[]) {
	return execaNode("bin/pac-maker.js", [
		name,
		...args,
		`--config=${configPath}`,
	], {
		cwd: root,
		env: { MOCK_TIME: mockTime.toString() },
	});
}
