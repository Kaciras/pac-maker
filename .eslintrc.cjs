module.exports = {
	root: true,
	extends: [
		"@kaciras/core",
	],
	env: {
		node: true,
	},
	overrides: [{
		files: "**/__tests__/**/*.[jt]s?(x)",
		extends: ["@kaciras/jest"],
	}],
};
