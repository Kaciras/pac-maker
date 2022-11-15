import { describe, expect, it, jest } from "@jest/globals";
import { buildPAC, HostnameListLoader } from "../lib/generator";
import { ofArray } from "../lib/source";
import { readFixture } from "./share";

const stubPAC = readFixture("proxy-1.pac");

describe("buildPAC", () => {
	const ruleProxy1 = {
		"HTTP [::1]:2080": ["foo.bar"],
		"SOCKS5 localhost:1080": ["example.com"],
	};

	it("should return PAC script", () => {
		expect(buildPAC(ruleProxy1)).toBe(stubPAC);
	});

	it("should throw error on rule conflict", () => {
		const rules = {
			"HTTP [::1]:2080": ["foo.com"],
			"DIRECT": ["foo.com"],
		};
		expect(() => buildPAC(rules)).toThrow("foo.com already exists");
	});

	it("should allow hostname with same proxy", () => {
		const rules = {
			"HTTP [::1]:2080": ["foo.com", "foo.com"],
		};
		expect(() => buildPAC(rules)).not.toThrow();
	});

	it("should throw error if `env.MOCK_TIME` is invalid", () => {
		const backup = process.env.MOCK_TIME;
		process.env.MOCK_TIME = "foobar";
		try {
			expect(() => buildPAC(ruleProxy1)).toThrow("Invalid MOCK_TIME: foobar");
		} finally {
			process.env.MOCK_TIME = backup;
		}
	});

	it("should generate correct time header", () => {
		const backup = process.env.MOCK_TIME;
		delete process.env.MOCK_TIME;
		try {
			const now = new Date().getTime();
			const pac = buildPAC(ruleProxy1);
			const [, v] = / * Generated at: (.+)/.exec(pac)!;

			const tag = new Date(v).getTime();
			expect(tag).toBeGreaterThanOrEqual(now);
		} finally {
			process.env.MOCK_TIME = backup;
		}
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
		noChange.getHostnames = jest.fn<() => Promise<string[]>>();
		loader.watch(() => {});
		source.update(["example.com"]);

		expect(loader.getRules()).toEqual({
			foo: ["example.com"],
			bar: ["kaciras.com"],
		});
		expect(noChange.getHostnames).not.toHaveBeenCalled();
	});
});
