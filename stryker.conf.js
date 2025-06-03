/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
	packageManager: "pnpm",
	reporters: ["html", "progress"],
	htmlReporter: {
		fileName: "coverage/stryker.html",
	},
	disableTypeChecks: "**/*.ts",
	ignoreStatic: true,
	tempDirName: "stryker-tmp",
};
