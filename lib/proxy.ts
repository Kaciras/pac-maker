import tls from "tls";
import { Agent, Dispatcher, ProxyAgent } from "undici";
import { SocksClient } from "socks";
import { DispatchHandlers, DispatchOptions } from "undici/types/dispatcher";
import { FindProxy, loadPAC } from "./loader.js";
import { SocksProxyType } from "socks/typings/common/constants";

const re = /(\w+)(\s+([\w.]+)(?::(\d+))?)?;?/g;

interface ParsedProxy {
	hostname: string;
	host: string;
	port: number;
	protocol: string;
}

function parseProxyURL(value: string) {
	const result: ParsedProxy[] = [];
	for (const match of value.matchAll(re)) {
		const [, protocol, host2, hostname, sPort] = match;
		const port = parseInt(sPort);
		const host = host2.trimStart();
		result.push({ protocol, host, hostname, port });
	}
	return result;
}

function resolvePort(protocol: string, port: string) {
	return port ? Number.parseInt(port) : protocol === "http:" ? 80 : 443;
}

export function socksConnector(
	socksHost: string,
	socksPort: number,
	version: SocksProxyType,
) {
	return async (options: any, callback: any) => {
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
				port: resolvePort(protocol, port),
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

export class PACDispatcher extends Dispatcher {

	private readonly findProxy: FindProxy;
	private readonly cache = new Map<string, Dispatcher>();

	constructor(pac: string) {
		super();
		this.findProxy = loadPAC(pac).FindProxyForURL;
	}

	dispatch(options: DispatchOptions, handler: DispatchHandlers) {
		const key = options.origin!.toString();

		let dispatcher = this.cache.get(key);
		if (!dispatcher) {
			dispatcher = this.getDispatcher(options);
			this.cache.set(key, dispatcher);
		}

		return dispatcher.dispatch(options, handler);
	}

	private getDispatcher(options: DispatchOptions): Dispatcher {
		const { path, origin } = options;

		const proxy = this.findProxy(path, origin!.toString());
		const { protocol, host, hostname, port } = parseProxyURL(proxy)[0];

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
}
