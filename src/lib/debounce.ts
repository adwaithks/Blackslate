/**
 * Returns a debounced version of `fn` that fires only after `waitMs` of
 * inactivity. Call `.cancel()` to clear a pending invocation (e.g. on unmount).
 *
 * This is a plain utility with no React dependency — instantiate it inside a
 * `useRef` initialiser so the same instance (and its internal timer) persists
 * for the component's lifetime.
 */
export function debounce<Args extends unknown[]>(
	fn: (...args: Args) => void,
	waitMs: number,
): ((...args: Args) => void) & { cancel: () => void } {
	let timer: ReturnType<typeof setTimeout> | null = null;

	const debounced = (...args: Args): void => {
		if (timer !== null) clearTimeout(timer);
		timer = setTimeout(() => {
			timer = null;
			fn(...args);
		}, waitMs);
	};

	debounced.cancel = (): void => {
		if (timer !== null) {
			clearTimeout(timer);
			timer = null;
		}
	};

	return debounced;
}
