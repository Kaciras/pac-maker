const array = new Array(22 * 1024);

const loadStart = Date.now();
while (Date.now() - loadStart < 10);

function FindProxyForURL(url, host) {
	const findStart = Date.now();
	while (Date.now() - findStart < 5);

	return "SOCKS5 localhost:1080";
}
