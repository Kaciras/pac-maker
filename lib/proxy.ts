import tls, { TlsOptions } from "tls";
import { Agent, Dispatcher, ProxyAgent } from "undici";
import { SocksClient } from "socks";
import { DispatchHandlers, DispatchOptions } from "undici/types/dispatcher";
import { Callback, Options } from "undici/types/connector";
import { LRUCache } from "@kaciras/utilities";
import { FindProxy, loadPAC, ParsedProxy, parseProxies } from "./loader.js";

function resolvePort(protocol: string, port: string) {
	return port ? Number.parseInt(port) : protocol === "http:" ? 80 : 443;
}

function socksConnector(
	socksHost: string,
	socksPort: number,
	version: 4 | 5,
	tlsOptions?: any,
) {
	return async (options: Options, callback: Callback) => {
		const { protocol, hostname, port } = options;
		SocksClient.createConnection({
			proxy: {
				host: socksHost,
				port: socksPort,
				type: version,
			},
			command: "connect",
			destination: {
				host: hostname,
				port: resolvePort(protocol, port as any),
			},
		}, (error, connection) => {
			if (error) {
				return callback(error, null);
			}
			let { socket } = connection!;

			let connectEvent = "connect";
			if (protocol === "https:") {
				socket = tls.connect({
					...tlsOptions,
					socket,
					servername: hostname,
				});
				connectEvent = "secureConnect";
			}

			socket
				.on("error", error => callback(error, null))
				.on(connectEvent, () => callback(null, socket));
		});
	};
}

export interface PACDispatcherOptions extends Agent.Options {

	/**
	 * Specifies a timeout in milliseconds that the dispatcher
	 * should keep the proxy agent object.
	 *
	 * @default 300_000
	 */
	agentTTL?: number;

	/**
	 * When using HTTP tunnel proxy, specific the options to
	 * connect to the proxy server.
	 */
	proxyTls?: TlsOptions & { servername?: string };

	/**
	 * When using HTTP tunnel proxy, specific the options to
	 * connect to the destination.
	 */
	requestTls?: TlsOptions & { servername?: string };
}

type AgentOptions = Omit<PACDispatcherOptions, "agentTTL">;

/**
 * Create an undici `Agent` that dispatch requests to the proxy server.
 */
function createAgent(proxy: ParsedProxy, options: AgentOptions = {}) {
	const { protocol, host, hostname, port } = proxy;
	switch (protocol) {
		case "DIRECT":
			return new Agent(options);
		case "SOCKS":
		case "SOCKS5":
			return new Agent({
				...options,
				connect: socksConnector(hostname, port, 5, options.connect),
			});
		case "SOCKS4":
			return new Agent({
				...options,
				connect: socksConnector(hostname, port, 4, options.connect),
			});
		case "PROXY":
		case "HTTP":
			return new ProxyAgent({ ...options, uri: `http://${host}` });
		case "HTTPS":
			return new ProxyAgent({ ...options, uri: `https://${host}` });
		default:
			throw new Error(`Unknown proxy protocol: ${protocol}`);
	}
}

interface PACDispatchHandlers extends DispatchHandlers {
	dispatchNext(): boolean;
}

/**
 * The undici dispatcher that dispatch requests based on rule described by the PAC.
 */
export class PACDispatcher extends Dispatcher {

	private readonly agentOptions: AgentOptions;
	private readonly findProxy: FindProxy;
	private readonly cache: LRUCache<string, Dispatcher>;

	/**
	 * Create a new PACDispatcher instance.
	 *
	 * @param pac The PAC script code or the FindProxyForURL function.
	 * @param options Agent options
	 */
	constructor(pac: string | FindProxy, options: PACDispatcherOptions = {}) {
		super();
		const { agentTTL = 300_000, ...agentOptions } = options;

		if (typeof pac === "string") {
			pac = loadPAC(pac).FindProxyForURL;
		}

		this.agentOptions = agentOptions;
		this.findProxy = pac;
		this.cache = new LRUCache({ ttl: agentTTL, dispose: v => v.close() });
	}

	async close() {
		await Promise.all(this.clear(v => v.close()));
	}

	async destroy() {
		await Promise.all(this.clear(v => v.destroy()));
	}

	private clear(dispose: (d: Dispatcher) => Promise<void>) {
		const { cache } = this;
		const agents = Array.from(cache.values());
		cache.clear(() => {});
		return agents.map(dispose);
	}

	dispatch(options: DispatchOptions, handler: DispatchHandlers) {
		const { agentOptions, cache, findProxy } = this;
		const { path, origin } = options;

		const p = findProxy(path, origin!.toString());
		const proxies = parseProxies(p)[Symbol.iterator]();
		const errors: Error[] = [];

		const extension: PACDispatchHandlers = {
			onError(error: Error) {
				errors.push(error);
				try {
					this.dispatchNext();
				} catch (e) {
					handler.onError?.(e);
				}
			},
			dispatchNext() {
				const { done, value } = proxies.next();
				if (done) {
					handler.onError?.(new AggregateError(errors, "All proxies are failed"));
					return false;
				}

				const key = `${value.protocol} ${value.host}`;
				let dispatcher = cache.get(key);
				if (!dispatcher) {
					dispatcher = createAgent(value, agentOptions);
					cache.set(key, dispatcher);
				}

				return dispatcher.dispatch(options, this);
			},
		};

		return Object.assign(Object.create(handler), extension).dispatchNext();
	}
}
