// Wrap a function so it runs only after things go quiet for `waitMs`. `.cancel()` drops a pending run (handy on unmount).
// Not tied to React; keep one instance in a ref if you need the timer to survive renders.
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
