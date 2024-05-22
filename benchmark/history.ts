import { defineSuite } from "esbench";
import { findFirefox } from "../src/browser.ts";

export default defineSuite(scene => {
	const engine = findFirefox();
	scene.bench("readAll", () => engine.getHistories());
});
