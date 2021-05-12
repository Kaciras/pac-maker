module.exports = {
	root: true,
	extends: [
		"@kaciras/core",
	],
	env: {
		node: true,
	},
	overrides: [
		{
			files: "**/__tests__/**/*.js",
			extends: ["@kaciras/jest"],
		},
		{
			files: "./lib/template.js",
			rules: {
				"no-undef": "off",
				"no-unused-vars": "off",
			},
		},
	],
};
