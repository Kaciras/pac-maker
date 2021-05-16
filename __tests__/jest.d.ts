// Add custom matchers to types.

declare namespace jest {

	interface Matchers<R, T> {
		toBeDomain(): R;
	}
}
