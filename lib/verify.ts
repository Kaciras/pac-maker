import { BlockList, createConnection, IPVersion } from "net";
import { resolve } from "dns/promises";
import { fetch } from "undici";
import { parseProxies } from "./loader.js";
import { createAgent } from "./proxy.js";

const blockedIPs = new BlockList();
blockedIPs.addAddress("223.75.236.241"); // 反诈中心
blockedIPs.addAddress("127.0.0.1");

const TIMEOUT = 3_000;
const CONCURRENCY = 10;

export const blockType = Object.freeze({
	dns: Symbol("DNS cache pollution"),
	tcp: Symbol("TCP resets"),
	unavailable: Symbol("Can't access even with a proxy"),
});

async function connectTCP(host: string) {
	const socket = createConnection({ host, port: 443 });
	socket.setTimeout(TIMEOUT);

	const connected = await new Promise(resolve => {
		socket.on("connect", () => resolve(true));
		socket.on("error", () => resolve(false));
		socket.on("timeout", () => resolve(false));
	});

	const family = socket.remoteFamily as IPVersion;
	const ip = socket.remoteFamily!;

	socket.destroy();
	return connected && !blockedIPs.check(ip, family);
}

const proxy = "SOCKS5 localhost:2080";
const [p] = parseProxies(proxy);
const dispatcher = createAgent(p);

export function verify(hosts: string[]) {
	const iterator = hosts[Symbol.iterator]();
	const blocked: Record<string, symbol> = {};

	async function doVerify(host: string) {
		const [ip] = await resolve(host);
		if (blockedIPs.check(ip)) {
			return blocked[host] = blockType.dns;
		}

		if (await connectTCP(host)) {
			return;
		}

		try {
			await fetch(`"https://${host}`, { dispatcher });
			blocked[host] = blockType.tcp;
		} catch {
			blocked[host] = blockType.unavailable;
		}
	}

	async function run(): Promise<void> {
		const { value, done } = iterator.next();
		if (done) {
			return;
		}
		if (value[0] === "*") {
			return run();
		}
		return doVerify(value).then(run);
	}

	const workers = [];
	for (let i = 0; i < CONCURRENCY; i++) {
		workers[i] = run();
	}
	return Promise.all(workers).then(() => blocked);
}
