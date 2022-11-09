import { describe, expect, it } from "@jest/globals";
import { readFixture } from "./share";
import { BuiltinPAC, loadPAC, parseProxies } from "../lib/loader";

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

	it("should terminating execution when timeout exceed", () => {
		expect(() => loadPAC("while(true){}", 100))
			.toThrow("Script execution timed out after 100ms");
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

describe("parseProxies", () => {

	it("should return empty array if value is empty", () => {
		expect(parseProxies("")).toStrictEqual([]);
		expect(parseProxies(";;;")).toStrictEqual([]);
	});

	it.each([
		["HTTP [not IPv6]:1080"],
		["+HTTP [::1]:1080"],
		["HTTP [::1]:1080foobar"],
		["PROXY"],
		["HTTP [::1]"],
		["HTTP :1080"],
		["HTTP [::1]:foobar"],
		["localhost:1080"],
	])("should fail with %s", (value) => {
		expect(() => parseProxies(value)).toThrow();
	});

	it.each([
		[
			"PROXY localhost:80",
			{
				protocol: "PROXY",
				host: "localhost:80",
				port: 80,
				hostname: "localhost",
			},
		],
		[
			"PROXY foo.bar:80;",
			{
				protocol: "PROXY",
				host: "foo.bar:80",
				port: 80,
				hostname: "foo.bar",
			},
		],
		[
			"DIRECT",
			{
				protocol: "DIRECT",
				host: "",
				port: NaN,
				hostname: "",
			},
		],
		[
			"SOCKS [::1]:1080",
			{
				protocol: "SOCKS",
				host: "[::1]:1080",
				port: 1080,
				hostname: "[::1]",
			},
		],
		[
			"\tSOCKS \t [::1]:80  ",
			{
				protocol: "SOCKS",
				host: "[::1]:80",
				port: 80,
				hostname: "[::1]",
			},
		],
	])("should parse %s", (value, expected) => {
		expect(parseProxies(value)).toStrictEqual([expected]);
	});
});
