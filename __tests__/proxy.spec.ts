import { AddressInfo, connect, Socket } from "net";
import * as http from "http";
import { afterAll, afterEach, beforeEach, expect, jest } from "@jest/globals";
import { getLocal, Mockttp } from "mockttp";
import { fetch } from "undici";
import { PACDispatcherOptions } from "../lib/proxy.js";

const createConnection = jest.fn();

jest.mock("socks", () => ({
	SocksClient: { createConnection },
}));

// Dynamic import is required for mocking ES Modules.
const { PACDispatcher } = await import("../lib/proxy.js");

function pac(proxy: string, options?: PACDispatcherOptions) {
	return new PACDispatcher(() => proxy, options);
}

function setupSocksTarget(dest: Mockttp | Error) {
	createConnection.mockImplementation((_, callback: any) => {
		if (dest instanceof Error) {
			return callback(dest);
		}
		const socket = new Socket();
		socket.connect(dest.port);
		callback(null, { socket });
	});
}

interface TunnelProxyServer extends http.Server {

	/**
	 * The latest connect request to the server, used for assertion.
	 */
	proxyReq: http.IncomingMessage;
}

/**
 * Create a simple HTTP tunnel proxy server. The code is derived from:
 * https://nodejs.org/dist/latest-v19.x/docs/api/http.html#event-connect
 */
function createTunnelProxy() {
	const proxy = http.createServer() as TunnelProxyServer;
	proxy.on("connect", (req, socket, head) => {
		const { port, hostname } = new URL(`http://${req.url}`);
		proxy.proxyReq = req;

		// @ts-ignore Pass a string to port is ok.
		const serverSocket = connect(port, hostname, () => {
			socket.write("HTTP/1.1 200\r\n\r\n");
			serverSocket.write(head);
			serverSocket.pipe(socket);
			socket.pipe(serverSocket);
		});
	});
	return new Promise(resolve => proxy.listen(resolve)).then(() => proxy);
}

const tunnelProxy = await createTunnelProxy();
afterAll(callback => void tunnelProxy.close(callback));

const httpServer = getLocal();
beforeEach(() => httpServer.start());
afterEach(() => httpServer.stop());

const secureServer = getLocal({
	https: {
		keyPath: "__tests__/fixtures/localhost.pvk",
		certPath: "__tests__/fixtures/localhost.pem",
	},
});
beforeEach(() => secureServer.start());
afterEach(() => secureServer.stop());

it("should load the PAC code", async () => {
	await httpServer.forGet("http://foo.bar")
		.thenReply(200, "__RESPONSE_DATA__");

	const code = `function FindProxyForURL() { return "HTTP [::1]:${httpServer.port}"; }`;
	const dispatcher = new PACDispatcher(code);

	const res = await fetch("http://foo.bar", { dispatcher });
	await expect(res.text()).resolves.toBe("__RESPONSE_DATA__");
});

it("should make fetch fail with invalid proxy", () => {
	const dispatcher = pac("INVALID [::1]:1080");
	return expect(fetch("http://foo.bar", { dispatcher })).rejects.toThrow();
});

it("should make fetch fail with invalid proxy 2", () => {
	setupSocksTarget(new Error());
	const dispatcher = pac("SOCKS [::1]:1; INVALID [::1]:1080");
	return expect(fetch("http://foo.bar", { dispatcher })).rejects.toThrow();
});

it("should dispatch request directly", async () => {
	const dispatcher = pac("DIRECT");
	await httpServer
		.forGet("/foobar")
		.thenReply(200, "__RESPONSE_DATA__");

	const res = await fetch(httpServer.urlFor("/foobar"), { dispatcher });
	await expect(res.text()).resolves.toBe("__RESPONSE_DATA__");
});

it("should proxy the request", async () => {
	const dispatcher = pac(`PROXY [::1]:${httpServer.port}`);
	const endpoint = await httpServer
		.forGet("http://foo.bar")
		.thenReply(200, "__RESPONSE_DATA__");

	const res = await fetch("http://foo.bar", { dispatcher });

	await expect(res.text()).resolves.toBe("__RESPONSE_DATA__");

	const requests = await endpoint.getSeenRequests();
	expect(requests).toHaveLength(1);
	expect(requests[0].headers.host).toBe("foo.bar");
});

it("should work for tunnel proxy", async () => {
	await secureServer
		.forGet("/path")
		.thenReply(200, "__RESPONSE_DATA__");

	const dispatcher = pac(
		`HTTP [::1]:${(tunnelProxy.address() as AddressInfo).port}`,
		{ requestTls: { rejectUnauthorized: false } },
	);

	const res = await fetch(secureServer.urlFor("/path"), { dispatcher });

	expect(tunnelProxy.proxyReq).toBeDefined();
	await expect(res.text()).resolves.toBe("__RESPONSE_DATA__");
});

it("should connect target through socks", async () => {
	setupSocksTarget(httpServer);
	const dispatcher = pac("SOCKS [::1]:1080");
	await httpServer
		.forGet("/foobar")
		.thenReply(200, "__RESPONSE_DATA__");

	await fetch("http://example.com/foobar", { dispatcher });

	expect(createConnection.mock.calls).toHaveLength(1);

	const [options] = createConnection.mock.calls[0];
	expect(options).toStrictEqual({
		proxy: { host: "[::1]", port: 1080, type: 5 },
		command: "connect",
		destination: { host: "example.com", port: 80 },
	});
});

it("should support TLS over socks", async () => {
	setupSocksTarget(secureServer);
	const dispatcher = pac(
		"SOCKS [::1]:1080",
		{ connect: { rejectUnauthorized: false } },
	);
	await secureServer.forGet("/foobar")
		.withProtocol("https")
		.thenReply(200, "__RESPONSE_DATA__");

	const res = await fetch("https://example.com/foobar", { dispatcher });
	await expect(res.text()).resolves.toBe("__RESPONSE_DATA__");
});

it("should try the next if a proxy not work", async () => {
	setupSocksTarget(new Error());
	const dispatcher = pac(`SOCKS [::1]:1; HTTP [::1]:${httpServer.port}`);
	await httpServer
		.forGet("http://foo.bar")
		.thenReply(200, "__RESPONSE_DATA__");

	const res = await fetch("http://foo.bar", { dispatcher });
	await expect(res.text()).resolves.toBe("__RESPONSE_DATA__");

	expect(createConnection).toHaveBeenCalledTimes(1);
});

it("should throw error if all proxies failed", async () => {
	setupSocksTarget(new Error());
	const dispatcher = pac("SOCKS [::1]:1; SOCKS [::1]:2");
	const promise = fetch("http://example.com", { dispatcher });

	await expect(promise).rejects.toThrow(TypeError);

	const error: AggregateError = await promise.catch(e => e.cause);
	expect(error.errors).toHaveLength(2);
});

it("should cache agents", async () => {
	setupSocksTarget(httpServer);
	const dispatcher = pac("SOCKS [::1]:1; SOCKS [::1]:2", {
		connections: 1, // Ensure connection reuse.
	});
	await httpServer
		.forGet("/foobar")
		.thenReply(200, "__RESPONSE_DATA__");

	await fetch("http://example.com/foobar", { dispatcher });
	await fetch("http://example.com/foobar", { dispatcher });

	expect((dispatcher as any).cache.size).toBe(1);
	expect(createConnection).toHaveBeenCalledTimes(1);
});
