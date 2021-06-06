// This PAC used to test predefined functions

function FindProxyForURL(url, host) {
	return dnsDomainLevels(host);
}
