# pac-maker

[Proxy Auto Configuration (PAC)](https://developer.mozilla.org/en-US/docs/Web/HTTP/Proxy_servers_and_tunneling/Proxy_Auto-Configuration_PAC_file) file generator & maintenance tool.

# Usage

Just use pre-generated PAC file: [proxy.pac](https://raw.githubusercontent.com/Kaciras/pac-maker/master/dist/proxy.pac)

## Install

pac-maker requires NodeJS >= 16, older version is not tested.

```shell
npm install pac-maker
```

## Configuration

pac-maker loads config file from working directory, default is `pac.config.js`, it can be specified by `--config=<path>`
.

config file should export a configuration object:

```javascript
import { builtinList, gfwlist } from "pac-maker";

export default {
	path: "dist/proxy.pac",
	direct: "DIRECT",
	sources: {
		"SOCKS5 localhost:2080": [
			gfwlist(),
			builtinList("default"),
			builtinList("forbidden"),
		],
	},
};
```

There are some sources provided by pac-maker:

* `gfwlist` Fetch hostnames from [gfwlist](https://github.com/gfwlist/gfwlist).

* `hostnameFile` Read hostnames from a file, for hostname file example, see the [list](https://github.com/Kaciras/pac-maker/tree/master/list) directory.

* `builtinList` Read hostnames from a file in the [list](https://github.com/Kaciras/pac-maker/tree/master/list) directory.

* `ofArray` Convert an array to source, e.g. `ofArray(["foo.com", "bar.com"])`.

## Commands

Generate a PAC file:

```shell
node bin/pac-maker.js generate [--config=<path>] [--watch]
```

* `--watch` After the initial build, pac-maker will continue to watch for updates in any of the sources.

Find what hosts will be proxied by PAC in browser history, support Chrome, Firefox, and Edge:

```shell
node bin/pac-maker.js analyze [--config=<path>] [--json=<path>]
```

* `--json` Save matched rules to this file, default is `matches.json`.

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

### `buildPAC`

Create a PAC script from rules, use the built-in template `template/default.js`. 

The function takes two parameters, first is a rules object which key is a [proxy string](https://developer.mozilla.org/en-US/docs/Web/HTTP/Proxy_servers_and_tunneling/Proxy_Auto-Configuration_PAC_file#return_value_format), and value is a hostname array. the second parameter will be returned from `FindProxyForURL` if no hostname matched, default is `DIRECT`.

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

Load and execute PAC script, return an object includes all global variables defined in the PAC.

```javascript
import { readFileSync } from "fs";
import { loadPAC } from "pac-maker";

const { FindProxyForURL } = loadPAC(readFileSync("proxy.pac", "utf8"));

console.log(FindProxyForURL("", "example.com"));
```

### `commands`

All commands supported by `pac-maker` can also be called in JavaScript code.

```javascript
import { commands } from "pac-maker";
import config from "./pac.config.js";

commands.serve({ host: "localhost", port: 12345 }, config);
```

## Run tests

To run unit tests, you should enable experimental vm modules.

```shell
set NODE_OPTIONS=--experimental-vm-modules
pnpm test
```

Some tests may fail with the error `Test environment has been torn down`, that is a bug in Jest.
