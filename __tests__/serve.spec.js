import { setTimeout } from "timers/promises";
import fs from "fs";
import fetch from "node-fetch";
import { getSettings } from "../lib/utils.js";
import { fixturePath, runBuiltinCommand } from "./share.js";

const configPath = "__tests__/fixtures/test.config.js";

const stubPac = fs.readFileSync(fixturePath("proxy.pac"), "utf8");

let config;
let process = null;

beforeAll(async () => {
	config = await getSettings(configPath);
});

afterEach(() => {
	process.kill();
	fs.rmSync(config.path, { force: true });
});

it("should serve PAC script with HTTP", async () => {
	process = runBuiltinCommand("serve");
	await setTimeout(1000);

	const response = await fetch("http://localhost:7568/proxy.pac");
	const code = await response.text();

	expect(code).toBe(stubPac);
	expect(response.status).toBe(200);
	expect(response.headers.get("content-type")).toBe("application/x-ns-proxy-autoconfig");
});
