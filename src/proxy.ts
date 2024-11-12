import { Agent, buildConnector, Dispatcher, ProxyAgent } from "undici";
import { createInstance, LRUCache } from "@kaciras/utilities/node";
import { socksDispatcher } from "fetch-socks";
import { FindProxy, loadPAC, ParsedProxy, parseProxies } from "./loader.js";

type DispatchHandlers = Dispatcher.DispatchHandlers;
type DispatchOptions = Dispatcher.DispatchOptions;

export interface PACDispatcherOptions extends Agent.Options {
	/**
	 * TLS upgrade options, see:
	 * https://undici.nodejs.org/#/docs/api/Client?id=parameter-connectoptions
	 *
	 * The connect function currently is not supported.
	 */
	connect?: buildConnector.BuildOptions;

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
	proxyTls?: buildConnector.BuildOptions;

	/**
	 * When using HTTP tunnel proxy, specific the options to
	 * connect to the destination.
	 */
	requestTls?: buildConnector.BuildOptions;
}

type AgentOptions = Omit<PACDispatcherOptions, "agentTTL">;

/**
 * Create an undici `Agent` that dispatch requests to the proxy server.
 */
export function createAgent(proxy: ParsedProxy, options: AgentOptions = {}) {
	const { protocol, host, hostname, port } = proxy;
	switch (protocol) {
		case "DIRECT":
			return new Agent(options);
		case "SOCKS":
		case "SOCKS5":
			return socksDispatcher({ type: 5, host: hostname, port }, options);
		case "SOCKS4":
			return socksDispatcher({ type: 4, host: hostname, port }, options);
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

	dispatchWithProxy(value: ParsedProxy): boolean;
}

/**
 * The undici dispatcher that dispatch requests based on rule described by the PAC.
 *
 * Does not yet support Bun:
 * https://github.com/oven-sh/bun/issues/4474
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

	dispatch(options: DispatchOptions, handlers: DispatchHandlers) {
		const { agentOptions, cache, findProxy } = this;
		const { path, origin } = options;

		const p = findProxy(path, origin!.toString()) || "DIRECT";
		const proxies = parseProxies(p)[Symbol.iterator]();
		const errors: Error[] = [];

		const agentSelector: PACDispatchHandlers = {
			onError(error: Error) {
				errors.push(error);
				this.dispatchNext();
			},
			dispatchNext() {
				const { done, value } = proxies.next();
				if (done) {
					handlers.onError?.(new AggregateError(errors, "All proxies are failed"));
					return false;
				}
				try {
					return this.dispatchWithProxy(value);
				} catch (e) {
					errors.push(e);
					return this.dispatchNext();
				}
			},
			dispatchWithProxy(value: ParsedProxy) {
				const key = `${value.protocol} ${value.host}`;
				let dispatcher = cache.get(key);
				if (!dispatcher) {
					dispatcher = createAgent(value, agentOptions);
					cache.set(key, dispatcher);
				}
				return dispatcher.dispatch(options, this);
			},
		};

		return createInstance(handlers, agentSelector).dispatchNext();
	}
}
