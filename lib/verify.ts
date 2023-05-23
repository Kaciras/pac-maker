import { BlockList, createConnection, IPVersion } from "net";

const blockedIPs = new BlockList();
blockedIPs.addAddress("223.75.236.241"); // 反诈中心
blockedIPs.addAddress("127.0.0.1");

const TIMEOUT = 3_000;
const CONCURRENCY = 10;

async function connectTCP(host: string) {
	const socket = createConnection({ host, port: 443 });
	socket.setTimeout(TIMEOUT);

	const connected = await new Promise(resolve => {
		socket.on("connect", () => resolve(true));
		socket.on("error", () => resolve(false));
		socket.on("timeout", () => resolve(false));
	});

	const family = socket.remoteFamily as IPVersion;
	const ip = socket.remoteFamily!;

	socket.destroy();
	return connected && !blockedIPs.check(ip, family);
}

export async function verify(hosts: string[]) {
	const iterator = hosts[Symbol.iterator]();

	const connected = [];
	const blocked = [];

	async function newWorker(): Promise<void> {
		const { value, done } = iterator.next();
		if (done) {
			return;
		}
		const host = value;
		if (host[0] === "*") {
			return await newWorker();
		}

		if (await connectTCP(host)) {
			connected.push(host);
			console.log(`${host} can be connected directly`);
		} else {
			blocked.push(host);
			console.log(`${host} connect failed`);
		}

		return await newWorker();
	}

	const tasks = [];
	for (let i = 0; i < CONCURRENCY; i++) {
		tasks[i] = newWorker();
	}
	await Promise.all(tasks);

	console.log(`Completed, ${connected.length} hosts are not blocked`);
}
