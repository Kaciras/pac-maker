import { basename, join } from "path";
import { FSWatcher, watch } from "fs";
import { readFile } from "fs/promises";
import { Dispatcher, fetch } from "undici";
import { root } from "./utils.js";

export type ChangeHandler = (newValues: string[]) => void;

export interface HostnameSource {

	/**
	 * Watch for changes on the source.
	 */
	watch(handler: ChangeHandler): void;

	/**
	 * Stop watching and clear all handlers.
	 */
	stopWatching(): void;

	/**
	 * Get hostname list from source.
	 */
	getHostnames(): Promise<string[]>;
}

abstract class RemoteSource implements HostnameSource {

	private readonly period: number;

	private listeners: ChangeHandler[] = [];
	private timer?: NodeJS.Timer;

	protected lastModified = new Date(0);

	protected constructor(period = 86400) {
		if (period <= 0) {
			throw new Error("Period cannot be zero or negative");
		}
		this.period = period * 1000;
	}

	abstract getHostnames(): Promise<string[]>;

	getLastModified(): Promise<Date | undefined> {
		return Promise.resolve(undefined);
	}

	watch(handler: ChangeHandler) {
		const { timer, period, checkUpdate } = this;
		if (!timer) {
			const bound = checkUpdate.bind(this);
			this.timer = setInterval(bound, period);
		}
		this.listeners.push(handler);
	}

	stopWatching() {
		clearInterval(this.timer);
		this.listeners = [];
		this.timer = undefined;
	}

	async checkUpdate() {
		const oldTime = this.lastModified.getTime();
		const newDate = await this.getLastModified();

		if (newDate) {
			if (newDate.getTime() <= oldTime) {
				return;
			}
			this.lastModified = newDate;
		}

		const list = await this.getHostnames();

		if (this.lastModified.getTime() > oldTime) {
			this.listeners.forEach(fn => fn(list));
		}
	}
}

interface HttpSourceOptions {

	/**
	 * Check update interval in seconds.
	 *
	 * @default 21600
	 */
	period?: number;

	/**
	 * The undici dispatcher to use when fetching the GFW list.
	 */
	dispatcher?: Dispatcher;
}

const GFW_LIST_URL = "https://raw.githubusercontent.com/gfwlist/gfwlist/master/gfwlist.txt";

class GFWListSource extends RemoteSource {

	private readonly dispatcher?: Dispatcher;

	constructor(options: HttpSourceOptions) {
		super(options.period ?? 21600);
		this.dispatcher = options.dispatcher;
	}

	async getHostnames() {
		const { dispatcher } = this;

		const response = await fetch(GFW_LIST_URL, { dispatcher });
		const text = await response.text();
		const content = Buffer.from(text, "base64").toString();

		const result = [];

		for (let line of content.split("\n")) {
			if (line.includes("General List End")) {
				break; // rules after this are unusable
			}
			if (line.startsWith("! Last Modified: ")) {
				this.lastModified = new Date(line.slice(17));
			}
			if (/^\s*$/.test(line)) {
				continue; // blank line
			}
			if (/^[[!]/.test(line)) {
				continue; // comment
			}
			if (line.startsWith("/")) {
				continue; // regexp
			}
			if (line.startsWith("@@")) {
				continue; // white list
			}
			if (line.includes("*")) {
				continue; // wildcard is not supported
			}

			line = line.replaceAll(/^[|.]+/g, "");
			if (!/^https?:/.test(line)) {
				line = "http://" + line;
			}
			result.push(new URL(decodeURIComponent(line)).hostname);
		}

		return result;
	}
}

const DCL_URL = "https://raw.githubusercontent.com/felixonmars/dnsmasq-china-list/master/*.china.conf";

export class DnsmasqLists extends RemoteSource {

	private readonly name: string;
	private readonly dispatcher?: Dispatcher;

	constructor(name: string, options: HttpSourceOptions = {}) {
		super(options.period ?? 86400);
		this.name = name;
		this.dispatcher = options.dispatcher;
	}

	async getHostnames() {
		const { dispatcher, name } = this;

		const response = await fetch(DCL_URL.replace("*", name), { dispatcher });
		const text = await response.text();

		return text.split(/\n+/)
			.filter(v => v[0] !== "#")  // skip commented lines.
			.map(v => v.slice(8, -16))  // server=/<sliced>/114.114.114.114
			.slice(0, -1);				// remove the last empty string.
	}

	async getLastModified() {
		const { name, dispatcher } = this;
		const url = `https://api.github.com/repos/felixonmars/dnsmasq-china-list/commits?path=${name}.china.conf&page=1&per_page=1`;

		const response = await fetch(url, { dispatcher });
		const entries: any = await response.json();
		return new Date(entries[0].commit.committer.date);
	}
}

class HostnameFileSource implements HostnameSource {

	private readonly path: string;

	private watcher?: FSWatcher;

	constructor(path: string) {
		this.path = path;
	}

	async getHostnames() {
		const content = await readFile(this.path, "utf8");
		return content.split("\n")
			.map(line => line.trim())
			.filter(line => line.length > 0 && !line.startsWith("#"));
	}

	stopWatching() {
		this.watcher?.close();
	}

	watch(handler: ChangeHandler) {
		this.watcher ??= watch(this.path, () => this.getHostnames().then(handler));
	}
}

export class MemorySource implements HostnameSource {

	private listeners: ChangeHandler[] = [];

	private hostnames: string[];

	constructor(hostnames: string[]) {
		this.hostnames = hostnames;
	}

	getHostnames() {
		return Promise.resolve(this.hostnames);
	}

	watch(handler: ChangeHandler) {
		this.listeners.push(handler);
	}

	stopWatching() {
		this.listeners = [];
	}

	update(newValues: string[]) {
		this.hostnames = newValues;
		this.listeners.forEach(fn => fn(newValues));
	}
}

/**
 * Fetch hostnames from gfwlist project.
 *
 * @see https://github.com/gfwlist/gfwlist
 */
export function gfwlist(options: HttpSourceOptions = {}) {
	return new GFWListSource(options);
}

/**
 * Read hostnames from a text file.
 *
 * The hostname file format:
 * 1) One hostname per line.
 * 2) Any line starts with a hash mark (#) is considered a comment.
 * 3) White spaces and empty lines are ignored.
 *
 * @param path the file path
 */
export function hostnameFile(path: string) {
	return new HostnameFileSource(path);
}

/**
 * Read hostnames from built-in text file.
 * These files are in the /list folder.
 *
 * @param name filename without extension
 */
export function builtinList(name: string) {
	if (name !== basename(name)) {
		throw new Error("Invalid list name: " + name);
	}
	return hostnameFile(join(root, "list", name + ".txt"));
}

/**
 * Create a hostname source from arrays.
 *
 * @param hostnames array of hostnames
 */
export function ofArray(hostnames: string[]) {
	return new MemorySource(hostnames);
}
