import { vi } from "vitest";

import { createMemoryStorage } from "@/test/memoryStorage";

// Tests run without a real browser, so saved settings need a fake localStorage or the store complains.
// vitestSetup runs this once per file. If you reload the store each test, clear localStorage in beforeEach so data doesn't leak between tests.
export function stubZustandPersistEnv(): Storage {
	const storage = createMemoryStorage();
	vi.stubGlobal("localStorage", storage);
	vi.stubGlobal("window", { localStorage: storage });
	return storage;
}
