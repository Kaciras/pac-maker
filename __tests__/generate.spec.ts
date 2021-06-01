import { setTimeout } from "timers/promises";
import { readFileSync } from "fs";
import { ExecaChildProcess } from "execa";
import { getTestSettings, readFixture, runBuiltinCommand, testDir, useTempDirectory } from "./share.js";

const stubPac1 = readFixture("proxy-1.pac");
const stubPac2 = readFixture("proxy-2.pac");

const config = await getTestSettings();

let process: ExecaChildProcess;

useTempDirectory(testDir);

afterEach(() => process?.kill());

it("should generate PAC file", async () => {
	await runBuiltinCommand("generate");
	expect(readFileSync(config.path, "utf8")).toBe(stubPac1);
});

it("should rebuild when source have updates", async () => {
	process = runBuiltinCommand("generate", "--watch");
	await setTimeout(1000);

	process.send(["kaciras.com", "foo.bar"]);
	await setTimeout(1000);

	expect(readFileSync(config.path, "utf8")).toBe(stubPac2);
});
