module.exports = {
	root: true,
	extends: [
		"@kaciras/core",
		"@kaciras/typescript",
	],
	env: {
		node: true,
	},
	rules: {
		"@kaciras/import-group-sort": "warn",
	},
	overrides: [
		{
			files: "./__tests__/**/*.[jt]s",
			extends: ["@kaciras/jest"],
		},
		{
			files: "./template/*.js",
			rules: {
				"no-undef": "off",
				"no-unused-vars": "off",
			},
		},
	],
};
