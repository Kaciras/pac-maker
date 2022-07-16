import { readFileSync } from "fs";
import { memoryUsage } from "process";
import { performance } from "perf_hooks";
import { fork } from "child_process";
import { fileURLToPath } from "url";
import { loadPAC } from "../loader.js";

/**
 * This function is only available with node option --expose_gc.
 */
declare function gc(): void;

interface CliOptions {
	_: string[];
}

const LOAD_ITER = 100;
const FIND_ITER = 1000;

/**
 * Get memory used of current process in MB.
 */
function getHeapUsageMB() {
	gc();
	return memoryUsage().heapUsed / 1048576;
}

function benchPAC(file: string) {
	console.log(`\nBenchmark result for PAC script: ${file}`);
	const code = readFileSync(file, "utf8");

	const before = getHeapUsageMB();
	const { FindProxyForURL } = loadPAC(code);
	const memory = getHeapUsageMB() - before;
	console.log(`Memory usage: ${memory.toFixed(2)} MB`);

	const lStart = performance.now();
	for (let i = 0; i < LOAD_ITER; i++) {
		loadPAC(code);
	}
	const loadTime = (performance.now() - lStart) / LOAD_ITER;
	console.log(`Load time: ${loadTime.toFixed(2)} ms`);

	const fStart = performance.now();
	for (let i = 0; i < FIND_ITER; i++) {
		FindProxyForURL("", "www.google.com");
	}
	const findTime = (performance.now() - fStart) / FIND_ITER * 1000;

	console.log(`Find proxy time: ${findTime.toFixed(2)} μs/op`);
}

if (process.send) {
	process.argv.slice(2).forEach(benchPAC);
}

export default async function (argv: CliOptions) {
	const worker = fork(fileURLToPath(import.meta.url), argv._.slice(1), {
		stdio: "inherit",
		execArgv: ["--expose_gc"],
	});
	return new Promise<void>((resolve, reject) => worker.on("exit", resolve).on("error", reject));
}
