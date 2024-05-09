import type { socksDispatcher } from "fetch-socks";
import type { PACDispatcherOptions } from "../src/proxy.js";
import { AddressInfo } from "net";
import * as tp from "timers/promises";
import { afterAll, beforeAll, expect, it, jest } from "@jest/globals";
import { getLocal } from "mockttp";
import { fetch, MockAgent } from "undici";
import { createTunnelProxy, readFixture } from "./share.js";

const mockSocksDispatcher = jest.fn<typeof socksDispatcher>();

function mockSocks() {
	const agent = new MockAgent();
	agent.disableNetConnect();
	mockSocksDispatcher.mockImplementation(() => agent as any);
	return agent;
}

jest.mock("fetch-socks", () => ({
	socksDispatcher: mockSocksDispatcher,
}));

// Dynamic import is required for mocking an ES Modules.
const { PACDispatcher } = await import("../src/proxy.js");

function pac(proxy: string | null, options?: PACDispatcherOptions) {
	return new PACDispatcher(() => proxy, options);
}

const tunnelProxy = await createTunnelProxy();

const tlsTunnelProxy = await createTunnelProxy({
	cert: readFixture("localhost.pem"),
	key: readFixture("localhost.pvk"),
});

const httpServer = getLocal();
beforeAll(() => httpServer.start());
afterAll(() => httpServer.stop());

const secureServer = getLocal({
	https: {
		keyPath: "test/fixtures/localhost.pvk",
		certPath: "test/fixtures/localhost.pem",
	},
});
beforeAll(() => secureServer.start());
afterAll(() => secureServer.stop());

/**
 * Assert the fetching failed by all proxies failed with errors.
 */
async function expectProxyFailed(promise: Promise<any>, errors: any[]) {
	await expect(promise).rejects.toThrow(TypeError);

	const cause: AggregateError = await promise.catch(e => e.cause);
	expect(cause.message).toBe("All proxies are failed");
	expect(cause.errors).toHaveLength(errors.length);

	for (let i = 0; i < errors.length; i++) {
		expect(() => { throw cause.errors[i]; }).toThrow(errors[i]);
	}
}

it("should load the PAC code", async () => {
	await httpServer.forGet("http://foo.bar")
		.thenReply(200, "__RESPONSE_DATA__");

	const code = `function FindProxyForURL() { return "HTTP [::1]:${httpServer.port}"; }`;
	const dispatcher = new PACDispatcher(code);

	const res = await fetch("http://foo.bar", { dispatcher });
	await expect(res.text()).resolves.toBe("__RESPONSE_DATA__");
});

it("should make fetch fail with invalid proxy", async () => {
	const dispatcher = pac("INVALID [::1]:1080");

	const promise = fetch("http://foo.bar", { dispatcher });

	await expectProxyFailed(promise, ["Unknown proxy protocol: INVALID"]);
});

it("should make fetch fail with invalid proxy 2", async () => {
	mockSocks().get("http://example.com")
		.intercept({ path: "/" })
		.replyWithError(new Error("Foobar"));
	const dispatcher = pac("SOCKS [::1]:1; INVALID");

	const promise = fetch("http://example.com", { dispatcher });

	await expectProxyFailed(promise, ["Foobar"]);
});

it("should throw error if all proxies failed", async () => {
	mockSocks().get("http://example.com")
		.intercept({ path: "/" })
		.replyWithError(new Error("Foobar"))
		.persist();

	const dispatcher = pac("SOCKS [::1]:1; SOCKS [::1]:2");
	const promise = fetch("http://example.com", { dispatcher });

	await expectProxyFailed(promise, ["Foobar", "Foobar"]);
});

