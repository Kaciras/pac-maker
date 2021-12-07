import { readFixture } from "./share";
import { BuiltinPAC, loadPAC } from "../lib/loader";

const stubPAC = readFixture("proxy-1.pac");

describe("loadPAC", () => {
	const functionsStub = readFixture("functions.pac");

	it("should execute script", () => {
		const { fallback, proxies, rules, FindProxyForURL } = loadPAC<BuiltinPAC>(stubPAC);

		expect(proxies).toEqual([
			"HTTP [::1]:2080",
			"SOCKS5 localhost:1080",
		]);
		expect(rules).toEqual({
			"foo.bar": 0,
			"example.com": 1,
		});
		expect(fallback).toBe("DIRECT");

		expect(FindProxyForURL("", "")).toBe("DIRECT");
		expect(FindProxyForURL("", "com")).toBe("DIRECT");
		expect(FindProxyForURL("", "example.com")).toBe("SOCKS5 localhost:1080");
		expect(FindProxyForURL("", "www.example.com")).toBe("SOCKS5 localhost:1080");
	});

	it("should not expose predefined functions", () => {
		const pac = loadPAC<any>(functionsStub);
		expect(pac.dnsDomainLevels).toBeUndefined();
	});

	it("should apply predefined functions", () => {
		const { FindProxyForURL } = loadPAC(functionsStub);
		expect(FindProxyForURL("", "foo.bar")).toBe(1);
		expect(FindProxyForURL("", "foo.bar.baz")).toBe(2);
	});
});
