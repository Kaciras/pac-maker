import { argv } from "process";
import { tmpdir } from "os";
import { join } from "path";
import { mkdirSync, readFileSync, rmSync } from "fs";
import * as http from "http";
import { connect } from "net";
import { afterEach, beforeEach } from "@jest/globals";
import { root } from "../lib/utils.js";
import { ofArray } from "../lib/source.js";

export const mockTime = Date.UTC(2021, 5, 17);

/**
 * The temporary directory to save test working data.
 */
export const testDir = join(tmpdir(), "pac-maker");

/**
 * Ensure the directory exists before tests and delete it after.
 *
 * @param path A path to a directory
 */
export function useTempDirectory(path: string) {
	beforeEach(() => {
		mkdirSync(path, { recursive: true });
	});
	afterEach(() => {
		rmSync(path, { force: true, recursive: true });
	});
}

export function useArgvMock() {
	let backup: string[];

	beforeEach(() => {
		backup = [...argv];
	});

	afterEach(() => {
		argv.length = 0;
		argv.push(...backup);
	});

	return (...args: string[]) => {
		argv.length = 2;
		argv.push(...args);
	};
}

/**
 * Get the absolute path of the fixture file.
 *
 * @param filename file name
 */
export function fixturePath(filename: string) {
	return join(root, "__tests__/fixtures", filename);
}

/**
 * Read test fixture file as string.
 */
export function readFixture(filename: string) {
	return readFileSync(fixturePath(filename), "utf8");
}

export function getTestConfig() {
	return {
		path: join(testDir, "proxy.pac"),
		direct: "DIRECT",
		sources: {
			"HTTP [::1]:2080": [
				ofArray(["foo.bar"]),
			],
			"SOCKS5 localhost:1080": [
				ofArray(["example.com"]),
			],
		},
	};
}

export interface TunnelProxyServer extends http.Server {

	/**
	 * The latest connect request to the server, used for assertion.
	 */
	proxyReq: http.IncomingMessage;
}

/**
 * Create a simple HTTP tunnel proxy server. The code is derived from:
 * https://nodejs.org/dist/latest-v19.x/docs/api/http.html#event-connect
 */
export function createTunnelProxy() {
	const proxy = http.createServer() as TunnelProxyServer;
	proxy.on("connect", (req, socket, head) => {
		const { port, hostname } = new URL(`http://${req.url}`);
		proxy.proxyReq = req;

		// @ts-ignore Pass a string to port is ok.
		const serverSocket = connect(port, hostname, () => {
			socket.write("HTTP/1.1 200\r\n\r\n");
			serverSocket.write(head);
			serverSocket.pipe(socket);
			socket.pipe(serverSocket);
		});
	});
	return new Promise(resolve => proxy.listen(resolve)).then(() => proxy);
}
