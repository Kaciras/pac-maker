declare module "expect" {

	interface Matchers<R> {
		// Implemented in setup-jest.ts
		toBeHostname(): R;
	}

	interface AsymmetricMatchers {
		toBeHostname(): void;
	}
}
