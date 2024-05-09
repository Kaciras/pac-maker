import { appendFileSync, writeFileSync } from "fs";
import { join } from "path";
import { setTimeout } from "timers/promises";
import { MockAgent } from "undici";
import { afterAll, afterEach, describe, expect, it, jest } from "@jest/globals";
import {
	builtinList,
	DnsmasqLists,
	gfwlist,
	hostnameFile,
	HostnameSource,
	MemorySource,
	ofArray,
} from "../src/source.js";
import { fixturePath, readFixture, testDir, useTempDirectory } from "./share.js";

// Used to stop watch progress to ensure program exit.
let source: HostnameSource;

afterEach(() => source?.stopWatching());

function waitForUpdate() {
	return new Promise(resolve => source.watch(resolve));
}

function mockForTimeout() {
	const callback = jest.fn();
	jest.useFakeTimers();

	async function expectTimeout(ms: number) {
		await jest.advanceTimersByTimeAsync(ms - 1);
		expect(callback).not.toHaveBeenCalled();

		await jest.advanceTimersByTimeAsync(1);
		expect(callback).toHaveBeenCalled();
	}

	return { callback, expectTimeout };
}

describe("gfwlist", () => {
	const dispatcher = new MockAgent();

	dispatcher.get("https://raw.githubusercontent.com")
		.intercept({ path: "/gfwlist/gfwlist/master/gfwlist.txt" })
		.reply(200, readFixture("gfwlist.txt")).persist();

	afterEach(() => void jest.useRealTimers());
	afterAll(() => dispatcher.close());

	it("should check parameter", () => {
		expect(() => gfwlist({ period: 0 })).toThrow("Period cannot be zero or negative");
	});

	it("should get hostnames", async () => {
		source = gfwlist({ dispatcher });
		const hostnames = await source.getHostnames();

		for (const item of hostnames) {
			expect(item).toBeHostname();
		}
		expect(hostnames).toHaveLength(7055);
	});

	it("should pull for source changes", () => {
		const mock = mockForTimeout();

		source = gfwlist();
		source.getHostnames = () => {
			(source as any).lastModified = new Date();
			return Promise.resolve([]);
		};
		source.watch(mock.callback);

		return mock.expectTimeout(21600_000);
	});

	it("should support set period", () => {
		const mock = mockForTimeout();

		source = gfwlist({ period: 8964 });
		source.getHostnames = () => {
			(source as any).lastModified = new Date();
			return Promise.resolve([]);
		};
		source.watch(mock.callback);

		return mock.expectTimeout(8964_000);
	});

	it("should not trigger update if no changes", async () => {
		const listener = jest.fn();
		source = gfwlist({ period: 1, dispatcher });
		await source.getHostnames();

		source.watch(listener);
		await setTimeout(1001);

		expect(listener).not.toHaveBeenCalled();
	});
});

describe("DnsmasqLists", () => {
	const dispatcher = new MockAgent();

	dispatcher.get("https://raw.githubusercontent.com")
		.intercept({ path: "/felixonmars/dnsmasq-china-list/master/accelerated-domains.china.conf" })
		.reply(200, readFixture("dnsmasq.txt"));

	dispatcher.get("https://api.github.com")
		.intercept({ path: "/repos/felixonmars/dnsmasq-china-list/commits" })
		.reply(200, readFixture("commits.json"));

	afterAll(() => dispatcher.close());

	it("should get hostnames", async () => {
		source = new DnsmasqLists("accelerated-domains", { dispatcher });
		const hostnames = await source.getHostnames();

		expect(hostnames).toHaveLength(65042);
		expect(hostnames).toContain("cn");
		expect(hostnames).toContain("baidupcs.com");
	});

	it("should check for updates", async () => {
		const listener = jest.fn();
		source = new DnsmasqLists("accelerated-domains", { dispatcher });
		source.watch(listener);
		source.getHostnames = jest.fn(async () => []);

		await (source as DnsmasqLists).checkUpdate();
		await (source as DnsmasqLists).checkUpdate();

		expect(listener).toHaveBeenCalledTimes(1);
		expect(source.getHostnames).toHaveBeenCalledTimes(1);
	});
});

describe("file source", () => {
	useTempDirectory(testDir);

	it("should throw when file not exists", () => {
		source = hostnameFile("not_exists.txt");
		const task = source.getHostnames();
		return expect(task).rejects.toThrow();
	});

	it("should parse the file", async () => {
		source = hostnameFile(fixturePath("hostnames.txt"));
		const list = await source.getHostnames();
		expect(list).toEqual(["foo.com", "bar.com"]);
	});

	it("should trigger update on file modified", async () => {
		const file = join(testDir, "hostnames.txt");
		writeFileSync(file, "foo.com");
		source = hostnameFile(file);

		const watching = waitForUpdate();
		appendFileSync(file, "\nbar.com");

		expect(await watching).toEqual(["foo.com", "bar.com"]);
	});
});

describe("built-in source", () => {

	it("should load hostnames", async () => {
		const list = await builtinList("forbidden").getHostnames();
		expect(list).not.toContain("");
		expect(list).toContain("www.tianshie.com");
	});

	it("should failed with invalid name", async () => {
		expect(() => builtinList("../default"))
			.toThrow("Invalid list name: ../default");
	});
});

describe("array source", () => {

	it("should create from hostnames", async () => {
		source = ofArray(["foo.com", "bar.com"]);
		const hostnames = await source.getHostnames();
		expect(hostnames).toEqual(["foo.com", "bar.com"]);
	});

	it("should trigger update when update() called", async () => {
		source = ofArray(["foo.com", "bar.com"]);

		const watching = waitForUpdate();
		(source as MemorySource).update([]);

		expect(await watching).toEqual([]);
		expect(await source.getHostnames()).toEqual([]);
	});

	it("should remove listeners when stop watching", () => {
		const listener = jest.fn();
		source = ofArray(["foo.com", "bar.com"]);
		source.watch(listener);

		source.stopWatching();
		(source as MemorySource).update([]);

		expect(listener).not.toHaveBeenCalled();
	});
});
