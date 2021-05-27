import { join } from "path";
import fs from "fs";
import fetch from "node-fetch";
import execa from "execa";
import { root } from "../lib/utils.js";
import config from "./test.config.js";
import { mockTime } from "./share.js";

const fixture = join(root, "__tests__/fixtures/proxy.pac");
const stubPac = fs.readFileSync(fixture, "utf8");

let commandProcess = null;

afterEach(() => {
	commandProcess?.kill();
	commandProcess = null;
	fs.rmSync(config.path, { force: true });
});

it("should serve PAC script with HTTP", async () => {
	commandProcess = execa("node", [
		"bin/watch.js",
		"--config=__tests__/test.config.js",
	], {
		cwd: root,
		env: { MOCK_TIME: mockTime.getTime().toString() },
	});
	await new Promise(resolve => setTimeout(resolve, 500));

	const response = await fetch("http://localhost:7568/proxy.pac");
	const code = await response.text();

	expect(code).toBe(stubPac);
	expect(response.status).toBe(200);
	expect(response.headers.get("content-type")).toBe("application/x-ns-proxy-autoconfig");
});

it("should save PAC as file when --save is specified", async () => {
	commandProcess = execa("node", [
		"bin/watch.js",
		"--config=__tests__/test.config.js",
		"--save",
	], {
		cwd: root,
		env: { MOCK_TIME: mockTime.getTime().toString() },
	});
	await new Promise(resolve => setTimeout(resolve, 500));

	expect(fs.readFileSync(config.path, "utf8")).toBe(stubPac);
});
