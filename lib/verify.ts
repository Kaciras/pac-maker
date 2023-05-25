import { BlockList, createConnection } from "net";
import { resolve } from "dns/promises";
import { Dispatcher, fetch } from "undici";
import { parseProxies } from "./loader.js";
import { createAgent } from "./proxy.js";

const gfwIPs = new BlockList();
gfwIPs.addAddress("223.75.236.241"); // 反诈中心
gfwIPs.addAddress("127.0.0.1");

export const blockType = Object.freeze({
	dns: Symbol("DNS cache pollution"),
	tcp: Symbol("TCP resets"),
	unavailable: Symbol("Can't access even with a proxy"),
});

function connectTCP(host: string, timeout: number) {
	const socket = createConnection({ host, port: 443 });
	socket.setTimeout(timeout);

	const task = new Promise(resolve => {
		socket.on("connect", () => resolve(true));
		socket.on("error", () => resolve(false));
		socket.on("timeout", () => resolve(false));
	});

	return task.finally(() => socket.destroy());
}

export class HostBlockVerifier {

	private readonly dispatcher: Dispatcher;
	private readonly timeout = 3000;
	private readonly blockedIPs: BlockList;

	constructor(proxy: string, blockedIPs = gfwIPs) {
		this.blockedIPs = blockedIPs;
		const [parsed] = parseProxies(proxy);
		this.dispatcher = createAgent(parsed);
	}

	/**
	 * Test if any hostname is blocked by your ISP.
	 *
	 * @param host The hostname to test.
	 * @return One of `blockType` when it is blocked, otherwise `null`.
	 */
	async verify(host: string) {
		const { dispatcher, blockedIPs, timeout } = this;

		try {
			const [ip] = await resolve(host);
			if (blockedIPs.check(ip)) {
				return blockType.dns;
			}
			if (await connectTCP(host, timeout)) {
				return null;
			}
		} catch {
			return blockType.unavailable;
		}

		try {
			await fetch(`https://${host}`, { dispatcher });
			return blockType.tcp;
		} catch {
			return blockType.unavailable;
		}
	}

	verifyAll(hosts: string[], concurrency = 10) {
		const iterator = hosts[Symbol.iterator]();
		const blocked: Record<string, symbol> = {};

		const run = async (): Promise<void> => {
			const { value, done } = iterator.next();
			if (done) {
				return;
			}
			if (value.charCodeAt(0) === 42 /* '*' */) {
				return run();
			}
			return this.verify(value).then(run);
		};

		const workers = [];
		for (let i = 0; i < concurrency; i++) {
			workers[i] = run();
		}
		return Promise.all(workers).then(() => blocked);
	}
}
