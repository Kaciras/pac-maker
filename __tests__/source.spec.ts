import { appendFileSync, writeFileSync } from "fs";
import { join } from "path";
import { builtinList, gfwlist, hostnameFile, HostnameSource, MemorySource, ofArray } from "../lib/source.js";
import { testDir, useTempDirectory } from "./share.js";

// Used to stop watch progress to ensure program exit.
let source: HostnameSource;

afterEach(() => source?.stopWatching());

function waitForUpdate() {
	return new Promise(resolve => source.watch(resolve));
}

/**
 * This test may fail with bad network. we still waiting for Jest to support mock ES modules.
 */
describe("gfwlist", () => {

	it("should parse rules", async () => {
		const list = await gfwlist().getHostnames();

		for (const item of list) {
			expect(item).toBeHostname();
		}
		expect(list.length).toBeGreaterThan(5700);
	});
});

describe("file source", () => {
	useTempDirectory(testDir);

	it("should throw when file not exists", () => {
		source = hostnameFile("not_exists.txt");
		const task = source.getHostnames();
		return expect(task).rejects.toThrow();
	});

	it("should trigger update on file modified", async () => {
		const file = join(testDir, "hostnames.txt");
		writeFileSync(file, "example.com\n");

		source = hostnameFile(file);
		const list = await source.getHostnames();
		expect(list).toEqual(["example.com"]);

		const watching = waitForUpdate();
		appendFileSync(file, "foobar.com\n");

		expect(await watching).toEqual(["example.com", "foobar.com"]);
	});
});

describe("built-in source", () => {

	it("should load hostnames", async () => {
		const list = await builtinList("forbidden").getHostnames();
		expect(list).not.toContain("");
		expect(list).toContain("www.tianshie.com");
	});

	it("should failed with invalid name", async () => {
		expect(() => builtinList("../default")).toThrow();
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
});