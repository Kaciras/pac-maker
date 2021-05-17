import { join } from "path";
import fs from "fs";
import { jest } from "@jest/globals";
import { buildPac, loadPac } from "../lib/generator.js";
import { root } from "../lib/utils";

jest.useFakeTimers("modern");
jest.setSystemTime(new Date(2021, 5, 17, 0, 0, 0, 0));

const fixtures = join(root, "__tests__/fixtures");
const stubPac = fs.readFileSync(join(fixtures, "proxy.pac"), "utf8");

it("should load PAC script", () => {
	const { direct, proxies, rules, FindProxyForURL } = loadPac(stubPac);

	expect(direct).toBe("DIRECT");
	expect(proxies).toEqual(["SOCKS5 localhost:1080"]);
	expect(rules).toEqual({ "example.com": 0 });

	expect(FindProxyForURL("", "")).toBe("DIRECT");
	expect(FindProxyForURL("", "com")).toBe("DIRECT");
	expect(FindProxyForURL("", "example.com")).toBe("SOCKS5 localhost:1080");
	expect(FindProxyForURL("", "www.example.com")).toBe("SOCKS5 localhost:1080");
});

it("should build PAC script", async () => {
	const code = await buildPac({
		direct: "DIRECT",
		domains: {
			"HTTP [::1]:2080": ["foo.bar"],
			"SOCKS5 localhost:1080": ["example.com"],
		},
	});
	expect(code).toBe(stubPac);
});
