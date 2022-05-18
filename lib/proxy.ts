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
) {
	return async (options: Options, callback: Callback) => {
		const { protocol, hostname, port } = options;
		let { socket } = await SocksClient.createConnection({
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
		});

		let connectEvent = "connect";
		if (protocol === "https:") {
			socket = tls.connect({
				socket,
				servername: hostname,
			});
			connectEvent = "secureConnect";
		}

		return socket
			.on(connectEvent, () => callback(null, socket))
			.on("error", callback);
	};
}

function createDispatcher(proxy: ParsedProxy): Dispatcher {
	const { protocol, host, hostname, port } = proxy;
	switch (protocol) {
		case "DIRECT":
			return new Agent();
		case "SOCKS":
		case "SOCKS5":
			return new Agent({ connect: socksConnector(hostname, port, 5) });
		case "SOCKS4":
			return new Agent({ connect: socksConnector(hostname, port, 4) });
		case "HTTP":
		case "PROXY":
			return new ProxyAgent(`http://${host}`);
		case "HTTPS":
			return new ProxyAgent(`https://${host}`);
		default:
			throw new Error(`Unknown proxy protocol: ${protocol}`);
	}
}

interface CacheEntry {
	value: Dispatcher;
	timer: NodeJS.Timeout;
}

class SimpleTTLCache {

	private readonly map = new Map<string, CacheEntry>();
	private readonly ttl: number;

	constructor(ttl: number) {
		this.ttl = ttl;
	}

	private refreshTimeout(key: string, e: CacheEntry) {
		clearTimeout(e.timer);
		const cb = () => {
			this.map.delete(key);
			return e.value.close();
		};
		e.timer = setTimeout(cb, this.ttl).unref();
	}

	get(key: string) {
		const e = this.map.get(key);
		if (!e) return null;
		this.refreshTimeout(key, e);
		return e.value;
	}

	set(key: string, value: Dispatcher) {
		const e = { value } as CacheEntry;
		this.map.set(key, e);
		this.refreshTimeout(key, e);
	}

	clear() {
		for (const e of this.map.values()) {
			clearTimeout(e.timer);
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

export interface PACDispatcherOptions {
	ttl?: number;
}

export class PACDispatcher extends Dispatcher {

	private readonly findProxy: FindProxy;
	private readonly cache: SimpleTTLCache;

	constructor(pac: string, options: PACDispatcherOptions = {}) {
		super();
		this.findProxy = loadPAC(pac).FindProxyForURL;
		this.cache = new SimpleTTLCache(options.ttl ?? 30_000);
	}

	async close() {
		await Promise.all(this.mapAll(v => v.close()));
		this.cache.clear();
	}

	async destroy() {
		await Promise.all(this.mapAll(v => v.destroy()));
		this.cache.clear();
	}

	private mapAll<T>(fn: (dispatcher: Dispatcher) => T) {
		return Array.from(this.cache.values()).map(fn);
	}

	dispatch(options: DispatchOptions, handler: DispatchHandlers) {
		const { cache, findProxy } = this;
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
					super.onError?.(new AggregateError(errors, "All proxies are failed"));
					return false;
				}

				const key = `${value.protocol} ${value.host}`;
				let dispatcher = cache.get(key);
				if (!dispatcher) {
					dispatcher = createDispatcher(value);
					cache.set(key, dispatcher);
				}

				return dispatcher.dispatch(options, this);
			},
		};

		const base = Object.create(handler);
		return Object.assign(base, extension).dispatchNext();
	}
}
