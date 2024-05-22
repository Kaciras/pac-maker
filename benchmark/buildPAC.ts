import { defineSuite } from "esbench";
import { buildPAC, HostnameListLoader } from "../src/generator.ts";
import blacklist from "../blacklist.config.js";

const loader = await HostnameListLoader.create(blacklist.sources);
await loader.refresh();
const rules = loader.getRules();

export default defineSuite(scene => {
	scene.bench("buildPAC", () => buildPAC(rules));
});
