import { BlockList, connect } from "net";
import { afterAll, beforeAll, expect, it, jest } from "@jest/globals";
import { getLocal } from "mockttp";
import { buildConnector, MockAgent } from "undici";
import { createAgent } from "../lib/index.js";

const mockConnect = jest.fn<buildConnector.connector>();
const mockConnector = jest.fn<typeof buildConnector>(() => mockConnect);
const mockDNSResolve = jest.fn<any>();
const mockCreateAgent = jest.fn<typeof createAgent>(() => mockProxyAgent);

const ALIVE_SITE = "example.com";
const INACCESSIBLE_SITE = "invalid.foobar";

const mockProxyAgent = new MockAgent();
mockProxyAgent.disableNetConnect();
mockProxyAgent.get(`https://${ALIVE_SITE}`)
	.intercept({ path: "/", method: "HEAD" })
	.reply(200).persist();

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

function polluteDNS(value: boolean) {
	mockDNSResolve.mockResolvedValue([value ? "0.0.0.0" : "11.22.33.44"]);
}

function blockDirectConnect(value: boolean) {
	mockConnect.mockImplementation((_, callback) => {
		if (value) {
			callback(new Error(), null);
		} else {
			callback(null, connect(httpServer.port, "localhost"));
		}
	});
}

// =============================== Tests ===============================

it("should check the proxy string", () => {
	expect(() => new HostBlockVerifier("HTTP [foo]:bar")).toThrow();
});

it("should detect non-blocked hosts", async () => {
	const verifier = new HostBlockVerifier("HTTP [::1]:1080");
	polluteDNS(false);
	blockDirectConnect(false);

	expect(await verifier.verify(ALIVE_SITE)).toBeUndefined();
});

it("should detect DNS pollution", async () => {
	const verifier = new HostBlockVerifier("HTTP [::1]:1080");
	polluteDNS(true);

	expect(await verifier.verify(ALIVE_SITE)).toBe("DNS");
});

it("should detect DNS blocking", async () => {
	const verifier = new HostBlockVerifier("HTTP [::1]:1080");
	mockDNSResolve.mockRejectedValue(Object.assign(new Error(), { code: "ENODATA" }));

	expect(await verifier.verify(ALIVE_SITE)).toBe("DNS");
});

it("should support plain HTTP requests", async () => {
	const verifier = new HostBlockVerifier("HTTP [::1]:1080", {
		protocol: "http",
	});
	polluteDNS(true);

	expect(await verifier.verify(ALIVE_SITE)).toBe("Unavailable");
});

it("should support custom IP black list", async () => {
	mockDNSResolve.mockResolvedValue(["11.22.33.44"]);
	const list = new BlockList();
	list.addAddress("11.22.33.44");

	const verifier = new HostBlockVerifier("HTTP [::1]:1080", {
		blockedIPs: list,
	});
	expect(await verifier.verify(ALIVE_SITE)).toBe("DNS");
});

it("should support custom the timeout", async () => {
	new HostBlockVerifier("HTTP [::1]:1080", {
		timeout: 1234,
	});
	const [directOptions] = mockConnector.mock.calls[0];
	const [, proxyOptions] = mockCreateAgent.mock.calls[0];

	expect(directOptions!.timeout).toBe(1234);
	expect(proxyOptions!.headersTimeout).toBe(1234);
});

it("should detect TCP reset", async () => {
	const verifier = new HostBlockVerifier("HTTP [::1]:1080");
	polluteDNS(false);
	blockDirectConnect(true);

	expect(await verifier.verify(ALIVE_SITE)).toBe("TCP");
	expect(mockConnect.mock.calls[0][0].hostname).toBe("11.22.33.44");
});

it("should detect site down", async () => {
	const verifier = new HostBlockVerifier("HTTP [::1]:1080");
	polluteDNS(false);
	blockDirectConnect(true);

	expect(await verifier.verify(INACCESSIBLE_SITE)).toBe("Unavailable");
});

it("should skip site down detection if no proxy specified", async () => {
	const verifier = new HostBlockVerifier(null);
	polluteDNS(false);
	blockDirectConnect(true);

	expect(await verifier.verify(INACCESSIBLE_SITE)).toBe("TCP");
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
