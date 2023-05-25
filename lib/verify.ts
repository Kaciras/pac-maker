import { BlockList } from "net";
import { resolve } from "dns/promises";
import { Agent, buildConnector, Dispatcher, fetch } from "undici";
import { parseProxies } from "./loader.js";
import { createAgent } from "./proxy.js";

type Connector = buildConnector.connector;

const gfwIPs = new BlockList();
gfwIPs.addAddress("223.75.236.241"); // 反诈中心
gfwIPs.addSubnet("0.0.0.0", 8);
gfwIPs.addSubnet("127.0.0.0", 8);

export const BlockType = Object.freeze({
	dns: Symbol("DNS cache pollution"),
	tcp: Symbol("TCP resets"),
	unavailable: Symbol("Can't access even with a proxy"),
});

class HostBlockedError extends Error {

	readonly blockType: symbol;

	constructor(type: symbol) {
		super(type.description);
		this.blockType = type;
	}
}

function blockVerifyConnector(timeout: number, blockedIPs: BlockList): Connector {
	const undiciConnect = buildConnector({ timeout });

	return async (options, callback) => {
		try {
			const [ip] = await resolve(options.hostname);
			if (blockedIPs.check(ip)) {
				return callback(new HostBlockedError(BlockType.dns), null);
			}
			undiciConnect({ ...options, hostname: ip }, callback);
		} catch {
			return callback(new HostBlockedError(BlockType.dns), null);
		}
	};
}

export class HostBlockVerifier {

	private readonly protocol: string;
	private readonly direct: Dispatcher;
	private readonly proxy: Dispatcher;

	constructor(proxy: string, protocol = "https", blockedIPs = gfwIPs) {
		this.protocol = protocol;
		this.direct = new Agent({
			connect: blockVerifyConnector(3000, blockedIPs),
		});
		this.proxy = createAgent(parseProxies(proxy)[0]);
	}

	/**
	 * Test if any hostname is blocked by your ISP.
	 *
	 * @param host The hostname to test.
	 * @return One of `blockType` when it is blocked, otherwise `undefined`.
	 */
	async verify(host: string) {
		const { protocol, direct, proxy } = this;
		const url = `${protocol}://${host}`;

		try {
			await fetch(url, { dispatcher: direct });
		} catch (e) {
			try {
				await fetch(url, { dispatcher: proxy });
			} catch {
				return BlockType.unavailable;
			}
			if (e.cause instanceof HostBlockedError) {
				return e.cause.blockType;
			} else {
				return BlockType.unavailable;
			}
		}
	}

	verifyAll(hosts: string[], concurrency = 10) {
		const iterator = hosts[Symbol.iterator]();
		const blocked: Record<string, symbol> = {};

		const run = async () => {
			let { value, done } = iterator.next();
			while (!done) {
				const type = await this.verify(value);
				if (type) {
					blocked[value] = type;
				}
				({ value, done } = iterator.next());
			}
		};

		const workers = [];
		for (let i = 0; i < concurrency; i++) {
			workers[i] = run();
		}
		return Promise.all(workers).then(() => blocked);
	}
}
