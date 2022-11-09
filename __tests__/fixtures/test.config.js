import { tmpdir } from "os";
import { join } from "path";
import { MemorySource, ofArray } from "../../lib/source.js";

export const dir = join(tmpdir(), "pac-maker");

/**
 * Similar to MemorySource but receive updates from process message.
 * Used to trigger update across process.
 */
export class ProcessMessageSource extends MemorySource {

	watch(handler) {
		super.watch(handler);

		if (!this.boundUpdate) {
			this.boundUpdate = this.update.bind(this);
			process.on("message", this.boundUpdate);
		}
	}

	stopWatching() {
		super.stopWatching();
		process.off("message", this.boundUpdate);
	}
}

export default {
	path: join(dir, "proxy.pac"),
	direct: "DIRECT",
	sources: {
		"HTTP [::1]:2080": [
			new ProcessMessageSource(["foo.bar"]),
		],
		"SOCKS5 localhost:1080": [
			ofArray(["example.com"]),
		],
	},
};
