import fs from "fs";
import { buildPac, BuiltInPacGlobals, loadPac } from "../lib/generator";

it("should load PAC script", () => {
	const pac = fs.readFileSync("__tests__/fixtures/proxy.pac", "utf8");
	const { direct, proxies, rules, FindProxyForURL } = loadPac<BuiltInPacGlobals>(pac);

	expect(direct).toBe("DIRECT");
	expect(proxies).toEqual(["SOCKS5 localhost:1080"]);
	expect(rules).toEqual({ "example.com": 0 });

	expect(FindProxyForURL("", "")).toBe("DIRECT");
	expect(FindProxyForURL("", "com")).toBe("DIRECT");
	expect(FindProxyForURL("", "example.com")).toBe("SOCKS5 localhost:1080");
	expect(FindProxyForURL("", "www.example.com")).toBe("SOCKS5 localhost:1080");
});

it("should build PAC script", async () => {
	const code = await buildPac({
		direct: "DIRECT",
		domains: {
			"SOCKS5 localhost:1080": ["example.com"],
			"HTTP [::1]:2080": ["foo.bar"],
		},
	});
	const { FindProxyForURL } = loadPac(code);

	expect(FindProxyForURL("", "")).toBe("DIRECT");
	expect(FindProxyForURL("", "com")).toBe("DIRECT");
	expect(FindProxyForURL("", "example.com")).toBe("SOCKS5 localhost:1080");
	expect(FindProxyForURL("", "www.example.com")).toBe("SOCKS5 localhost:1080");
});
