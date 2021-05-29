import { appendFileSync, mkdirSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { isIP } from "net";
import { join } from "path";
import { arraySource, builtinList, gfwlist, hostnameFile } from "../lib/source";

// https://stackoverflow.com/a/106223
const hostname = /^(([a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9])\.)*([A-Za-z0-9]|[A-Za-z0-9][A-Za-z0-9-]*[A-Za-z0-9])$/;

expect.extend({
	toBeHostname(received) {
		if (isIP(received) || hostname.test(received)) {
			return {
				pass: true,
				message: () => `${received} is a valid hostname`,
			};
		}
		return {
			pass: false,
			message: () => `${received} is not a hostname`,
		};
	},
});

/**
 * This test may fail with bad network.
 */
it("should parse gfwlist", async () => {
	const list = await gfwlist().getHostnames();

	for (const item of list) {
		expect(item).toBeHostname();
	}
	expect(list.length).toBeGreaterThan(5700);
});

describe("file source", () => {
	const tempDir = join(tmpdir(), "pac-maker");

	beforeAll(() => mkdirSync(tempDir, { recursive: true }));
	afterAll(() => rmSync(tempDir, { force: true }));

	it("should trigger update on file modified", async () => {
		const file = join(tempDir, "hostnames.txt");
		writeFileSync(file, "example.com\n");

		const source = hostnameFile(file);
		const list = await source.getHostnames();
		expect(list).toEqual(["example.com"]);

		const watching = new Promise(resolve => source.watch(resolve));
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
		const source = arraySource(["foo.com", "bar.com"]);
		const hostnames = await source.getHostnames();
		expect(hostnames).toEqual(["foo.com", "bar.com"]);
	});

	it("should trigger update after update() called", async () => {
		const source = arraySource(["foo.com", "bar.com"]);

		const watching = new Promise(resolve => source.watch(resolve));
		source.update([]);

		expect(await watching).toEqual([]);
		expect(await source.getHostnames()).toEqual([]);
	});
});
