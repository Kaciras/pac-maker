export default {
	setupFilesAfterEnv: [
		"<rootDir>/__tests__/setup-jest.ts",
	],
	transform: {
		"^.+\\.ts$": ["@swc/jest"],
	},
	extensionsToTreatAsEsm: [".ts"],
	clearMocks: true,
	collectCoverageFrom: [
		"bin/*.ts",
		"lib/**/*.ts",
	],
	coverageDirectory: "coverage",
	coverageProvider: "v8",
	moduleNameMapper: {

		// https://github.com/facebook/jest/issues/12309
		"#(.*)": "$1",

		/*
		 * https://github.com/kulshekhar/ts-jest/issues/1057
		 *
		 * Undici has wasm modules named `llhttp.wasm` and it's interop file `llhttp.wasm.js`,
		 * we need exclude them to avoid resolving failure.
		 */
		"^(\\.{1,2}/.*)(?<!\\.wasm)\\.js$": "$1",
	},
	testMatch: [
		"<rootDir>/__tests__/**/*.spec.ts",
	],
	moduleFileExtensions: ["ts", "js", "json", "node"],
};
