# pac-maker

[![npm package](https://img.shields.io/npm/v/pac-maker.svg)](https://npmjs.com/package/pac-maker)
![node-current](https://img.shields.io/node/v/pac-maker)
[![Test](https://github.com/Kaciras/pac-maker/actions/workflows/test.yml/badge.svg)](https://github.com/Kaciras/pac-maker/actions/workflows/test.yml)

[Proxy Auto Configuration (PAC)](https://developer.mozilla.org/en-US/docs/Web/HTTP/Proxy_servers_and_tunneling/Proxy_Auto-Configuration_PAC_file)
file generator & maintenance tool.

Features:

* [Generate PAC files from various hostname sources](#generate-pac-files).
* [Load a PAC file and use it to proxy requests](#PACDispatcher).
* [Serve the PAC with http and watch for source change](#serve).
* [Show what hosts in your browser history will be proxied by the PAC](#analyze).

# Usage

## PAC files

The pre-generated PAC file at `/dist` can be used to bypass GFW:

* [blacklist.pac](https://raw.githubusercontent.com/Kaciras/pac-maker/master/dist/blacklist.pac) forward GFW blocked hostnames to the proxy server, other hostnames will connect directly.
* [whitelist.pac](https://raw.githubusercontent.com/Kaciras/pac-maker/master/dist/whitelist.pac) forward all but China hostnames to the proxy server.

By default, the proxy is `SOCKS5 localhost:2080`, you can change the value to your proxy server address.

Performance:

| file          | Load time (ms) | FindProxyForURL (μs/op) | Memory usage (MB) |
|---------------|----------------|-------------------------|-------------------|
| blacklist.pac | 3.25           | 0.74                    | 0.79              |
| whitelist.pac | 37.54          | 1.35                    | 6.12              |

## Install

pac-maker requires NodeJS >= 16.

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
	path: "dist/proxy.pac",
	direct: "DIRECT",
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

* `ofArray` Just use an array of hostnames

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
node bin/pac-maker.js bench <path/to/file.pac> [morefiles...]
```

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
