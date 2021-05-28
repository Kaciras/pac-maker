import { join } from "path";
import { setTimeout } from "timers/promises";
import fs from "fs";
import fetch from "node-fetch";
import execa from "execa";
import { getSettings, root } from "../lib/utils.js";
import { mockTime } from "./share.js";

const configPath = "__tests__/fixtures/test.config.js";

const fixture = join(root, "__tests__/fixtures/proxy.pac");
const stubPac = fs.readFileSync(fixture, "utf8");

let config;
let commandProcess = null;

beforeAll(async () => {
	config = await getSettings(configPath);
});

afterEach(() => {
	commandProcess?.kill();
	commandProcess = null;
	fs.rmSync(config.path, { force: true });
});

/**
 * run watch command with test config, and wait a while.
 *
 * @return {Promise<*>} A Promise to wait for command initialization.
 */
function runWatchCommand(...args) {
	commandProcess = execa("node", [
		"bin/watch.js",
		`--config=${configPath}`,
		...args,
	], {
		cwd: root,
		env: { MOCK_TIME: mockTime.getTime().toString() },
	});
	return setTimeout(1000, commandProcess);
}

it("should serve PAC script with HTTP", async () => {
	await runWatchCommand();

	const response = await fetch("http://localhost:7568/proxy.pac");
	const code = await response.text();

	expect(code).toBe(stubPac);
	expect(response.status).toBe(200);
	expect(response.headers.get("content-type")).toBe("application/x-ns-proxy-autoconfig");
});

it("should save PAC as file when --save is specified", async () => {
	await runWatchCommand("--save");
	expect(fs.readFileSync(config.path, "utf8")).toBe(stubPac);
});
