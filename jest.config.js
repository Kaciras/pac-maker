export default {
	setupFilesAfterEnv: [
		"<rootDir>/__tests__/setup-jest.ts",
	],
	preset: "ts-jest/presets/default-esm",
	globals: {
		"ts-jest": { useESM: true },
	},
	clearMocks: true,
	collectCoverageFrom: [
		"bin/*.ts",
		"lib/**/*.ts",
	],
	coverageDirectory: "coverage",
	coverageProvider: "v8",
	testMatch: [
		"**/__tests__/*.spec.ts",
	],
	moduleFileExtensions: ["ts", "js", "json", "node"],
};
