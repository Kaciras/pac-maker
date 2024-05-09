export default {
	setupFilesAfterEnv: [
		"<rootDir>/test/setup-jest.ts",
	],
	transform: {
		"^.+\\.ts$": ["@swc/jest"],
	},
	extensionsToTreatAsEsm: [".ts"],
	clearMocks: true,
	collectCoverageFrom: [
		"src/**/*.ts",

		// We don't test third party code.
		"!src/context.ts",
	],
	coverageDirectory: "coverage",
	coverageProvider: "v8",
	testMatch: [
		"<rootDir>/test/**/*.spec.ts",
	],
	moduleNameMapper: {
		/*
		 * https://github.com/kulshekhar/ts-jest/issues/1057
		 *
		 * Undici has a wasm module named `llhttp.wasm` and it's interop file `llhttp.wasm.js`,
		 * we need exclude them to avoid resolving failure.
		 */
		"^(\\.{1,2}/.*)(?<!\\.wasm)\\.js$": "$1",
	},
	moduleFileExtensions: ["ts", "js", "json", "node"],
};
