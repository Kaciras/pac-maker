declare namespace jest {

	// Implemented in setup-jest.ts
	interface Matchers<R> {
		toBeHostname(): R;
	}
}
