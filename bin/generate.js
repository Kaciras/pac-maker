import fs from "fs";
import { ruleFile } from "../lib/source.js";
import { projectFile } from "../lib/utils.js";

const re = /__(.+?)__/g;

async function buildPac(rules) {
	const packageJson = JSON.parse(fs.readFileSync(projectFile("package.json")));

	const replacements = {
		VERSION: packageJson.version,
		RULES: JSON.stringify(rules, "\t"),
		NO_PROXY: JSON.stringify("DIRECT"),
		PROXY: JSON.stringify("localhost:2080"),
		TIME: new Date().toISOString(),
	};

	const file = projectFile("lib/template.js");
	const template = fs.readFileSync(file, { encoding: "UTF8" });
	return template.replaceAll(re, (_, v) => replacements[v]);
}

ruleFile(projectFile("user-rules.txt")).then(buildPac).then(result => {
	fs.writeFileSync("pac.js", result, { encoding: "UTF8" });
});
