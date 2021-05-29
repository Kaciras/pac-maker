export default {
	coverageDirectory: "coverage",
	coverageProvider: "v8",
	transform: {},
	clearMocks: true,
	testMatch: [
		"**/__tests__/*.spec.js",
	],
	setupFilesAfterEnv: [
		"<rootDir>/__tests__/setup-jest.js",
	],
};
