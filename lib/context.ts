// noinspection JSUnusedGlobalSymbols

/*
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The original code is mozilla.org code:
 * https://searchfox.org/mozilla-central/source/netwerk/base/ProxyAutoConfig.cpp
 *
 * The Initial Developer of the Original Code is
 * Netscape Communications Corporation.
 * Portions created by the Initial Developer are Copyright (C) 1998
 * the Initial Developer. All Rights Reserved.
 *
 * Modifications copyright (C) 2021 Kaciras <kaciras@protonmail.com>
 */
import { isIPv4 } from "net";
import dns from "dns";
import { deasync } from "@kaciras/deasync";

let dnsLookupSync: (host: string, family: number) => string;

/**
 * Resolves the given DNS hostname into an IP address,
 * and returns it in the dot-separated format as a string.
 *
 * @param host hostname to resolve.
 * @see https://nodejs.org/dist/latest-v19.x/docs/api/dns.html#dnslookuphostname-options-callback
 */
export function dnsResolve(host: string) {
	if (!dnsLookupSync) {
		dnsLookupSync = deasync<void, [string, number], string>(dns.lookup);
		console.warn("Warning: since Node doesn't provide a synchronous DNS API, pac-maker " +
			"converts dns.resolve into sync by polling the event loop, this may cause bad performance.");
	}
	try {
		return dnsLookupSync(host, 4);
	} catch (error) {
		switch (error.code) {
			case "ENOTFOUND":	// DNS respond, not found.
			case "EAI_AGAIN":	// DNS lookup timed out.
				return null;
			default:
				throw error;	// Should we return null in all cases?
		}
	}
}

// We don't test following third party code.
// Stryker disable all

/**
 * Returns true if and only if the domain of hostname matches.
 *
 * @param host Is the hostname from the URL.
 * @param domain Is the domain name to test the hostname against.
 */
export function dnsDomainIs(host: string, domain: string) {
	const d = host.length - domain.length;
	return d >= 0 && host.substring(d) === domain;
}

/**
 * Returns the number (integer) of DNS domain levels (number of dots) in the hostname.
 *
 * @param host is the hostname from the URL.
 */
export function dnsDomainLevels(host: string) {
	return host.split(".").length - 1;
}

/**
 * Logs the message in the browser console.
 *
 * @param message The string to log
 */
export function alert(message: string) {
	console.log(message);
}

/**
 * Concatenates the four dot-separated bytes into one 4-byte word and converts it to decimal.
 *
 * @param ipaddr Any dotted address such as an IP address or mask.
 */
export function convert_addr(ipaddr: string) {
	const bytes = ipaddr.split(".");
	return (parseInt(bytes[3]) & 0xFF)
		| ((parseInt(bytes[2]) & 0xFF) << 8)
		| ((parseInt(bytes[1]) & 0xFF) << 16)
		| ((parseInt(bytes[0]) & 0xFF) << 24);
}

/**
 * True if and only if the IP address of the host matches the specified IP address pattern.
 * Pattern and mask specification is done the same way as for SOCKS configuration.
 *
 * @param ipaddr a DNS hostname, or IP address. If a hostname is passed,
 *               it will be resolved into an IP address by this function.
 * @param pattern an IP address pattern in the dot-separated format.
 * @param maskstr mask for the IP address pattern informing which parts of the
 *                IP address should be matched against. 0 means ignore, 255 means match.
 */
export function isInNet(ipaddr: string, pattern: string, maskstr: string) {
	if (!isIPv4(pattern) || !isIPv4(maskstr)) {
		return false;
	}
	if (!isIPv4(ipaddr)) {
		ipaddr = dnsResolve(ipaddr) as any;
		if (ipaddr === null) {
			return false;
		}
	}
	const host = convert_addr(ipaddr);
	const pat = convert_addr(pattern);
	const mask = convert_addr(maskstr);
	return ((host & mask) === (pat & mask));
}

/**
 * Return true if and only if there is no domain name in the hostname (no dots).
 *
 * @param host The hostname from the URL (excluding port number).
 */
export function isPlainHostName(host: string) {
	return (host.search("(\\.)|:") === -1);
}

/**
 * Tries to resolve the hostname. Returns true if succeeds.
 *
 * @param host is the hostname from the URL.
 */
export function isResolvable(host: string) {
	return dnsResolve(host) !== null;
}

/**
 * Is true if the hostname matches exactly the specified hostname,
 * or if there is no domain name part in the hostname, but the unqualified hostname matches.
 *
 * @param host The hostname from the URL.
 * @param hostdom Fully qualified hostname to match against.
 */
export function localHostOrDomainIs(host: string, hostdom: string) {
	return (host === hostdom) || (hostdom.lastIndexOf(host + ".", 0) === 0);
}

/**
 * Returns true if the string matches the specified shell glob expression.
 *
 * Support for particular glob expression syntax leties across browsers: * (match any number of characters)
 * and ? (match one character) are always supported,
 * while [characters] and [^characters] are additionally supported by some implementations (including Firefox).
 *
 * @param str is any string to compare (e.g. the URL, or the hostname).
 * @param shexp is a shell expression to compare against.
 */
export function shExpMatch(str: string, shexp: string) {
	shexp = shexp.replace(/\./g, "\\.");
	shexp = shexp.replace(/\*/g, ".*");
	shexp = shexp.replace(/\?/g, ".");
	return new RegExp("^" + shexp + "$").test(str);
}

const months: Record<string, number> = {
	JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5, JUL: 6,
	AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11,
};

const wdays: Record<string, number> = {
	SUN: 0, MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6,
};

