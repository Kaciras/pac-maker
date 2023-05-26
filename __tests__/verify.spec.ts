import { connect } from "net";
import { afterAll, beforeAll, expect, it, jest } from "@jest/globals";
import { buildConnector, MockAgent } from "undici";
import { getLocal } from "mockttp";

const mockProxyAgent = new MockAgent();
mockProxyAgent.disableNetConnect();
mockProxyAgent.get("https://example.com")
	.intercept({ path: "/" })
	.reply(200, "Access OK");

const mockDNSResolve = jest.fn<any>();
const mockCreateAgent = jest.fn<any>(() => mockProxyAgent);
const mockConnect = jest.fn<buildConnector.connector>();

jest.unstable_mockModule("dns/promises", () => ({
	resolve: mockDNSResolve,
}));

jest.unstable_mockModule("undici", async () => ({
	...jest.requireActual("undici") as any,
	buildConnector: () => mockConnect,
}));

jest.unstable_mockModule("../lib/proxy.js", () => ({
	createAgent: mockCreateAgent,
}));

const { HostBlockVerifier, BlockType } = await import("../lib/verify.js");

const httpServer = getLocal();
beforeAll(() => httpServer.start());
afterAll(() => httpServer.stop());

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

it("should detect TCP reset", async () => {
	mockDNSResolve.mockResolvedValue(["11.22.33.44"]);
	mockConnect.mockImplementation((o, c) => c(new Error(), null));

	const verifier = new HostBlockVerifier("HTTP [::1]:1080");
	expect(await verifier.verify("example.com")).toBe(BlockType.tcp);
});

it("should detect site down", async () => {
	mockDNSResolve.mockResolvedValue(["11.22.33.44"]);
	mockConnect.mockImplementation((o, c) => c(new Error(), null));

	const verifier = new HostBlockVerifier("HTTP [::1]:1080");
	expect(await verifier.verify("foo.bar")).toBe(BlockType.unavailable);
});

it("should detect non-blocked hosts", async () => {
	mockDNSResolve.mockResolvedValue(["11.22.33.44"]);
	mockConnect.mockImplementation((o, c) => {
		httpServer.forAnyRequest().thenReply(200);
		c(null, connect(httpServer.port, "localhost"));
	});

	const verifier = new HostBlockVerifier("HTTP [::1]:1080");
	expect(await verifier.verify("example.com")).toBeUndefined();
});
