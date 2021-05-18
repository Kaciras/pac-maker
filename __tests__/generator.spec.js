import { join } from "path";
import fs from "fs";
import { jest } from "@jest/globals";
import { buildPac, loadPac } from "../lib/generator.js";
import { root } from "../lib/utils";

jest.useFakeTimers("modern");
jest.setSystemTime(new Date(2021, 5, 17, 0, 0, 0, 0));

const fixture = join(root, "__tests__/fixtures/proxy.pac");
const stubPac = fs.readFileSync(fixture, "utf8");

it("should load PAC script", () => {
	const { direct, proxies, rules, FindProxyForURL } = loadPac(stubPac);

	expect(proxies).toEqual([
		"HTTP [::1]:2080",
		"SOCKS5 localhost:1080",
	]);
	expect(rules).toEqual({
		"foo.bar": 0,
		"example.com": 1,
	});
	expect(direct).toBe("DIRECT");

	expect(FindProxyForURL("", "")).toBe("DIRECT");
	expect(FindProxyForURL("", "com")).toBe("DIRECT");
	expect(FindProxyForURL("", "example.com")).toBe("SOCKS5 localhost:1080");
	expect(FindProxyForURL("", "www.example.com")).toBe("SOCKS5 localhost:1080");
});

it("should build PAC script", async () => {
	const code = await buildPac({
		"HTTP [::1]:2080": ["foo.bar"],
		"SOCKS5 localhost:1080": ["example.com"],
	});
	expect(code).toBe(stubPac);
});
