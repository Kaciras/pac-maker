import { PACMakerConfig } from "./config";
import analyze from "./command/analyze.js";
import generate from "./command/generate.js";
import serve from "./command/serve.js";

export * from "./history.js";
export * from "./source.js";
export * from "./generator.js";

export { PACMakerConfig };

export type Command = (argv: any, config: PACMakerConfig) => Promise<void>;

export const commands: Record<string, Command> = { analyze, serve, generate };
