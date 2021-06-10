import { setTimeout } from "timers/promises";
import { rmSync } from "fs";
import fetch from "node-fetch";
import { ExecaChildProcess } from "execa";
import { getTestSettings, readFixture, runBuiltinCommand } from "./share.js";

const stubPAC = readFixture("proxy-1.pac");

const config = await getTestSettings();

let process: ExecaChildProcess;

afterEach(() => {
	process.kill();
	rmSync(config.path, { force: true });
});

it("should serve PAC file with HTTP", async () => {
	process = runBuiltinCommand("serve");
	await setTimeout(1000);

	const response = await fetch("http://localhost:7568/proxy.pac");
	const code = await response.text();

	expect(code).toBe(stubPAC);
	expect(response.status).toBe(200);
	expect(response.headers.get("content-type")).toBe("application/x-ns-proxy-autoconfig");
});
