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

export class PACDispatcher extends Dispatcher {

	private readonly findProxy: FindProxy;
	private readonly cache = new Map<string, Dispatcher>();

	constructor(pac: string) {
		super();
		this.findProxy = loadPAC(pac).FindProxyForURL;
	}

	async close() {
		await Promise.all(this.mapAll(v => v.close()));
	}

	async destroy() {
		await Promise.all(this.mapAll(v => v.destroy()));
	}

	private mapAll<T>(fn: (dispatcher: Dispatcher) => T) {
		return Array.from(this.cache.values()).map(fn);
	}

	dispatch(options: DispatchOptions, handler: DispatchHandlers) {
		const { path, origin } = options;

		const p = this.findProxy(path, origin!.toString());
		const [proxy] = parseProxies(p);

		const key = `${proxy.protocol} ${proxy.host}`;
		let dispatcher = this.cache.get(key);
		if (!dispatcher) {
			dispatcher = createDispatcher(proxy);
			this.cache.set(key, dispatcher);
		}

		return dispatcher.dispatch(options, handler);
	}
}
