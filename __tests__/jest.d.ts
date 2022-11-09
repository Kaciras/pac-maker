declare module "expect" {

	// Implemented in setup-jest.ts
	interface Matchers<R> {
		toBeHostname(): R;
	}
}
