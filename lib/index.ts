import type { PACMakerConfig } from "./config.js";

import analyze from "./command/analyze.js";
import bench from "./command/bench.js";
import generate from "./command/generate.js";
import serve from "./command/serve.js";

export * from "./source.js";
export * from "./generator.js";
export * from "./proxy.js";
export * from "./loader.js";

export { PACMakerConfig };

export type Command = (argv: any, config: PACMakerConfig) => Promise<void>;

export const commands: Record<string, Command> = { analyze, bench, serve, generate };
