import { expect, it } from "@jest/globals";
import { fixturePath } from "./share.js";
import { loadConfig } from "../lib/config.js";

it("should throw error when file not found and required=true", () => {
	const loading = loadConfig("not-exists.js");
	return expect(loading)
		.rejects
		.toThrow(/^Cannot find module/);
});

it("should throw error when load failed", () => {
	const loading = loadConfig(fixturePath("hostnames.txt"));
	return expect(loading)
		.rejects
		.toThrow("Invalid or unexpected token");
});

it("should return the default if file not found and required=false", () => {
	const loading = loadConfig("not-exists.js", false);
	return expect(loading)
		.resolves
		.toStrictEqual({ path: "proxy.pac", fallback: "DIRECT", sources: {} });
});
