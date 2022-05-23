import tls from "tls";
import { Agent, Dispatcher, ProxyAgent } from "undici";
import { SocksClient } from "socks";
import { DispatchHandlers, DispatchOptions } from "undici/types/dispatcher";
import { Callback, Options } from "undici/types/connector";
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
		const connection = await SocksClient.createConnection({
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
		}).catch(error => { callback(error, null); });

		if (!connection) {
			return; // Error occurred.
		}
		let { socket } = connection;

		let connectEvent = "connect";
		if (protocol === "https:") {
			socket = tls.connect({
				...tlsOptions,
				socket,
				servername: hostname,
			});
			connectEvent = "secureConnect";
		}

		return socket
			.on("error", callback)
			.on(connectEvent, () => callback(null, socket));
	};
}

function createAgent(proxy: ParsedProxy, options: Agent.Options) {
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
		case "HTTP":
		case "PROXY":
			return new ProxyAgent({ ...options, uri: `http://${host}` });
		case "HTTPS":
			return new ProxyAgent({ ...options, uri: `https://${host}` });
		default:
			throw new Error(`Unknown proxy protocol: ${protocol}`);
	}
}

type Dispose<T> = (value: T) => unknown;

interface CacheEntry<T> {
	value: T;
	timer: NodeJS.Timeout;
}

export default class SimpleTTLCache<K, T> {

	private readonly map = new Map<K, CacheEntry<T>>();

	private readonly ttl: number;
	private readonly dispose: Dispose<T>;

	constructor(ttl: number, dispose?: Dispose<T>) {
		this.ttl = ttl;
		this.dispose = dispose ?? (() => {});
	}

	private refreshTimeout(key: K, e: CacheEntry<T>) {
		clearTimeout(e.timer);
		const cb = () => {
			this.map.delete(key);
			this.dispose(e.value);
		};
		e.timer = setTimeout(cb, this.ttl).unref();
	}

	get size() {
		return this.map.size;
	}

	get(key: K) {
		const e = this.map.get(key);
		if (!e) {
			return null;
		}
		this.refreshTimeout(key, e);
		return e.value;
	}

	set(key: K, value: T) {
		let e = this.map.get(key);
		if (e) {
			this.dispose(e.value);
			e.value = value;
		} else {
			e = { value } as CacheEntry<T>;
			this.map.set(key, e);
		}
		this.refreshTimeout(key, e);
	}

	clear(dispose?: Dispose<T>) {
		for (const e of this.map.values()) {
			clearTimeout(e.timer);
			(dispose ?? this.dispose)(e.value);
		}
		this.map.clear();
	}

	* values() {
		for (const e of this.map.values()) yield e.value;
	}
}

interface PACDispatchHandlers extends DispatchHandlers {
	dispatchNext(): boolean;
}

export interface PACDispatcherOptions extends Agent.Options {
	ttl?: number;
}

export class PACDispatcher extends Dispatcher {

	private readonly agentOptions: PACDispatcherOptions;
	private readonly findProxy: FindProxy;
	private readonly cache: SimpleTTLCache<string, Dispatcher>;

	constructor(pac: string, options: PACDispatcherOptions = {}) {
		super();
		const { ttl = 30_000, ...agentOptions } = options;

		this.agentOptions = agentOptions;
		this.findProxy = loadPAC(pac).FindProxyForURL;
		this.cache = new SimpleTTLCache(ttl, v => v.close());
	}

	async close() {
		await Promise.all(this.clear(v => v.close()));
	}

	async destroy() {
		await Promise.all(this.clear(v => v.destroy()));
	}

	private clear(dispose: Dispose<Dispatcher>) {
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
			onError(err: Error) {
				errors.push(err);
				this.dispatchNext();
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
