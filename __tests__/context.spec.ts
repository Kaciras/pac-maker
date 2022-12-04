import { expect, it } from "@jest/globals";
import { dnsResolve } from "../lib/context.js";

it("should throw if argument is invalid", () => {
	expect(() => dnsResolve(123 as any)).toThrow();
});

it("should do DNS resolve synchronously", () => {
	expect(dnsResolve("localhost")).toBe("127.0.0.1");
});

it("should return null if the address can't found", () => {
	expect(dnsResolve("INVALID")).toBeNull();
});
