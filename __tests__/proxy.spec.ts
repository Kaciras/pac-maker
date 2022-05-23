import { Socket } from "net";
import { afterEach, beforeEach, jest } from "@jest/globals";
import { getLocal } from "mockttp";
import { fetch } from "undici";

const createConnection = jest.fn<any>();

jest.mock("socks", () => ({
	SocksClient: { createConnection },
}));

// Dynamic import is required for mocking ES Module.
const { PACDispatcher } = await import("../lib");

function pac(returnVal: string) {
	return `function FindProxyForURL() { return "${returnVal}"; }`;
}

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

it("should dispatch request directly", async () => {
	const dispatcher = new PACDispatcher(pac("DIRECT"));
	await httpServer
		.forGet("/foobar")
		.thenReply(200, "__RESPONSE_DATA__");

	const res = await fetch(httpServer.urlFor("/foobar"), { dispatcher });
	await expect(res.text()).resolves.toBe("__RESPONSE_DATA__");
});

it("should proxy the request", async () => {
	const dispatcher = new PACDispatcher(pac(`HTTP [::1]:${httpServer.port}`));
	const endpoint = await httpServer
		.forGet("https://foo.bar")
		.thenReply(200, "__RESPONSE_DATA__");

	const res = await fetch("https://foo.bar", { dispatcher });

	await expect(res.text()).resolves.toBe("__RESPONSE_DATA__");

	const requests = await endpoint.getSeenRequests();
	expect(requests).toHaveLength(1);
	expect(requests[0].headers.host).toBe("foo.bar");
});

it("should work for https proxy", async () => {
	const dispatcher = new PACDispatcher(
		pac(`HTTPS [::1]:${secureServer.port}`),
		{ connect: { rejectUnauthorized: false } },
	);
	await secureServer
		.forGet("http://foo.bar")
		.thenReply(200, "__RESPONSE_DATA__");

	const res = await fetch("http://foo.bar", { dispatcher });

	await expect(res.text()).resolves.toBe("__RESPONSE_DATA__");
});

it("should connect target through socks", async () => {
	createConnection.mockImplementation(() => {
		const socket = new Socket();
		socket.connect(httpServer.port);
		return Promise.resolve({ socket });
	});

	const dispatcher = new PACDispatcher(pac(`SOCKS [::1]:${httpServer.port}`));
	await httpServer
		.forGet("/foobar")
		.thenReply(200, "__RESPONSE_DATA__");

	await fetch("http://example.com/foobar", { dispatcher });

	expect(createConnection.mock.calls).toHaveLength(1);

	const [options] = createConnection.mock.calls[0];
	expect(options).toStrictEqual({
		proxy: { host: "[::1]", port: httpServer.port, type: 5 },
		command: "connect",
		destination: { host: "example.com", port: 80 },
	});
});

it("should support TLS over socks", async () => {
	createConnection.mockImplementation(() => {
		const socket = new Socket();
		socket.connect(secureServer.port);
		return Promise.resolve({ socket });
	});
	const dispatcher = new PACDispatcher(
		pac(`HTTPS [::1]:${secureServer.port}`),
		{ connect: { rejectUnauthorized: false } },
	);
	await secureServer
		.forGet("/foobar")
		.thenReply(200, "__RESPONSE_DATA__");

	const res = await fetch("http://example.com/foobar", { dispatcher });
	await expect(res.text()).resolves.toBe("__RESPONSE_DATA__");
});

it("should try next if the proxy not work", async () => {
	createConnection.mockRejectedValue(new Error());
	const dispatcher = new PACDispatcher(pac(
		`SOCKS [::1]:1; HTTP [::1]:${httpServer.port}`,
	));
	await httpServer
		.forGet("http://foo.bar")
		.thenReply(200, "__RESPONSE_DATA__");

	const res = await fetch("http://foo.bar", { dispatcher });
	await expect(res.text()).resolves.toBe("__RESPONSE_DATA__");

	expect(createConnection).toHaveBeenCalledTimes(1);
});

it("should throw error if all proxies failed", async () => {
	createConnection.mockRejectedValue(new Error());
	const dispatcher = new PACDispatcher(pac(
		"SOCKS [::1]:1; SOCKS [::1]:2",
	));
	const promise = fetch("http://example.com", { dispatcher });

	await expect(promise).rejects.toThrow(TypeError);

	const error: AggregateError = await promise.catch(e => e.cause);
	expect(error.errors).toHaveLength(2);
});

it("should cache agents", async () => {
	createConnection.mockImplementation(() => {
		const socket = new Socket();
		socket.connect(httpServer.port);
		return Promise.resolve({ socket });
	});
	const dispatcher = new PACDispatcher(pac(
		"SOCKS [::1]:1; SOCKS [::1]:2",
	));
	await httpServer
		.forGet("/foobar")
		.thenReply(200, "__RESPONSE_DATA__");

	await fetch("http://example.com/foobar", { dispatcher });
	await fetch("http://example.com/foobar", { dispatcher });

	expect((dispatcher as any).cache.size).toBe(1);
	expect(createConnection).toHaveBeenCalledTimes(1);
});