import { tmpdir } from "os";
import { join } from "path";
import { ofArray } from "../../lib/source.js";

export const dir = join(tmpdir(), "pac-maker");

export default {
	path: join(dir, "proxy.pac"),
	direct: "DIRECT",
	sources: {
		"HTTP [::1]:2080": [
			ofArray(["foo.bar"]),
		],
		"SOCKS5 localhost:1080": [
			ofArray(["example.com"]),
		],
	},
};
