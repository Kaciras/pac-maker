import fs from "fs";
import { parse } from "../lib/generator.js";

it("should TODO", () => {
	const pac = fs.readFileSync("dist/pac.js", { encoding: "UTF8" });
	const ctx = parse(pac);
	expect(ctx.FindProxyForURL("", "www.tianshie.com")).toBe("SOCKS5 localhost:2080");
});
