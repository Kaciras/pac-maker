import { tmpdir } from "os";
import { join } from "path";
import { MemoryHostnameSource } from "../../lib/source.js";

export default {
	path: join(tmpdir(), "pac-maker/proxy.pac"),
	direct: "DIRECT",
	sources: {
		"HTTP [::1]:2080": [
			new MemoryHostnameSource(["foo.bar"]),
		],
		"SOCKS5 localhost:1080": [
			new MemoryHostnameSource(["example.com"]),
		],
	},
};
