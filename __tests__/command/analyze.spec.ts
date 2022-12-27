import { readFileSync } from "fs";
import { join } from "path";
import { expect, it, jest } from "@jest/globals";
import { fixturePath, getTestConfig, readFixture, testDir, useTempDirectory } from "../share.js";

const mockedBrowser = {
	toString: () => "Mocked Borwser",
	getHistories: jest.fn<any>(),
};

jest.unstable_mockModule("../lib/browser.js", () => ({
	findAllBrowsers: () => [mockedBrowser],
}));

useTempDirectory(testDir);

const { default: analyze } = await import("../../lib/command/analyze.js");

it("should works", async () => {
	const config = getTestConfig();
	config.path = fixturePath("proxy-1.pac");
	const json = join(testDir, "test.json");

	mockedBrowser.getHistories.mockResolvedValue([
		{ url: "http://foo.bar/path" },
		{ url: "http://kaciras.com" },
	]);
	await analyze({ json }, config);

	expect(readFileSync(json, "utf8")).toBe(readFixture("matches.json"));
});
