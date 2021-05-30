import { join } from "path";
import { readFileSync } from "fs";
import execa from "execa";
import { getSettings, root } from "../lib/utils.js";
import { MemorySource } from "../lib/source.js";

export const mockTime = new Date(2021, 5, 17, 0, 0, 0, 0);

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

export function readFixture(filename) {
	return readFileSync(fixturePath(filename), "utf8");
}

export const configPath = "__tests__/fixtures/test.config.js";

export function getTestSettings() {
	return getSettings(configPath);
}

export function runBuiltinCommand(name, ...args) {
	return execa.node(`bin/${name}.js`, [
		...args,
		`--config=${configPath}`,
	], {
		cwd: root,
		env: { MOCK_TIME: mockTime.getTime().toString() },
	});
}
