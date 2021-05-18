import fs from "fs/promises";
import { ensureDirectory, getSettings, root } from "../lib/utils.js";
import { buildPac, getAllRules } from "../lib/generator.js";

process.chdir(root);

const { path, direct, sources } = await getSettings();

const rules = await getAllRules(sources);
const code = await buildPac(rules, direct);

await ensureDirectory(path);
await fs.writeFile(path, code, "utf8");
