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

const { HostBlockVerifier, BlockType } = await import("../lib/verify.js");

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

it("should detect non-blocked hosts", async () => {
	mockDNSResolve.mockResolvedValue(["11.22.33.44"]);
	setupMockConnect(true);

	const verifier = new HostBlockVerifier("HTTP [::1]:1080");
	expect(await verifier.verify("example.com")).toBeUndefined();
});

it("should detect DNS pollution", async () => {
	mockDNSResolve.mockResolvedValue(["127.0.0.1"]);

	const verifier = new HostBlockVerifier("HTTP [::1]:1080");
	expect(await verifier.verify("example.com")).toBe(BlockType.dns);
});

it("should detect DNS blocking", async () => {
	mockDNSResolve.mockRejectedValue(Object.assign(new Error(), { code: "ENODATA" }));

	const verifier = new HostBlockVerifier("HTTP [::1]:1080");
	expect(await verifier.verify("example.com")).toBe(BlockType.dns);
});

it("should support plain HTTP requests", async () => {
	mockDNSResolve.mockResolvedValue(["127.0.0.1"]);

	const verifier = new HostBlockVerifier("HTTP [::1]:1080", {
		protocol: "http",
	});
	expect(await verifier.verify("example.com")).toBe(BlockType.unavailable);
});

it("should support custom IP black list", async () => {
	mockDNSResolve.mockResolvedValue(["11.22.33.44"]);
	const list = new BlockList();
	list.addAddress("11.22.33.44");

	const verifier = new HostBlockVerifier("HTTP [::1]:1080", {
		blockedIPs: list,
	});
	expect(await verifier.verify("example.com")).toBe(BlockType.dns);
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

	expect(await verifier.verify("example.com")).toBe(BlockType.tcp);
	expect(mockConnect.mock.calls[0][0].hostname).toBe("11.22.33.44");
});

it("should detect site down", async () => {
	mockDNSResolve.mockResolvedValue(["11.22.33.44"]);
	setupMockConnect(false);

	const verifier = new HostBlockVerifier("HTTP [::1]:1080");
	expect(await verifier.verify("foo.bar")).toBe(BlockType.unavailable);
});

it("should support batch verify", async () => {
	const verifier = new HostBlockVerifier("HTTP [::1]:1080");
	verifier.verify = jest.fn<typeof verifier.verify>(async () => BlockType.dns);

	const task = verifier.verifyAll(["foo", "bar", "baz"], 2);
	expect(verifier.verify).toHaveBeenCalledTimes(2);

	expect(await task).toStrictEqual({ foo: BlockType.dns, bar: BlockType.dns, baz: BlockType.dns });
});
