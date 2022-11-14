import { setTimeout } from "timers/promises";
import { readFileSync } from "fs";
import { expect, it } from "@jest/globals";
import { getTestSettings, readFixture, testDir, useTempDirectory } from "../share";
import generate from "../../lib/command/generate";

const stubPAC1 = readFixture("proxy-1.pac");
const stubPAC2 = readFixture("proxy-2.pac");

useTempDirectory(testDir);

it("should generate PAC file", async () => {
	const config = getTestSettings();
	await generate({}, config);
	expect(readFileSync(config.path, "utf8")).toBe(stubPAC1);
});

it("should rebuild when source have updates", async () => {
	const config = getTestSettings();
	generate({ watch: true }, config).then();
	await setTimeout(100);

	config.sources["HTTP [::1]:2080"][0].update(["kaciras.com", "foo.bar"]);
	await setTimeout(100);

	expect(readFileSync(config.path, "utf8")).toBe(stubPAC2);
});
