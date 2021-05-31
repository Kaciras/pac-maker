import { tmpdir } from "os";
import { join } from "path";
import { ofArray } from "../../lib/source.js";
import { ProcessMessageSource } from "../share.js";

export const dir = join(tmpdir(), "pac-maker");

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
