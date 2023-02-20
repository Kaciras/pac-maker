import { readFileSync } from "fs";
import { argv, env, memoryUsage } from "process";
import { performance } from "perf_hooks";
import { fork } from "child_process";
import { fileURLToPath } from "url";
import { loadPAC } from "../loader.js";

/**
 * This function is only available with node option --expose_gc.
 */
declare function gc(): void;

interface BenchOptions {
	_: string[];
	host?: string;
	workCount?: number;
	loadCount?: number;
}

/**
 * Get memory used of current process in MB.
 */
function getHeapUsageMB() {
	gc();
	return memoryUsage().heapUsed / 1048576;
}

function benchPAC(file: string, host: string, lCount: number, wCount: number) {
	console.log(`\nResult of PAC script: ${file}`);
	const code = readFileSync(file, "utf8");

	const before = getHeapUsageMB();
	const { FindProxyForURL } = loadPAC(code);
	const memory = getHeapUsageMB() - before;
	console.log(`Memory usage: ${memory.toFixed(2)} MB`);

	const lStart = performance.now();
	for (let i = 0; i < lCount; i++) {
		loadPAC(code);
	}
	const loadTime = (performance.now() - lStart) / lCount;
	console.log(`Load time: ${loadTime.toFixed(2)} ms`);

	const fStart = performance.now();
	for (let i = 0; i < wCount; i++) {
		FindProxyForURL("", "www.google.com");
	}
	const findTime = (performance.now() - fStart) / wCount * 1000;
	console.log(`Find proxy time: ${findTime.toFixed(2)} μs/op`);
}

if (env.BENCHMARK_WORKER === "true") {
	const lCount = parseInt(env.LOAD_COUNT!);
	const wCount = parseInt(env.WORK_COUNT!);

	console.log(`Benchmark ${argv.length - 2} PACs ` +
		`(load iterations = ${lCount}, work iterations = ${wCount})`);
	for (let i = 2; i < argv.length; i++) {
		benchPAC(argv[i], env.HOST!, lCount, wCount);
	}
}

export default async function (options: BenchOptions) {
	const { _, host = "www.google.com", workCount = 1000, loadCount = 100 } = options;
	const worker = fork(fileURLToPath(import.meta.url), _.slice(1), {
		env: {
			BENCHMARK_WORKER: "true",
			HOST: host,
			LOAD_COUNT: loadCount.toString(),
			WORK_COUNT: workCount.toString(),
		},
		stdio: "inherit",
		execArgv: ["--expose_gc"],
	});
	return new Promise<void>((resolve, reject) => worker.on("exit", resolve).on("error", reject));
}
