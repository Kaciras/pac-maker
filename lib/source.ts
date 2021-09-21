import { basename, join } from "path";
import fs, { FSWatcher } from "fs";
import { readFile } from "fs/promises";
import { URL } from "url";
import fetch from "node-fetch";
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

const GFW_LIST_URL = "https://raw.githubusercontent.com/gfwlist/gfwlist/master/gfwlist.txt";

class GFWListSource implements HostnameSource {

	private listeners: ChangeHandler[] = []

	private period: number;
	private lastModified = new Date(0);
	private timer?: NodeJS.Timer;

	constructor(period = 21600) {
		if (period <= 0) {
			throw new Error("Period cannot be zero or negative");
		}
		this.listeners = [];
		this.lastModified = new Date(0);
		this.period = period * 1000;
	}

	async getHostnames() {
		const response = await fetch(GFW_LIST_URL);
		const content = Buffer.from(await response.text(), "base64").toString();

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

	watch(handler: ChangeHandler) {
		const { timer, period, checkUpdate } = this;
		if (!timer) {
			const bound = checkUpdate.bind(this);
			this.timer = setInterval(bound, period);
		}
		this.listeners.push(handler);
	}

	stopWatching() {
		clearInterval(this.timer!);
		this.listeners = [];
	}

	async checkUpdate() {
		const oldTime = this.lastModified.getTime();
		const list = await this.getHostnames();

		if (this.lastModified.getTime() > oldTime) {
			this.listeners.forEach(fn => fn(list));
		}
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
		this.watcher ??= fs.watch(this.path);
		this.watcher.on("change", () => this.getHostnames().then(handler));
	}
}

export class MemorySource implements HostnameSource {

	private listeners: ChangeHandler[] = [];

	private hostnames: string[] = [];

	constructor(hostnames: string[]) {
		this.listeners = [];
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
 * @param period check update interval in seconds
 * @see https://github.com/gfwlist/gfwlist
 */
export function gfwlist(period?: number) {
	return new GFWListSource(period);
}

/**
 * Read hostnames from a text file.
 *
 * The hostname file format:
 * 1) One hostname per line.
 * 2) Any line starts with an hash mark (#) is considered a comment.
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
