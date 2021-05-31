# pac-maker

Proxy Auto Configuration (PAC) file generator & maintenance tool.

# Usage

Just use pre-generated PAC file: [proxy.pac](https://raw.githubusercontent.com/Kaciras/pac-maker/master/dist/proxy.pac)

## Commands

pac-maker loads config from file in working directory use the `--config=<path>`, default is `pac.config.js`.

config file should export a configuration object:

```javascript
import { builtinList, gfwlist } from "./lib/source.js";

export default {
	// Location of the generated PAC file.
	path: "dist/proxy.pac",

	// Fallback when no match any rule.
	direct: "DIRECT",

	// Proxy rule map, { [proxy]: [hostname sources] }
	sources: {
		"SOCKS5 localhost:2080": [
			gfwlist(),
			builtinList("default"),
			builtinList("forbidden"),
		],
	},
};
```

Generate a PAC file:

```shell
node bin/generate.js [--config=<path>] [--watch]
```

* `--watch` After the initial build, pac-maker will continue to watch for updates in any of the sources.

Find what hosts will be proxied by PAC in browser history:

```shell
node bin/analyze.js [--config=<path>] [--json=<path>]
```

* `--json` Save matched rules to this file, default is `matches.json`.

Serve PAC file with http, and update when source have changes:

```shell
node bin/serve.js [--config=<file>] [--port=<port>]
```

* `--port` The port number that http server to listened on, default is `7568`.

## Run tests

To run unit tests, you should enable experimental vm modules.

```shell
set NODE_OPTIONS=--experimental-vm-modules
pnpm run test
```
