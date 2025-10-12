import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it, jest } from "@jest/globals";
import { fixturePath, getTestConfig, readFixture, testDir, useTempDirectory } from "../share.js";

const mockedBrowser = {
	toString: () => "Mocked Borwser",
	getHistories: jest.fn<any>(),
};

const findAllBrowsers = jest.fn(() => [mockedBrowser]);

jest.unstable_mockModule("../../src/browser.js", () => ({ findAllBrowsers }));

useTempDirectory(testDir);

const { default: analyze } = await import("../../src/command/analyze.js");

it("should works", async () => {
	const config = getTestConfig();
	config.path = fixturePath("proxy-1.pac");
	const json = join(testDir, "test.json");

	mockedBrowser.getHistories.mockReturnValue([
		{ url: "file:/foo/bar.html" },
		{ url: "http://foo.bar/path" },
		{ url: "http://kaciras.com" },
	]);
	await analyze({ json }, config);

	expect(readFileSync(json, "utf8")).toBe(readFixture("matches.json"));
});

it("should works with no browsers", async () => {
	findAllBrowsers.mockReturnValueOnce([]);

	await analyze({}, getTestConfig());

	const [message] = (console.info as any).mock.calls.at(-1);
	expect(message).toContain("No browser found in your computer.");
});
