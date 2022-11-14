import { setTimeout } from "timers/promises";
import * as http from "http";
import { afterEach, expect, it } from "@jest/globals";
import { fetch } from "undici";
import { getTestSettings, readFixture, testDir, useTempDirectory } from "../share";
import serve from "../../lib/command/serve.js";

const stubPAC = readFixture("proxy-1.pac");

useTempDirectory(testDir);

let server: http.Server;

afterEach(callback => {
	server?.close(callback);
});

it("should serve PAC file with HTTP", async () => {
	const config = getTestSettings();
	server = await serve({}, config);
	await setTimeout(100);

	const response = await fetch("http://localhost:7568/proxy.pac");
	const code = await response.text();

	expect(code).toBe(stubPAC);
	expect(response.status).toBe(200);
	expect(response.headers.get("content-type")).toBe("application/x-ns-proxy-autoconfig");
});
