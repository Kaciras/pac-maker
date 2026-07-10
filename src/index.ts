import analyze from "./command/analyze.ts";
import bench from "./command/bench.ts";
import generate from "./command/generate.ts";
import serve from "./command/serve.ts";

export * from "./source.ts";
export * from "./generator.ts";
export * from "./proxy.ts";
export * from "./loader.ts";
export * from "./verify.ts";

export const commands = { analyze, bench, serve, generate };
