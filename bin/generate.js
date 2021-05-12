import fs from "fs";
import { gfwlist, ruleFile } from "../lib/source.js";
import { ensureDirectory, projectFile } from "../lib/utils.js";
import { buildPac } from "../lib/generator.js";

const sources = [
	gfwlist(),
	ruleFile(projectFile("user-rules.txt")),
];

async function getOptions() {
	const results = await Promise.all(sources);
	const domains = results.flat();

	return {
		direct: "DIRECT",
		rules: {
			"SOCKS5 localhost:2080": domains,
		},
	};
}

getOptions().then(buildPac).then(async result => {
	const out = projectFile("dist/proxy.pac");
	await ensureDirectory(out);
	fs.writeFileSync(out, result, { encoding: "UTF8" });
});
