import { setTimeout } from "timers/promises";
import * as http from "http";
import { afterEach, expect, it } from "@jest/globals";
import { fetch } from "undici";
import { getTestSettings, readFixture, testDir, useTempDirectory } from "../share";
import serve from "../../lib/command/serve";

const stubPAC = readFixture("proxy-1.pac");
const stubPAC2 = readFixture("proxy-2.pac");

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

it("should rebuild when source have updates", async () => {
	const config = getTestSettings();
	server = await serve({}, config).then();
	await setTimeout(100);

	config.sources["HTTP [::1]:2080"][0].update(["kaciras.com", "foo.bar"]);
	await setTimeout(100);

	const response = await fetch("http://localhost:7568/proxy.pac");
	expect(await response.text()).toBe(stubPAC2);
});
