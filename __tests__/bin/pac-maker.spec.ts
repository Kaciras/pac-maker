import { beforeEach, expect, it, jest } from "@jest/globals";
import { fixturePath, useArgvMock } from "../share.js";
import * as indexModule from "../../lib/index.js";

const testCmd = jest.fn();

jest.unstable_mockModule("../lib/index.js", () => ({
	...indexModule,
	commands: { testCmd },
}));

const setArgv = useArgvMock();

beforeEach(() => void jest.resetModules());

it("should fail with unknown command", () => {
	setArgv("foo");
	return expect(import("../../bin/pac-maker.js")).rejects.toThrow(/^Unknown command: foo/);
});

it("should fail if config file cannot load", () => {
	setArgv("testCmd", "--config=_NOE_.js");
	return expect(import("../../bin/pac-maker.js")).rejects.toThrow(/^Cannot find module/);
});

it("should load the config file", async () => {
	const file = fixturePath("test.config.js");
	setArgv("testCmd", `--config=${file}`);

	await import("../../bin/pac-maker.js");

	const [, config] = testCmd.mock.calls[0];
	expect(config).toStrictEqual({
		path: "proxy.pac",
		direct: "DIRECT",
		sources: { "HTTPS [::1]:8080": {} },
	});
});

it("should works", async () => {
	setArgv("testCmd", "--foo", "--bar=baz");

	await import("../../bin/pac-maker.js");

	const [argv, config] = testCmd.mock.calls[0];

	// This property is environment depend, and never used.
	delete (argv as any)["$0"];

	expect(argv).toStrictEqual({
		bar: "baz",
		foo: true,
		_: ["testCmd"],
	});
	expect(config).toBeDefined();
	expect(testCmd).toHaveBeenCalledTimes(1);
});
