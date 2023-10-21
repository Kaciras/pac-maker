import { EventEmitter } from "events";
import { expect, it, jest } from "@jest/globals";
import { autoRestoreProcessEnv, fixturePath, useArgvMock } from "../share.js";

const fork = jest.fn<any>(() => new EventEmitter());
jest.unstable_mockModule("child_process", () => ({ fork }));

autoRestoreProcessEnv();

const setArgv = useArgvMock();

function assertMetrics(line: string, low: number, high: number) {
	const [, numbers] = /: ([0-9.]+) /.exec(line)!;
	const actual = parseFloat(numbers);
	expect(actual).toBeLessThanOrEqual(high);
	expect(actual).toBeGreaterThanOrEqual(low);
}

it("should start the worker", async () => {
	const bench = await import("../../lib/command/bench.ts");

	// noinspection ES6MissingAwait
	bench.default({
		workCount: 200,
		_: ["", "foo.pac", "bar.pac"],
	});

	const [benchJs, args, options] = fork.mock.calls[0];
	expect(benchJs).toMatch(/bench\.ts$/);
	expect(options).toStrictEqual({
		env: {
			HOST: "www.google.com",
			LOAD_COUNT: "100",
			WORK_COUNT: "200",
			BENCHMARK_WORKER: "true",
		},
		stdio: "inherit",
		execArgv: ["--expose_gc"],
	});
	expect(args).toStrictEqual(["foo.pac", "bar.pac"]);
});

it("should benchmark PACs", async () => {
	jest.resetModules();

	const script = fixturePath("bench.pac.js");
	setArgv(script);
	process.env.BENCHMARK_WORKER = "true";
	process.env.LOAD_COUNT = "100";
	process.env.WORK_COUNT = "200";
	process.env.HOST = "www.google.com";

	await import("../../lib/command/bench.js");

	const [summary, case_, /* mem */, load, find] = (console.log as any).mock.calls as any;
	expect(console.log).toHaveBeenCalledTimes(5);

	expect(summary[0]).toBe("Benchmark 1 PACs (load iterations = 100, work iterations = 200)");
	expect(case_[0]).toBe(`\nResult of PAC script: ${script}`);

	// assertMetrics(mem[0], 0.18, 0.25); Not stable enough.
	assertMetrics(load[0], 7.5, 13);
	assertMetrics(find[0], 4980, 5020);
});
