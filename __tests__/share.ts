import { tmpdir } from "os";
import { join } from "path";
import { mkdirSync, readFileSync, rmSync } from "fs";
import execa from "execa";
import { getSettings, root } from "../lib/utils.js";
import { MemorySource } from "../lib/source.js";

export const mockTime = new Date(2021, 5, 17, 0, 0, 0, 0);

/**
 * The temporary directory to save test working data.
 */
export const testDir = join(tmpdir(), "pac-maker");

/**
 * Ensure the directory exists before tests and delete it after.
 *
 * @param path {string} A path to a directory
 */
export function useTempDirectory(path) {
	beforeEach(() => mkdirSync(path, { recursive: true }));
	afterEach(() => rmSync(path, { force: true, recursive: true }));
}

/**
 * Similar to MemorySource but receive updates from process message.
 * Used to trigger update across process.
 */
export class ProcessMessageSource extends MemorySource {

	watch(handler) {
		super.watch(handler);

		if (!this.boundUpdate) {
			this.boundUpdate = this.update.bind(this);
			process.on("message", this.boundUpdate);
		}
	}

	stopWatching() {
		super.stopWatching();
		process.off("message", this.boundUpdate);
	}
}

export function fixturePath(filename) {
	return join(root, "__tests__/fixtures", filename);
}

/**
 * Read test fixture file as string.
 */
export function readFixture(filename) {
	return readFileSync(fixturePath(filename), "utf8");
}

const configPath = "__tests__/fixtures/test.config.js";

/**
 * Load settings from fixtures/test.config.js
 */
export function getTestSettings() {
	return getSettings(configPath);
}

/**
 * Execute the command file located /bin with test config.
 *
 * @param name filename without ext
 * @param args additional arguments
 * @return {execa.ExecaChildProcess} the process object
 */
export function runBuiltinCommand(name, ...args) {
	return execa.node(`bin/${name}.js`, [
		...args,
		`--config=${configPath}`,
	], {
		cwd: root,
		env: { MOCK_TIME: mockTime.getTime().toString() },
	});
}
