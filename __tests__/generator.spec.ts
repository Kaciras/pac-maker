import { jest } from "@jest/globals";
import { buildPAC, HostnameListLoader } from "../lib/generator";
import { ofArray } from "../lib/source";
import { mockTime, readFixture } from "./share";

jest.useFakeTimers();
jest.setSystemTime(mockTime);

const stubPAC = readFixture("proxy-1.pac");

describe("buildPAC", () => {

	it("should return PAC script", async () => {
		const code = await buildPAC({
			"HTTP [::1]:2080": ["foo.bar"],
			"SOCKS5 localhost:1080": ["example.com"],
		});
		expect(code).toBe(stubPAC);
	});
});

describe("HostnameListLoader", () => {

	it("should throw when call method before initialized", () => {
		const loader = new HostnameListLoader({
			foo: [ofArray([])],
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
				ofArray(["example.com"]),
			],
			bar: [
				ofArray(["alice.com"]),
				ofArray(["bob.com", "charlie.com"]),
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
		const source = ofArray(["kaciras.com"]);
		const loader = new HostnameListLoader({ foo: [source] });
		await loader.refresh();

		const handler = jest.fn();
		loader.watch(handler);

		source.update(["example.com"]);
		expect(handler).toHaveBeenCalledTimes(1);
		expect(loader.getRules()).toEqual({ foo: ["example.com"] });
	});

	it("should cache fetched results", async () => {
		const source = ofArray(["foobar.com"]);
		const noChange = ofArray(["kaciras.com"]);
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