it.each([
	null,
	"",
	"DIRECT",
])("should connect directly with %s", async proxy => {
	const dispatcher = pac(proxy);
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

it("should establish secure connection over tunnel proxy", async () => {
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

it("should establish connection over HTTPS tunnel proxy", async () => {
	await httpServer
		.forGet("/path")
		.thenReply(200, "__RESPONSE_DATA__");

	const dispatcher = pac(
		`HTTPS [::1]:${(tlsTunnelProxy.address() as AddressInfo).port}`,
		{ proxyTls: { rejectUnauthorized: false } },
	);

	const res = await fetch(httpServer.urlFor("/path"), { dispatcher });

	expect(tlsTunnelProxy.proxyReq).toBeDefined();
	await expect(res.text()).resolves.toBe("__RESPONSE_DATA__");
});

it.each<any>([
	{
		dispatcher: pac("SOCKS 127.0.0.1:1080"),
		socks: {
			type: 5,
			host: "127.0.0.1",
			port: 1080,
		},
	},
	{
		dispatcher: pac("SOCKS4 socks.example.com:80"),
		socks: {
			type: 4,
			host: "socks.example.com",
			port: 80,
		},
	},
	{
		dispatcher: pac("SOCKS5 [::22]:10086", {
			bodyTimeout: 123,
			connect: { rejectUnauthorized: false },
		}),
		socks: {
			type: 5,
			host: "[::22]",
			port: 10086,
		},
		agentOpts: {
			bodyTimeout: 123,
			connect: { rejectUnauthorized: false },
		},
	},
])("should pass parameters to socks dispatcher %#", async params => {
	const { dispatcher, socks, agentOpts = {} } = params;
	mockSocks().get("http://example.com")
		.intercept({ path: "/foobar" })
		.reply(200, "__OK__");

	await fetch("http://example.com/foobar", { dispatcher });

	expect(mockSocksDispatcher.mock.calls).toHaveLength(1);

	const [proxy, options] = mockSocksDispatcher.mock.calls[0];
	expect(proxy).toStrictEqual(socks);
	expect(options).toStrictEqual(agentOpts);
});

it("should try the next if a proxy not work", async () => {
	mockSocks().get("http://foo.bar")
		.intercept({ path: "/" })
		.replyWithError(new Error());

	const dispatcher = pac(`SOCKS [::1]:1; HTTP [::1]:${httpServer.port}`);
	await httpServer.forGet("http://foo.bar")
		.thenReply(200, "__RESPONSE_DATA__");

	const res = await fetch("http://foo.bar", { dispatcher });
	await expect(res.text()).resolves.toBe("__RESPONSE_DATA__");

	expect(mockSocksDispatcher).toHaveBeenCalledTimes(1);
});

it("should cache agents", async () => {
	mockSocks().get("http://example.com")
		.intercept({ path: "/foobar" })
		.reply(200, "__OK__")
		.persist();
	const dispatcher = pac("SOCKS [::1]:1; SOCKS [::1]:2", {
		connections: 1, // Ensure connection reuse.
	});

	await fetch("http://example.com/foobar", { dispatcher });
	await fetch("http://example.com/foobar", { dispatcher });

	expect((dispatcher as any).cache.size).toBe(1);
	expect(mockSocksDispatcher).toHaveBeenCalledTimes(1);
});

it("should cleanup cached agents on close", async () => {
	const mockSocksAgent = mockSocks();
	jest.spyOn(mockSocksAgent, "close");

	const dispatcher = pac("SOCKS [::1]:1");
	mockSocksAgent.get("http://example.com")
		.intercept({ path: "/" })
		.reply(200, "__OK__");

	await fetch("http://example.com", { dispatcher });

	await dispatcher.close();

	expect(mockSocksAgent.close).toHaveBeenCalledTimes(1);
});

it("should cleanup cached agents on destroy", async () => {
	const mockSocksAgent = mockSocks();
	mockSocksAgent.destroy = jest.fn<any>();

	const dispatcher = pac("SOCKS [::1]:1");
	mockSocksAgent.get("http://example.com")
		.intercept({ path: "/" })
		.reply(200, "__OK__");

	await fetch("http://example.com", { dispatcher });
	await dispatcher.destroy();

	expect(mockSocksAgent.destroy).toHaveBeenCalledTimes(1);
});

it("should expire cached agents", async () => {
	const mockSocksAgent = mockSocks();
	jest.spyOn(mockSocksAgent, "close");
	mockSocksAgent.get("http://example.com")
		.intercept({ path: "/" })
		.reply(200, "__OK__");

	const dispatcher = pac("SOCKS [::1]:1", {
		agentTTL: 99,
	});
	await fetch("http://example.com", { dispatcher });

	await tp.setTimeout(100);
	expect(mockSocksAgent.close).toHaveBeenCalledTimes(1);
});
