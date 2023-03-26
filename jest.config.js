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

		// We don't test third party code.
		"!lib/context.ts",
	],
	coverageDirectory: "coverage",
	coverageProvider: "v8",
	testMatch: [
		"<rootDir>/__tests__/**/*.spec.ts",
	],
	moduleFileExtensions: ["ts", "js", "json", "node"],
};
