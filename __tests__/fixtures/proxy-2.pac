/*
 * Proxy Auto-Configuration file made by pac-maker v3.0.0
 * https://github.com/Kaciras/pac-maker
 *
 * Generated at: 2021-06-17T00:00:00.000Z
 *
 * Learn more about PAC file:
 * https://developer.mozilla.org/en-US/docs/Web/HTTP/Proxy_servers_and_tunneling/Proxy_Auto-Configuration_PAC_file
 */

globalThis.fallback = "DIRECT";

globalThis.proxies = [
	"HTTP [::1]:2080",
	"SOCKS5 localhost:1080"
];

globalThis.rules = {
	"kaciras.com": 0,
	"foo.bar": 0,
	"example.com": 1
};

function FindProxyForURL(url, host) {
	let level = 0;
	let pos = 0;

	while (pos >= 0) {
		const i = rules[host];
		if (i !== undefined) {
			return proxies[i];
		}
		if (pos > 0 && level === 1) {
			const i = rules["*." + host];
			if (i !== undefined) {
				return proxies[i];
			}
		}
		pos = host.indexOf(".");
		level += 1;
		host = host.slice(pos + 1);
	}

	return globalThis.fallback;
}
