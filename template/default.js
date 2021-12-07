/*
 * Proxy Auto-Configuration file made by pac-maker v__VERSION__
 * https://github.com/Kaciras/pac-maker
 *
 * Generated at: __TIME__
 *
 * Learn more about PAC file:
 * https://developer.mozilla.org/en-US/docs/Web/HTTP/Proxy_servers_and_tunneling/Proxy_Auto-Configuration_PAC_file
 */

globalThis.fallback = __FALLBACK__;

globalThis.proxies = __PROXIES__;

globalThis.rules = __RULES__;

function FindProxyForURL(url, host) {
	let pos = 0;

	while (pos >= 0) {
		const i = rules[host];
		if (i !== undefined) {
			return proxies[i];
		}
		pos = host.indexOf(".");
		host = host.slice(pos + 1);
	}

	return globalThis.fallback;
}
