import { copyFileSync, readFileSync } from "fs";
import { join } from "path";
import { expect, it } from "@jest/globals";
import waitFor from "wait-for-expect";
import { fixturePath, getTestConfig, readFixture, testDir, useTempDirectory } from "../share.js";
import generate from "../../lib/command/generate.js";

const stubPAC1 = readFixture("proxy-1.pac");
const stubPAC2 = readFixture("proxy-2.pac");

useTempDirectory(testDir);

function waitForCalledNth(mockedFn: any, n : number) {
	// @ts-ignore https://github.com/vitejs/vite/issues/10481#issuecomment-1280335703
	return waitFor(() => expect(mockedFn).toHaveBeenCalledTimes(n));
}

it("should generate PAC file", async () => {
	const config = getTestConfig();
	config.path = join(testDir, "deep", "path", "proxy.pac");

	await generate({}, config);

	const [message] = (console.info as any).mock.calls[0];
	expect(message).toContain("PAC updated.");
	expect(readFileSync(config.path, "utf8")).toBe(stubPAC1);
});

it("should log changed hostname count", async () => {
	const config = getTestConfig();
	copyFileSync(fixturePath("proxy-1.pac"), config.path);

	config.sources["HTTP [::1]:2080"][0].update(["kaciras.com", "some.host"]);

	await generate({}, config);

	const [message] = (console.info as any).mock.calls[0];
	expect(message).toContain("PAC updated. [92m2+[39m, [91m1-[39m.");
});

it("should rebuild when source have updates", async () => {
	const config = getTestConfig();
	await generate({ watch: true }, config).then();
	await waitForCalledNth(console.info, 2);

	config.sources["HTTP [::1]:2080"][0].update(["kaciras.com", "foo.bar"]);
	await waitForCalledNth(console.info, 3);

	expect(readFileSync(config.path, "utf8")).toBe(stubPAC2);
});
