import { appendFileSync, mkdirSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { arraySource, builtinList, gfwlist, hostnameFile } from "../lib/source.js";

// Used to stop watch progress to ensure program exit.
let source;

afterEach(() => source?.stopWatching());

function waitForUpdate(source) {
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
	const tempDir = join(tmpdir(), "pac-maker");

	beforeEach(() => mkdirSync(tempDir, { recursive: true }));
	afterEach(() => rmSync(tempDir, { force: true, recursive: true }));

	it("should throw when file not exists", () => {
		source = hostnameFile("not_exists.txt");
		const task = source.getHostnames();
		return expect(task).rejects.toThrow();
	});

	it("should trigger update on file modified", async () => {
		const file = join(tempDir, "hostnames.txt");
		writeFileSync(file, "example.com\n");

		source = hostnameFile(file);
		const list = await source.getHostnames();
		expect(list).toEqual(["example.com"]);

		const watching = waitForUpdate(source);
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
		source = arraySource(["foo.com", "bar.com"]);
		const hostnames = await source.getHostnames();
		expect(hostnames).toEqual(["foo.com", "bar.com"]);
	});

	it("should trigger update after update() called", async () => {
		source = arraySource(["foo.com", "bar.com"]);

		const watching = waitForUpdate(source);
		source.update([]);

		expect(await watching).toEqual([]);
		expect(await source.getHostnames()).toEqual([]);
	});
});
