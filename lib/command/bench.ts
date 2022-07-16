import { readFileSync } from "fs";
import { memoryUsage } from "process";
import { performance } from "perf_hooks";
import { fork } from "child_process";
import { fileURLToPath } from "url";
import { loadPAC } from "../loader.js";

declare function gc(): void;

function benchPAC(file: string) {
	console.log(`\nBenchmark for PAC script: ${file}`);
	const code = readFileSync(file, "utf8");

	gc();
	const a = memoryUsage();
	const { FindProxyForURL } = loadPAC(code);
	gc();
	const b = memoryUsage();
	const memory = (b.heapUsed - a.heapUsed) / 1048576;
	console.log(`Memory usage: ${memory.toFixed(2)}MB`);

	const lStart = performance.now();
	for (let i = 0; i < 100; i++) {
		loadPAC(code);
	}
	const loadTime = (performance.now() - lStart) / 100;
	console.log(`Load time: ${loadTime.toFixed(2)}ms`);

	const fStart = performance.now();
	for (let i = 0; i < 1000; i++) {
		FindProxyForURL("", "www.google.com");
	}
	const findTime = (performance.now() - fStart);

	console.log(`Find proxy time: ${findTime.toFixed(2)}μs`);
}

if (process.send) {
	process.argv.slice(2).forEach(benchPAC);
}

export default async function (argv: any) {
	const worker = fork(fileURLToPath(import.meta.url), argv._.slice(1), {
		stdio: "inherit",
		execArgv: ["--expose_gc"],
	});
	return new Promise<void>((resolve, reject) => worker.on("exit", resolve).on("error", reject));
}