function getMonth(name: string) {
	return months[name] ?? -1;
}

function getDay(weekday: string) {
	return wdays[weekday] ?? -1;
}

/**
 * Only the first parameter is mandatory. Either the second, the third, or both may be left out.
 *
 * If only one parameter is present, the function returns a value of true on the weekday
 * that the parameter represents. If the string "GMT" is specified as a second parameter,
 * times are taken to be in GMT. Otherwise, they are assumed to be in the local timezone.
 *
 * If both wd1 and wd1 are defined, the condition is true if the current weekday is in
 * between those two ordered weekdays. Bounds are inclusive, but the bounds are ordered.
 * If the "GMT" parameter is specified, times are taken to be in GMT. Otherwise, the local timezone is used.
 *
 * @param wd1 One of the ordered weekday strings.
 * @param wd2 One of the ordered weekday strings.
 * @param gmt Is either the string "GMT" or is left out.
 */
export function weekdayRange(wd1: string, wd2?: string, gmt?: "GMT") {
	const date = new Date();
	const wday = gmt === "GMT" ? date.getUTCDay() : date.getDay();

	const v1 = getDay(wd1);
	const v2 = wd2 ? getDay(wd2) : v1;

	if (v1 === -1 || v2 === -1) {
		return false;
	}
	if (v1 <= v2) {
		return v1 <= wday && wday <= v2;
	} else {
		return v2 >= wday || wday >= v1;
	}
}

function convertToUTC(date: Date) {
	date.setFullYear(date.getUTCFullYear());
	date.setMonth(date.getUTCMonth());
	date.setDate(date.getUTCDate());
	date.setHours(date.getUTCHours());
	date.setMinutes(date.getUTCMinutes());
	date.setSeconds(date.getUTCSeconds());
}

/**
 * If only a single value is specified (from each category: day, month, year),
 * the function returns a true value only on days that match that specification.
 * If both values are specified, the result is true between those times,
 * including bounds, but the bounds are ordered.
 */
export function dateRange(...argv: any[]) {
	let argc = argv.length;
	if (argc < 1) {
		return false;
	}
	const date = new Date();
	const isGMT = (argv[argc - 1] === "GMT");

	if (isGMT) {
		argc--;
	}

	// export function will work even without explict handling of this case
	if (argc === 1) {
		const tmp = parseInt(argv[0]);
		if (isNaN(tmp)) {
			return ((isGMT ? date.getUTCMonth() : date.getMonth()) === getMonth(argv[0]));
		} else if (tmp < 32) {
			return ((isGMT ? date.getUTCDate() : date.getDate()) === tmp);
		} else {
			return ((isGMT ? date.getUTCFullYear() : date.getFullYear()) === tmp);
		}
	}

	const year = date.getFullYear();
	const date1 = new Date(year, 0, 1, 0, 0, 0);
	const date2 = new Date(year, 11, 31, 23, 59, 59);
	let adjustMonth = false;

	for (let i = 0; i < (argc >> 1); i++) {
		const tmp = parseInt(argv[i]);
		if (isNaN(tmp)) {
			const mon = getMonth(argv[i]);
			date1.setMonth(mon);
		} else if (tmp < 32) {
			adjustMonth = (argc <= 2);
			date1.setDate(tmp);
		} else {
			date1.setFullYear(tmp);
		}
	}

	for (let i = (argc >> 1); i < argc; i++) {
		const tmp = parseInt(argv[i]);
		if (isNaN(tmp)) {
			const mon = getMonth(argv[i]);
			date2.setMonth(mon);
		} else if (tmp < 32) {
			date2.setDate(tmp);
		} else {
			date2.setFullYear(tmp);
		}
	}

	if (adjustMonth) {
		date1.setMonth(date.getMonth());
		date2.setMonth(date.getMonth());
	}

	if (isGMT) {
		convertToUTC(date);
	}

	if (date1 <= date2) {
		return (date1 <= date) && (date <= date2);
	} else {
		return (date2 >= date) || (date >= date1);
	}
}

/**
 * If only a single value is specified (from each category: hour, minute, second),
 * the function returns a true value only at times that match that specification.
 * If both values are specified, the result is true between those times,
 * including bounds, but the bounds are ordered.
 */
export function timeRange(...argv: any[]) {
	let argc = argv.length;
	if (argc < 1) {
		return false;
	}

	let isGMT = false;
	if (argv[argc - 1] === "GMT") {
		argc--;
		isGMT = true;
	}

	const date = new Date();
	const hour = isGMT ? date.getUTCHours() : date.getHours();

	const date1 = new Date();
	const date2 = new Date();
	const middle = argc >> 1;

	if (argc === 1) {
		return (hour === argv[0]);
	} else if (argc === 2) {
		return ((argv[0] <= hour) && (hour <= argv[1]));
	} else {
		switch (argc) {
			case 6:
				date1.setSeconds(argv[2]);
				date2.setSeconds(argv[5]);
			// eslint-disable-next-line no-fallthrough
			case 4:
				date1.setHours(argv[0]);
				date1.setMinutes(argv[1]);
				date2.setHours(argv[middle]);
				date2.setMinutes(argv[middle + 1]);
				if (middle === 2) {
					date2.setSeconds(59);
				}
				break;
			default:
				throw new Error("timeRange: bad number of arguments");
		}
	}

	if (isGMT) {
		convertToUTC(date);
	}

	if (date1 <= date2) {
		return (date1 <= date) && (date <= date2);
	} else {
		return (date2 >= date) || (date >= date1);
	}
}
