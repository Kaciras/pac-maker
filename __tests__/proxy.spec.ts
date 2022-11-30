import type { socksDispatcher } from "fetch-socks";
import type { PACDispatcherOptions } from "../lib/proxy.js";
import { AddressInfo } from "net";
import { afterAll, afterEach, beforeEach, expect, it, jest } from "@jest/globals";
import { getLocal } from "mockttp";
import { fetch, MockAgent } from "undici";
import { createTunnelProxy } from "./share.js";

const mockSocksAgent = new MockAgent();
const mockSocksDispatcher = jest.fn<typeof socksDispatcher>(() => mockSocksAgent as any);

jest.mock("fetch-socks", () => ({
	socksDispatcher: mockSocksDispatcher,
}));

// Dynamic import is required for mocking an ES Modules.
const { PACDispatcher } = await import("../lib/proxy.js");

function pac(proxy: string | null, options?: PACDispatcherOptions) {
	return new PACDispatcher(() => proxy, options);
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
	mockSocksAgent.get("http://example.com")
		.intercept({ path: "/" })
		.replyWithError(new Error("Foobar"));
	const dispatcher = pac("SOCKS [::1]:1; INVALID");

	const promise = fetch("http://example.com", { dispatcher });

	await expectProxyFailed(promise, ["Foobar"]);
});

it("should throw error if all proxies failed", async () => {
	mockSocksAgent.get("http://example.com")
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

it("should pass parameters to socks proxy", async () => {
	mockSocksAgent.get("http://example.com")
		.intercept({ path: "/foobar" })
		.reply(200, "__OK__");

	const dispatcher = pac("SOCKS5 [::22]:1080", {
		bodyTimeout: 123,
		connect: { rejectUnauthorized: false },
	});
	await fetch("http://example.com/foobar", { dispatcher });

	expect(mockSocksDispatcher.mock.calls).toHaveLength(1);

	const [options] = mockSocksDispatcher.mock.calls[0];
	expect(options).toStrictEqual({
		connect: { rejectUnauthorized: false },
		bodyTimeout: 123,
		proxy: { host: "[::22]", port: 1080, type: 5 },
	});
});

it("should try the next if a proxy not work", async () => {
	mockSocksAgent.get("http://foo.bar")
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
	mockSocksAgent.get("http://example.com")
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
