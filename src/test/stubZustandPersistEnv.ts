import { vi } from "vitest";

import { createMemoryStorage } from "@/test/memoryStorage";

/**
 * Zustand `persist` defaults to `createJSONStorage(() => window.localStorage)`.
 * Under Vitest’s `node` environment there is no `window`, so persist is disabled
 * and stores never get `.persist`. This stubs `localStorage` and a minimal
 * `window` so persist behaves like the browser.
 *
 * Call from `beforeEach` in tests that import persisted stores (often with
 * `vi.resetModules()` + dynamic `import()` if the store is a singleton).
 */
export function stubZustandPersistEnv(): Storage {
	const storage = createMemoryStorage();
	vi.stubGlobal("localStorage", storage);
	vi.stubGlobal("window", { localStorage: storage });
	return storage;
}
