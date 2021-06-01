// Add custom matchers to types.
declare namespace jest {

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	interface Matchers<R, T> {
		toBeHostname(): R;
	}
}
