import { appendFileSync, writeFileSync } from "fs";
import { join } from "path";
import { MockAgent } from "undici";
import { afterEach, describe, expect, it, jest } from "@jest/globals";
import { builtinList, DnsmasqLists, gfwlist, hostnameFile, HostnameSource, MemorySource, ofArray } from "../lib/source";
import { fixturePath, readFixture, testDir, useTempDirectory } from "./share";

// Used to stop watch progress to ensure program exit.
let source: HostnameSource;

afterEach(() => source?.stopWatching());

function waitForUpdate() {
	return new Promise(resolve => source.watch(resolve));
}

describe("gfwlist", () => {
	const dispatcher = new MockAgent();

	dispatcher.get("https://raw.githubusercontent.com")
		.intercept({ path: "/gfwlist/gfwlist/master/gfwlist.txt" })
		.reply(200, readFixture("gfwlist.txt"));

	afterEach(() => dispatcher.close());

	it("should check parameter", () => {
		expect(() => gfwlist({ period: 0 }))
			.toThrow("Period cannot be zero or negative");
	});

	it("should get hostnames", async () => {
		const source = gfwlist({ dispatcher });
		const hostnames = await source.getHostnames();

		for (const item of hostnames) {
			expect(item).toBeHostname();
		}
		expect(hostnames).toHaveLength(7055);
	});
});

describe("DnsmasqLists", () => {

	it("should get hostnames", async () => {
		const source = new DnsmasqLists("accelerated-domains");
		const hostnames = await source.getHostnames();

		expect(hostnames.length).toBeGreaterThan(60000);
		expect(hostnames).toContain("cn");
		expect(hostnames).toContain("baidupcs.com");
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
