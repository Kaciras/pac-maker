import analyze from "./command/analyze.js";
import bench from "./command/bench.js";
import generate from "./command/generate.js";
import serve from "./command/serve.js";

export * from "./source.js";
export * from "./generator.js";
export * from "./proxy.js";
export * from "./loader.js";
export * from "./verify.js";

export type { PACMakerConfig } from "./loader.js";

export const commands = { analyze, bench, serve, generate };
