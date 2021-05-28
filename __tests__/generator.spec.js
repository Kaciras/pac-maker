import { join } from "path";
import fs from "fs";
import { jest } from "@jest/globals";
import { buildPac, HostnameListLoader, loadPac } from "../lib/generator.js";
import { root } from "../lib/utils";
import { arraySource } from "../lib/source.js";
import { mockTime } from "./share.js";

jest.useFakeTimers();
jest.setSystemTime(mockTime);

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

describe("HostnameListLoader", () => {

	it("should throw when call method before initialized", () => {
		const loader = new HostnameListLoader({
			foo: [arraySource([])],
		});
		expect(() => loader.getRules()).toThrow();
		expect(() => loader.watch(() => {})).toThrow();
	});

	it("should allow empty sources", () => {
		const loader = new HostnameListLoader({});
		loader.watch(() => {});
		expect(loader.getRules()).toEqual({});
	});

	it("should load rules", async () => {
		const loader = new HostnameListLoader({
			foo: [
				arraySource(["example.com"]),
			],
			bar: [
				arraySource(["alice.com"]),
				arraySource(["bob.com", "charlie.com"]),
			],
		});

		await loader.refresh();
		const rules = loader.getRules();

		expect(rules).toEqual({
			foo: ["example.com"],
			bar: ["alice.com", "bob.com", "charlie.com"],
		});
	});

	it("should watch source updates", async () => {
		const source = arraySource(["kaciras.com"]);
		const loader = new HostnameListLoader({ foo: [source] });
		await loader.refresh();

		const handler = jest.fn();
		loader.watch(handler);

		source.update(["example.com"]);
		expect(handler).toHaveBeenCalledTimes(1);
		expect(loader.getRules()).toEqual({ foo: ["example.com"] });
	});

	it("should cache fetched results", async () => {
		const source = arraySource(["foobar.com"]);
		const noChange = arraySource(["kaciras.com"]);
		const loader = new HostnameListLoader({
			foo: [source],
			bar: [noChange],
		});

		await loader.refresh();
		noChange.getHostnames = jest.fn();
		loader.watch(() => {});
		source.update(["example.com"]);

		expect(loader.getRules()).toEqual({
			foo: ["example.com"],
			bar: ["kaciras.com"],
		});
		expect(noChange.getHostnames).not.toHaveBeenCalled();
	});
});
