export default {
	// globals: {
	// 	"ts-jest": { useESM: true },
	// },
	// preset: "ts-jest/presets/default-esm",

	testEnvironment: "node",
	coverageDirectory: "coverage",
	coverageProvider: "v8",
	clearMocks: true,
	testMatch: [
		"**/__tests__/*.spec.ts",
	],
	setupFilesAfterEnv: [
		"<rootDir>/__tests__/setup-jest.ts",
	],
	moduleFileExtensions: ["ts", "js", "json", "node"],
};
