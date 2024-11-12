import { readFileSync } from "node:fs";
import { memoryUsage } from "node:process";
import { exposeGC } from "@kaciras/utilities/node";
import { ExecutionTimeMeasurement, Profiler, runSuite, SummaryTable } from "esbench";
import { loadPAC } from "../loader.js";

/**
 * This function is only available with v8 flag --expose_gc.
 */
declare function gc(): void;

interface BenchOptions {
	_: string[];
	host?: string;
	iterations?: number;
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
		await measurement.run();
		metrics.FindProxyForURL = measurement.values;
	},
};

declare module "esbench" {
	interface BenchmarkSuite {
		host: string;
	}
}

export default async function (options: BenchOptions) {
	const { _, host = "www.google.com", iterations } = options;
	exposeGC();

	const results = await runSuite({
		host,
		profilers: [memoryUsageProfiler, pacProfiler],
		params: {
			file: _.slice(1),
		},
		timing: {
			iterations,
		},
		setup(scene) {
			const code = readFileSync(scene.params.file, "utf8");
			scene.bench("load", () => loadPAC(code));
		},
	});

	const table = SummaryTable.from([results], undefined, { stdDev: false });
	console.log();
	console.log(table.format({ flexUnit: true }).toMarkdown());
}
