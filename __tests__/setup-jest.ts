import { isIP } from "net";

// https://stackoverflow.com/a/26093611
const domainName = /^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9](?:\.[a-zA-Z]{2,})+$/;

expect.extend({
	toBeDomain(received) {
		if (isIP(received) || domainName.test(received)) {
			return {
				pass: true,
				message: () => `${received} is a valid domain`,
			};
		}
		return {
			pass: false,
			message: () => `${received} is not a domain`,
		};
	},
});
