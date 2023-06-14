import { BlockList, connect } from "net";
import { afterAll, beforeAll, expect, it, jest } from "@jest/globals";
import { getLocal } from "mockttp";
import { buildConnector, MockAgent } from "undici";
import { createAgent } from "../lib/index.js";

const mockProxyAgent = new MockAgent();
mockProxyAgent.disableNetConnect();
mockProxyAgent.get("https://example.com")
	.intercept({ path: "/", method: "HEAD" })
	.reply(200, "Access OK").persist();

const mockDNSResolve = jest.fn<any>();
const mockConnect = jest.fn<buildConnector.connector>();
const mockConnector = jest.fn<typeof buildConnector>(() => mockConnect);
const mockCreateAgent = jest.fn<typeof createAgent>(() => mockProxyAgent);

jest.unstable_mockModule("dns/promises", () => ({
	resolve: mockDNSResolve,
}));

jest.unstable_mockModule("undici", async () => ({
	...jest.requireActual("undici") as any,
	buildConnector: mockConnector,
}));

jest.unstable_mockModule("../lib/proxy.js", () => ({
	createAgent: mockCreateAgent,
}));

const { HostBlockVerifier, HostsBlockInfo } = await import("../lib/verify.js");

const httpServer = getLocal();
await httpServer.forAnyRequest().thenReply(200);
beforeAll(() => httpServer.start());
afterAll(() => httpServer.stop());

function setupMockConnect(success: boolean) {
	if (success) {
		mockConnect.mockImplementation((o, c) => {
			c(null, connect(httpServer.port, "localhost"));
		});
	} else {
		mockConnect.mockImplementation((o, c) => c(new Error(), null));
	}
}

it("should check the proxy string", () => {
	expect(() => new HostBlockVerifier("HTTP [foo]:bar")).toThrow();
});

it("should detect non-blocked hosts", async () => {
	mockDNSResolve.mockResolvedValue(["11.22.33.44"]);
	setupMockConnect(true);

	const verifier = new HostBlockVerifier("HTTP [::1]:1080");
	expect(await verifier.verify("example.com")).toBeUndefined();
});

it("should detect DNS pollution", async () => {
	mockDNSResolve.mockResolvedValue(["127.0.0.1"]);

	const verifier = new HostBlockVerifier("HTTP [::1]:1080");
	expect(await verifier.verify("example.com")).toBe("DNS");
});

it("should detect DNS blocking", async () => {
	mockDNSResolve.mockRejectedValue(Object.assign(new Error(), { code: "ENODATA" }));

	const verifier = new HostBlockVerifier("HTTP [::1]:1080");
	expect(await verifier.verify("example.com")).toBe("DNS");
});

it("should support plain HTTP requests", async () => {
	mockDNSResolve.mockResolvedValue(["127.0.0.1"]);

	const verifier = new HostBlockVerifier("HTTP [::1]:1080", {
		protocol: "http",
	});
	expect(await verifier.verify("example.com")).toBe("Unavailable");
});

it("should support custom IP black list", async () => {
	mockDNSResolve.mockResolvedValue(["11.22.33.44"]);
	const list = new BlockList();
	list.addAddress("11.22.33.44");

	const verifier = new HostBlockVerifier("HTTP [::1]:1080", {
		blockedIPs: list,
	});
	expect(await verifier.verify("example.com")).toBe("DNS");
});

it("should support custom the timeout", async () => {
	new HostBlockVerifier("HTTP [::1]:1080", {
		timeout: 1234,
	});
	const [directOptions] = mockConnector.mock.calls[0];
	const [,proxyOptions] = mockCreateAgent.mock.calls[0];

	expect(directOptions!.timeout).toBe(1234);
	expect(proxyOptions!.headersTimeout).toBe(1234);
});

it("should detect TCP reset", async () => {
	mockDNSResolve.mockResolvedValue(["11.22.33.44"]);
	setupMockConnect(false);
	const verifier = new HostBlockVerifier("HTTP [::1]:1080");

	expect(await verifier.verify("example.com")).toBe("TCP");
	expect(mockConnect.mock.calls[0][0].hostname).toBe("11.22.33.44");
});

it("should detect site down", async () => {
	mockDNSResolve.mockResolvedValue(["11.22.33.44"]);
	setupMockConnect(false);

	const verifier = new HostBlockVerifier("HTTP [::1]:1080");
	expect(await verifier.verify("foo.bar")).toBe("Unavailable");
});

it("should support batch verify", async () => {
	const verifier = new HostBlockVerifier("HTTP [::1]:1080");
	verifier.verify = jest.fn<typeof verifier.verify>(
		async host => host === "qux" ? undefined : "DNS",
	);

	const hosts = ["foo", "bar", "baz", "qux"];
	const task = verifier.verifyAll(hosts, 2);
	expect(verifier.verify).toHaveBeenCalledTimes(2);

	const { input, blocked } = await task;
	expect(input).toBe(hosts);
	expect(blocked).toStrictEqual({ foo: "DNS", bar: "DNS", baz: "DNS" });
});

it("should print the result", () => {
	const info = new HostsBlockInfo(
		["foo", "bar", "baz", "qux"],
		{ foo: "TCP", bar: "DNS", baz: "DNS" },
	);
	info.print();
	const printed = (console.log as jest.Mock<typeof console.log>)
		.mock.calls
		.map(args => args[0])
		.join("\n");

	expect(printed).toMatchInlineSnapshot(`
"Checked 4 hosts, 3 are blocked.

[92mNot in blocking (1):[39m
qux

[91mDNS cache pollution (2):[39m
bar
baz

[91mTCP reset (1):[39m
foo"
`);
});

it("should able to group hosts by block type", () => {
	const info = new HostsBlockInfo(
		["foo", "bar", "baz", "qux"],
		{ foo: "TCP", bar: "DNS", baz: "DNS" },
	);
	const grouped = info.groupByType();

	expect(grouped).toStrictEqual({
		DNS: ["bar", "baz"],
		TCP: ["foo"],
		Unavailable: [],
		Unblocked: ["qux"],
	});
	expect(info.groupByType()).toBe(grouped);
});
