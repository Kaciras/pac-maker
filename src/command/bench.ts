import { readFileSync } from "fs";
import { memoryUsage } from "process";
import { setFlagsFromString } from "v8";
import { runInNewContext } from "vm";
import { ExecutionTimeMeasurement, Profiler, runSuite, SummaryTable } from "esbench";
import { loadPAC } from "../loader.js";

/**
 * This function is only available with v8 flag --expose_gc.
 */
declare function gc(): void;

/*
 * Expose gc() function to global without any Node arguments.
 * Because --expose-gc cannot be passed through NODE_OPTIONS.
 *
 * Inspired by https://github.com/legraphista/expose-gc, The project
 * missing undo for changed flags, so we implemented it ourselves.
 */
export function exposeGC() {
	setFlagsFromString("--expose_gc");
	global.gc = runInNewContext("gc");
	setFlagsFromString("--no-expose-gc");
}

interface BenchOptions {
	_: string[];
	host?: string;
	workCount?: number;
	loadCount?: number;
}

function getHeapUsageMB() {
	gc();
	return memoryUsage().heapUsed;
}

const memoryUsageProfiler: Profiler = {
	onStart: ctx => ctx.defineMetric({
		key: "Memory usage",
		format: "{dataSize}",
		analysis: 1,
		lowerIsBetter: true,
	}),
	async onCase(ctx, case_, metrics) {
		const before = getHeapUsageMB();
		await case_.invoke();
		metrics["Memory usage"] = getHeapUsageMB() - before;
	},
};

const pacProfiler: Profiler = {
	onStart: ctx => ctx.defineMetric({
		key: "FindProxyForURL",
		format: "{duration.ms}",
		analysis: 2,
		lowerIsBetter: true,
	}),
	async onCase(ctx, case_, metrics) {
		const { FindProxyForURL } = await case_.invoke();
		const { timing, host } = ctx.suite as any;

		const newCase = case_.derive(false, () => FindProxyForURL("", host));
		const measurement = new ExecutionTimeMeasurement(ctx, newCase, timing);
		metrics.FindProxyForURL = await measurement.run();
	},
};

export default async function (options: BenchOptions) {
	const { _, host = "www.google.com", workCount = 1000, loadCount = 100 } = options;
	exposeGC();

	const results = await runSuite({
		profilers: [memoryUsageProfiler, pacProfiler],
		host,
		params: {
			file: _.slice(1),
		},
		timing: {

		},
		setup(scene) {
			const code = readFileSync(scene.params.file, "utf8");
			scene.bench("load", () => loadPAC(code));
		},
	});

	console.log();
	console.log(SummaryTable.from([results]).format({ flexUnit: true }).toMarkdown());
}
