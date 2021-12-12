import { setTimeout } from "timers/promises";
import { readFileSync } from "fs";
import { ExecaChildProcess } from "execa";
import { getTestSettings, readFixture, runCommand, testDir, useTempDirectory } from "../share";

const stubPAC1 = readFixture("proxy-1.pac");
const stubPAC2 = readFixture("proxy-2.pac");

const config = await getTestSettings();

let process: ExecaChildProcess;

useTempDirectory(testDir);

afterEach(() => process?.kill());

it("should generate PAC file", async () => {
	await runCommand("generate");
	expect(readFileSync(config.path, "utf8")).toBe(stubPAC1);
});

it("should rebuild when source have updates", async () => {
	process = runCommand("generate", "--watch");
	await setTimeout(1000);

	process.send(["kaciras.com", "foo.bar"]);
	await setTimeout(1000);

	expect(readFileSync(config.path, "utf8")).toBe(stubPAC2);
});
