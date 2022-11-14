/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
	packageManager: "pnpm",
	plugins: ["@stryker-mutator/jest-runner"],
	reporters: ["html", "progress"],
	htmlReporter: {
		fileName: "coverage/stryker.html",
	},
	tempDirName: "stryker-tmp",
	coverageAnalysis: "perTest",
	testRunner: "jest",
	testRunnerNodeArgs: ["--experimental-vm-modules"],
};
