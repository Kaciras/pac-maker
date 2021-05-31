export default {
	setupFilesAfterEnv: [
		"<rootDir>/__tests__/setup-jest.ts",
	],
	globals: {
		"ts-jest": { useESM: true },
	},
	preset: "ts-jest/presets/default-esm",
	clearMocks: true,
	coverageDirectory: "coverage",
	coverageProvider: "v8",
	testMatch: [
		"**/__tests__/*.spec.ts",
	],
	moduleFileExtensions: ["ts", "js", "json", "node"],
};
