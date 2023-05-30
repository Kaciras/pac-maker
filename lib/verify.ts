import { BlockList } from "net";
import { resolve } from "dns/promises";
import { Agent, buildConnector, Dispatcher, fetch } from "undici";
import { parseProxies } from "./loader.js";
import { createAgent } from "./proxy.js";

type Connector = buildConnector.connector;

/**
 * - "DNS": DNS cache pollution or resolve timeout.
 * - "TCP": Can't establish or keep the connection.
 * - "Unavailable": Can't access the site even with a proxy.
 */
export type BlockType = "DNS" | "TCP" | "Unavailable";

const gfwIPs = new BlockList();
gfwIPs.addAddress("223.75.236.241"); // 反诈中心
gfwIPs.addSubnet("0.0.0.0", 8);
gfwIPs.addSubnet("127.0.0.0", 8);

class HostBlockedError extends Error {

	readonly blockType: BlockType;

	constructor(blockType: BlockType) {
		super();
		this.blockType = blockType;
	}
}

function blockVerifyConnector(timeout: number, blockedIPs: BlockList): Connector {
	const undiciConnect = buildConnector({ timeout });

	return async (options, callback) => {
		try {
			const [ip] = await resolve(options.hostname);
			if (blockedIPs.check(ip)) {
				return callback(new HostBlockedError("DNS"), null);
			}
			undiciConnect({ ...options, hostname: ip }, callback);
		} catch {
			return callback(new HostBlockedError("DNS"), null);
		}
	};
}

function connectHTTP(url: string, dispatcher: Dispatcher) {
	return fetch(url, { dispatcher, method: "HEAD" });
}

export interface BlockVerifyOptions {

	/**
	 * The protocol of the request, "http" of "https".
	 *
	 * @default "https"
	 */
	protocol?: "http" | "https";

	/**
	 * The amount of time in milliseconds to wait for connection.
	 *
	 * @default 3000
	 */
	timeout?: number;

	/**
	 * List of IPs that be considered DNS pollution.
	 *
	 * @default built-in list.
	 */
	blockedIPs?: BlockList;
}

/**
 * A tool to check which hostnames are blocked by your ISP.
 *
 * This class is only support HTTP protocol, it cannot be used for
 * hosts running non-HTTP services.
 *
 * @example
 * const verifier = new HostBlockVerifier("SOCKS5 localhost:1080");
 * const reason = await verifier.verify("google.com");
 * if (reason === "DNS") {
 * 	console.log("DNS cache pollution");
 * } else if (reason === "TCP") {
 * 	console.log("TCP blocking");
 * } else if (reason === "Unavailable") {
 * 	console.log("Site may be down");
 * } else {
 * 	console.log("The host is not blocked");
 * }
 */
export class HostBlockVerifier {

	private readonly protocol: string;
	private readonly direct: Dispatcher;
	private readonly proxy: Dispatcher;

	/**
	 * For accurate results, you need to provide an unblocked proxy.
	 *
	 * @param proxy the proxy string.
	 * @param options more options.
	 */
	constructor(proxy: string, options: BlockVerifyOptions = {}) {
		const { timeout = 3000, blockedIPs = gfwIPs } = options;

		this.protocol = options.protocol ?? "https";
		this.proxy = createAgent(parseProxies(proxy, true)[0], {
			headersTimeout: timeout,
		});
		this.direct = new Agent({
			headersTimeout: timeout,
			connect: blockVerifyConnector(timeout, blockedIPs),
		});
	}

	/**
	 * Test if any hostname is blocked by your ISP.
	 *
	 * @param host The hostname to test.
	 * @return One of `BlockType` when it is blocked, otherwise `undefined`.
	 */
	async verify(host: string): Promise<BlockType | undefined> {
		const { protocol, direct, proxy } = this;
		const url = `${protocol}://${host}`;

		try {
			await connectHTTP(url, direct);
		} catch (e) {
			try {
				await connectHTTP(url, proxy);
			} catch {
				return "Unavailable";
			}
			return e.cause instanceof HostBlockedError
				? e.cause.blockType : "TCP";
		}
	}

	verifyAll(hosts: string[], concurrency = 10) {
		const iterator = hosts[Symbol.iterator]();
		const blocked: Record<string, BlockType> = {};

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

		const workers = new Array(concurrency);
		for (let i = 0; i < concurrency; i++) {
			workers[i] = run();
		}
		return Promise.all(workers).then(() => blocked);
	}
}
