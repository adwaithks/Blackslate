import { vi } from "vitest";

import { createMemoryStorage } from "@/test/memoryStorage";

/**
 * Zustand `persist` defaults to `createJSONStorage(() => window.localStorage)`.
 * Under Vitest’s `node` environment there is no `window`, so storage is
 * “unavailable” and persist logs errors on every write.
 *
 * **Global:** `vitest.config.ts` loads `src/test/vitestSetup.ts`, which calls this
 * once per test file so static imports of persisted stores (e.g. `sessionsStore`)
 * see real `Storage` APIs.
 *
 * **Per test:** with `vi.resetModules()` + dynamic `import()`, call `localStorage.clear()`
 * in `beforeEach` so persist doesn’t rehydrate the previous test’s JSON (same stubbed
 * `Storage` instance for the whole file).
 */
export function stubZustandPersistEnv(): Storage {
	const storage = createMemoryStorage();
	vi.stubGlobal("localStorage", storage);
	vi.stubGlobal("window", { localStorage: storage });
	return storage;
}
