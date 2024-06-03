import { expect, it } from "@jest/globals";
import { fixturePath } from "../share.js";

function assertMetrics(line: string, unit: string, low: number, high: number) {
	const [, n, u] = /([0-9.]+) (\w+)/.exec(line)!;
	const actual = parseFloat(n);
	expect(u).toBe(unit);
	expect(actual).toBeLessThanOrEqual(high);
	expect(actual).toBeGreaterThanOrEqual(low);
}

function parseRow(row: string) {
	return row.split("|").map(value => value.trim()).filter(Boolean);
}

it("should works", async () => {
	const bench = await import("../../src/command/bench.ts");

	const script = fixturePath("bench.pac.js");
	await bench.default({ iterations: 1, _: ["", script] });

	const [table] = (console.log as any).mock.calls.at(-1);
	const [header, , row1] = table.split("\n") as string[];
	expect(parseRow(header)).toStrictEqual(["No.", "Name", "time", "Memory usage", "FindProxyForURL"]);

	// Memory is not stable enough.
	const [,name,load,,findURL] = parseRow(row1);
	expect(name).toBe("load");
	assertMetrics(load, "ms", 9.5, 13);
	assertMetrics(findURL, "ms", 4.98, 5.03);
});
