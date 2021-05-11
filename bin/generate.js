import fs from "fs";
import { ruleFile } from "../lib/source.js";
import { ensureDirectory, projectFile } from "../lib/utils.js";
import { buildPac } from "../lib/generator.js";

ruleFile(projectFile("user-rules.txt")).then(buildPac).then(async result => {
	const out = projectFile("dist/pac.js");
	await ensureDirectory(out);
	fs.writeFileSync(out, result, { encoding: "UTF8" });
});
