import fs from "fs/promises";
import { ensureDirectory, getSettings, root } from "../lib/utils.js";
import { buildPac, HostnameListLoader } from "../lib/generator.js";

process.chdir(root);

const { path, direct, sources } = await getSettings();

const loader = new HostnameListLoader(sources);
await loader.refresh();
const code = await buildPac(loader.getRules(), direct);

await ensureDirectory(path);
await fs.writeFile(path, code, "utf8");
