import { basename, join } from "path";
import fs from "fs";
import { readFile } from "fs/promises";
import { URL, URLSearchParams } from "url";
import fetch from "node-fetch";
import { root } from "./utils.js";

const GFW_LIST_URL = "https://raw.githubusercontent.com/gfwlist/gfwlist/master/gfwlist.txt";

class GFWListSource {

	constructor(period = 21600) {
		if (period <= 0) {
			throw new Error("Period must be greater than 1 second");
		}
		this.listeners = [];
		this.lastUpdate = 0;
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
		const params = new URLSearchParams();
		params.set("path", "gfwlist.txt");
		params.set("page", "1");
		params.set("per_page", "1");

		const response = await fetch(`https://api.github.com/repos/gfwlist/gfwlist/commits?${params}`);
		const json = await response.json();
		const date = new Date(json[0].commit.committer.date);

		if (date.getTime() > this.lastUpdate) {
			this.lastUpdate = date.getTime();
			this.listeners.forEach(fn => fn());
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
		this.watcher.on("change", handler);
	}
}

/**
 * Fetch hostnames from https://github.com/gfwlist/gfwlist
 *
 * @return {GFWListSource} hostname list
 */
export function gfwlist() {
	return new GFWListSource();
}

/**
 * Read hostnames from rule file.
 *
 * @param path the file path
 * @return {HostnameFileSource} hostname list
 */
export function hostnameFile(path) {
	return new HostnameFileSource(path);
}

/**
 * Read hostnames from built-in rule file.
 *
 * @param name filename without extension
 * @return {HostnameFileSource} hostname list
 */
export function builtInList(name) {
	if (name !== basename(name)) {
		throw new Error("Invalid hostname list: " + name);
	}
	return hostnameFile(join(root, "list", name + ".txt"));
}
