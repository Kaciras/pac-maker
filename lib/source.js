import { basename, join } from "path";
import fs from "fs";
import { readFile } from "fs/promises";
import { URL } from "url";
import fetch from "node-fetch";
import { root } from "./utils.js";

const GFW_LIST_URL = "https://raw.githubusercontent.com/gfwlist/gfwlist/master/gfwlist.txt";

class GFWListSource {

	constructor(period = 21600) {
		if (period <= 0) {
			throw new Error("Period must be greater than 1 second");
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

	watch(handler) {
		const { timer, period, checkUpdate } = this;
		if (!timer) {
			const bound = checkUpdate.bind(this);
			this.timer = setInterval(bound, period);
		}
		this.listeners.push(handler);
	}

	async checkUpdate() {
		const oldTime = this.lastModified.getTime();
		const list = await this.getHostnames();

		if (this.lastModified.getTime() > oldTime) {
			this.listeners.forEach(fn => fn(list));
		}
	}
}

class HostnameFileSource {

	constructor(path) {
		this.path = path;
	}

	async getHostnames() {
		const content = await readFile(this.path, "utf8");
		return content.split("\n")
			.map(line => line.trim())
			.filter(line => line.length > 0 && !line.startsWith("#"));
	}

	watch(handler) {
		this.watcher ??= fs.watch(this.path);
		this.watcher.on("change", () => this.getHostnames().then(handler));
	}
}

class MemoryHostnameSource {

	constructor(hostnames) {
		this.hostnames = hostnames;
		this.listeners = [];
	}

	getHostnames() {
		return Promise.resolve(this.hostnames);
	}

	watch(handler) {
		this.listeners.push(handler);
	}

	update(newValues = this.hostnames) {
		this.hostnames = newValues;
		this.listeners.forEach(fn => fn(newValues));
	}
}

/**
 * Fetch hostnames from https://github.com/gfwlist/gfwlist
 *
 * @param period check update interval in seconds
 */
export function gfwlist(period) {
	return new GFWListSource(period);
}

/**
 * Read hostnames from rule file.
 *
 * @param path the file path
 */
export function hostnameFile(path) {
	return new HostnameFileSource(path);
}

/**
 * Read hostnames from built-in rule file.
 *
 * @param name filename without extension
 */
export function builtinList(name) {
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
export function arraySource(hostnames) {
	return new MemoryHostnameSource(hostnames);
}
