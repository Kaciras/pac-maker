import { argv } from "node:process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdirSync, readFileSync, rmSync } from "node:fs";
import { connect } from "node:net";
import { TlsOptions } from "node:tls";
import * as http from "node:http";
import * as https from "node:https";
import { afterAll, afterEach, beforeAll, beforeEach } from "@jest/globals";
import { root } from "../src/utils.js";
import { ofArray } from "../src/source.js";

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

/*
 * Jest's `argv` have no meaning for the test, and they will be
 * set in each case, so there is no need to reset them every case.
 */
export function useArgvMock() {
	let backup: string[];

	beforeAll(() => {
		backup = [...argv];
	});

	beforeAll(() => {
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
	return join(root, "test/fixtures", filename);
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
		fallback: "DIRECT",
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
	proxyReq?: http.IncomingMessage;
}

/**
 * Create a simple HTTP(S) tunnel proxy server.
 *
 * The code is derived from:
 * https://nodejs.org/dist/latest-v19.x/docs/api/http.html#event-connect
 */
export function createTunnelProxy(tls?: TlsOptions) {
	const proxy = tls
		? https.createServer(tls) as unknown as TunnelProxyServer
		: http.createServer() as TunnelProxyServer;

	beforeEach(() => void delete proxy.proxyReq);
	afterAll(done => void proxy.close(done));

	proxy.on("connect", (req, socket, head) => {
		const { port, hostname } = new URL(`http://${req.url}`);
		proxy.proxyReq = req;

		// @ts-expect-error Pass a string to port is ok.
		const serverSocket = connect(port, hostname, () => {
			socket.write("HTTP/1.1 200\r\n\r\n");
			serverSocket.write(head);
			serverSocket.pipe(socket);
			socket.pipe(serverSocket);
		});
	});
	return new Promise(resolve => proxy.listen(resolve)).then(() => proxy);
}
