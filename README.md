# pac-maker

[![npm package](https://img.shields.io/npm/v/pac-maker.svg)](https://npmjs.com/package/pac-maker)
![node-current](https://img.shields.io/node/v/pac-maker)
[![Test](https://github.com/Kaciras/pac-maker/actions/workflows/test.yml/badge.svg)](https://github.com/Kaciras/pac-maker/actions/workflows/test.yml)
[![codecov](https://codecov.io/gh/Kaciras/pac-maker/branch/master/graph/badge.svg?token=2GKPQL8WS5)](https://codecov.io/gh/Kaciras/pac-maker)

[Proxy Auto Configuration (PAC)](https://developer.mozilla.org/en-US/docs/Web/HTTP/Proxy_servers_and_tunneling/Proxy_Auto-Configuration_PAC_file)
file generator & maintenance tool.

Features:

* [Generate PAC files from various hostname sources](#generate-pac-files).
* [Load a PAC file and use it to proxy requests](#PACDispatcher).
* [Serve the PAC with http and watch for source change](#serve).
* [Show what hosts in your browser history will be proxied by the PAC](#analyze).

# Usage

## PAC files

Pre-generated PAC files at `/dist` can be used to bypass GFW:

* [blacklist.pac](https://raw.githubusercontent.com/Kaciras/pac-maker/master/dist/blacklist.pac) forward GFW blocked hostnames to the proxy server, other hostnames will connect directly.
* [whitelist.pac](https://raw.githubusercontent.com/Kaciras/pac-maker/master/dist/whitelist.pac) forward all but China hostnames to the proxy server.

By default, the proxy is `SOCKS5 localhost:2080`, you can change the value to your proxy server address.

Performance:

| file                                                   | Load time (ms) | Memory usage (MB) | FindProxyForURL (μs/op) |
|--------------------------------------------------------|----------------|-------------------|-------------------------|
| blacklist.pac                                          | 3.53           | 0.65              | 0.74                    |
| whitelist.pac                                          | 35.72          | 6.06              | 1.77                    |
| [gfwlist2pac](https://github.com/petronny/gfwlist2pac) | 4.22           | 0.20              | 3355.43                 |

## Install

This package is pure ESM, it cannot be `require()`'d from CommonJS.

```shell
npm install pac-maker
```

## Generate PAC files

pac-maker loads config file from working directory, default is `pac.config.js`, it can be specified by `--config=<path>`
.

config file should export a configuration object:

```javascript
import { builtinList, gfwlist, ofArray } from "pac-maker";

export default {
	/**
	 * Location of the generated PAC file, default is "proxy.pac".
	 */
	path: "proxy.pac",

	/**
	 * Fallback route when no rule matching in `sources`, default is "DIRECT".
	 */
	fallback: "DIRECT",

	/**
	 * Proxy source map, the key is a proxy sorting, value is an array of HostnameSource.
	 * pac-maker will get hostnames from all sources and route them to the corresponding key.
	 */
	sources: {
		"SOCKS5 localhost:2080": [
			gfwlist(),
			builtinList("default"),
			builtinList("forbidden"),
			ofArray(["google.com"]),
		],
	},
};
```

There are some built-in sources in pac-maker:

* `gfwlist` Fetch hostnames from [gfwlist](https://github.com/gfwlist/gfwlist).

* `hostnameFile` Read hostnames from a file, for hostname file example, see
  the [list](https://github.com/Kaciras/pac-maker/tree/master/list) directory.

* `builtinList` Read hostnames from a file in the [list](https://github.com/Kaciras/pac-maker/tree/master/list)
  directory.

* `ofArray` Just use an array of hostnames.

## CLI commands

### `generate`

Generate a PAC file:

```shell
node bin/pac-maker.js generate [--config=<path>] [--watch]
```

* `--watch` After the initial build, pac-maker will continue to watch for updates in any of the sources.

### `analyze`

Find what hosts will be proxied by the PAC in browser history, support Chrome, Firefox, and Edge:

```shell
node bin/pac-maker.js analyze [--config=<path>] [--json=<path>]
```

* `--json` Save matched rules to this file, default is `matches.json`.

### `bench`

Benchmark PAC files, show load time, memory usage, and `FindProxyForURL` performance.

```shell
node bin/pac-maker.js bench <path/to/file.pac> [morefiles...] [--host=example.com] [--loadCount=<number>] [--workCount=<number>]
```

* `--host` The `host` parameter passed to `FindProxyForURL`, default is "www.google.com".
* `--loadCount` Number of load iterations to do, default is 100.
* `--workCount` Number of work iterations to do, default is 1000.

### `serve`

Serve the PAC file with http, and update when source have changes:

```shell
node bin/pac-maker.js serve [--config=<file>] [--host=<host>] [--port=<port>]
```

* `--host` By default, the server will accept connections from all addresses, It is possible to listen to just one
  selected interface using the `host` parameter.

* `--port` The port number that http server to listened on, default is `7568`.

## JavaScript API

pac-maker exports some useful functions that allows you to play with PAC inside your own JavaScript program.

This package is pure ESM, It cannot be `require()`'d from CommonJS.

### `PACDispatcher`

The [undici](https://github.com/nodejs/undici) dispatcher that dispatch requests based on rule described by the PAC. 

It is designed to be used with the built-in `fetch` function. To proxy the requests with the `http` module, we recommend to use [node-pac-proxy-agent](https://github.com/TooTallNate/node-pac-proxy-agent).

```javascript
import { readFileSync } from "fs";
import { PACDispatcher } from "pac-maker";

// Only needed if your Node < 18.1.0
// import { fetch } from "undici";

const pac = readFileSync("proxy.pac", "utf8");
const dispatcher = new PACDispatcher(pac);

const response = await fetch("https://example.com", { dispatcher });
```

### `buildPAC`

Create a PAC script from rules, use the built-in template `template/default.js`.

The function takes two parameters, first is a rules object which key is
a [proxy string](https://developer.mozilla.org/en-US/docs/Web/HTTP/Proxy_servers_and_tunneling/Proxy_Auto-Configuration_PAC_file#return_value_format)
, and value is a hostname array. the second parameter will be returned from `FindProxyForURL` if no hostname matched,
default is `DIRECT`.

```javascript
import { writeFileSync } from "fs";
import { buildPAC } from "pac-maker";

const rules = {
	"HTTP 192.168.0.1:80": ["foo.com", "bar.com"],
	"SOCKS5 localhost:1080": ["example.com"],
};

writeFileSync("proxy.pac", buildPAC(rules));
```

### `loadPAC`

Load and execute a PAC script, return an object includes all global variables defined in the PAC.

```javascript
import { readFileSync } from "fs";
import { loadPAC } from "pac-maker";

const pac = loadPAC(readFileSync("proxy.pac", "utf8"));

console.log(pac.FindProxyForURL("", "example.com"));
```

### `parseProxies`

Parse the return value of `FindProxyForURL()`.

```javascript
import { parseProxies } from "pac-maker";

console.log(parseProxies("HTTP localhost:80; DIRECT"));
```

output:

```
[
  { protocol: "HTTP", host: "localhost:80", port: 80, hostname: "localhost" },
  { protocol: "DIRECT", host: "", port: NaN, hostname: "" }
]
```

### `HostBlockVerifier`

A tool to check which hostnames are blocked by your ISP.

This class is only support HTTP protocol, it cannot be used for
hosts running non-HTTP services.

```javascript
import { HostBlockVerifier } from "pac-maker";

const hosts = ["google.com", "github.com" /* ... */];
const verifier = new HostBlockVerifier("SOCKS5 localhost:1080");
(await verifier.verifyAll(hosts)).print();
```

Test a single hostname and return block type:

```javascript
const reason = await verifier.verify("google.com");
if (reason === "DNS") {
	console.log("DNS cache pollution");
} else if (reason === "TCP") {
	console.log("TCP blocking");
} else if (reason === "Unavailable") {
	console.log("Site may be down");
} else {
	console.log("The host is not blocked");
}
```

### `commands`

All commands supported by `pac-maker` can also be called in JavaScript code.

```javascript
import { commands } from "pac-maker";
import config from "./pac.config.js";

commands.serve({ host: "localhost", port: 12345 }, config);
```

## Run Tests

To run unit tests, you need to enable experimental vm modules.

```shell
NODE_OPTIONS=--experimental-vm-modules
pnpm test
```
