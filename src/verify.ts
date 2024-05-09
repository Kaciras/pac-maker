import { BlockList } from "net";
import { resolve } from "dns/promises";
import { Agent, buildConnector, Dispatcher, fetch } from "undici";
import chalk, { ChalkInstance } from "chalk";
import { SingleBar } from "cli-progress";
import { parseProxies } from "./loader.js";
import { createAgent } from "./proxy.js";

type Connector = buildConnector.connector;

/**
 * - "DNS": DNS cache pollution or resolve timeout.
 * - "TCP": Can't establish or keep the connection.
 * - "Unavailable": Can't access the site even with a proxy.
 */
export type BlockType = "DNS" | "TCP" | "Unavailable";

const { redBright, greenBright } = chalk;

const gfwIPs = new BlockList();
gfwIPs.addSubnet("127.0.0.0", 8);
gfwIPs.addSubnet("0.0.0.0", 8);
gfwIPs.addAddress("106.74.25.198");	// 内蒙古反诈中心
gfwIPs.addAddress("124.236.16.201"); // 河北反诈中心
gfwIPs.addAddress("182.43.124.6");	// 贵州反诈中心
gfwIPs.addAddress("223.75.236.241"); // 湖北反诈中心

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
	 * @default 10_000
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
 * (await verifier.verifyAll(["google.com"])).print();
 */
export class HostBlockVerifier {

	private readonly protocol: string;
	private readonly direct: Dispatcher;
	private readonly proxy?: Dispatcher;

	/**
	 * For accurate results, you can provide an unblocked proxy at the first
	 * parameter to detect site down, if it is null this phase will be skipped.
	 *
	 * @param proxy the proxy string.
	 * @param options more options.
	 */
	constructor(proxy: string | null, options: BlockVerifyOptions = {}) {
		const { timeout = 10_000, blockedIPs = gfwIPs } = options;

		this.protocol = options.protocol ?? "https";
		this.direct = new Agent({
			headersTimeout: timeout,
			connect: blockVerifyConnector(timeout, blockedIPs),
		});
		if (proxy) {
			const parsed = parseProxies(proxy, true)[0];
			this.proxy = createAgent(parsed, { headersTimeout: timeout });
		}
	}

	/**
	 * Test if any hostname is blocked by your ISP.
	 *
	 * @example
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
			if (proxy) {
				try {
					await connectHTTP(url, proxy);
				} catch {
					return "Unavailable";
				}
			}
			return e.cause instanceof HostBlockedError
				? e.cause.blockType : "TCP";
		}
	}

	verifyAll(hosts: string[], concurrency = 10) {
		const progress = new SingleBar({});
		const iterator = hosts[Symbol.iterator]();
		const blocked: Record<string, BlockType> = {};

		const run = async () => {
			let { value, done } = iterator.next();
			while (!done) {
				const type = await this.verify(value);
				if (type) {
					blocked[value] = type;
				}
				progress.increment();
				({ value, done } = iterator.next());
			}
		};

		progress.start(hosts.length, 0);
		const workers = [];
		for (let i = 0; i < concurrency; i++) {
			workers.push(run());
		}
		return Promise.all(workers)
			.then(() => new HostsBlockInfo(hosts, blocked))
			.finally(() => progress.stop());
	}
}

type GroupedBlockResult = Record<BlockType | "Unblocked", string[]>;

export class HostsBlockInfo {

	/** The `hosts` argument passed to `verifyAll`. */
	readonly input: string[];

	/** Blocked hostnames with its type. */
	readonly blocked: Record<string, BlockType>;

	private grouped?: GroupedBlockResult;

	constructor(input: string[], blocked: Record<string, BlockType>) {
		this.input = input;
		this.blocked = blocked;
	}

	/**
	 * Group hosts with its block type, unblocked hosts are
	 * also included with key "Unblocked".
	 */
	groupByType() {
		const { blocked, input, grouped } = this;
		if (grouped) {
			return grouped;
		}
		const newGrouped: GroupedBlockResult = {
			DNS: [],
			TCP: [],
			Unavailable: [],
			Unblocked: [],
		};
		for (const h of input) {
			newGrouped[blocked[h] ?? "Unblocked"].push(h);
		}
		return this.grouped = newGrouped;
	}

	print() {
		const { Unblocked, DNS, TCP, Unavailable } = this.groupByType();
		const total = this.input.length;
		const blocked = total - Unblocked.length;
		const p = (blocked / total * 100).toFixed();

		console.log(`Checked ${total} hosts, ${blocked} (${p}%) are blocked.`);
		this.pg(Unblocked, greenBright, "Not in blocking");
		this.pg(DNS, redBright, "DNS cache pollution");
		this.pg(TCP, redBright, "TCP reset");
		this.pg(Unavailable, redBright, "Can't access event with a proxy");
	}

	private pg(hosts: string[], color: ChalkInstance, type: string) {
		if (hosts.length > 0) {
			console.log();
			console.log(color(`${type} (${hosts.length}):`));
			for (const hostname of hosts) console.log(hostname);
		}
	}
}
