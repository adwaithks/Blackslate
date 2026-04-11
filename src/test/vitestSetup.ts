/**
 * Zustand `persist` uses `localStorage`; Vitest’s `node` env has none until we stub it.
 * Runs before each test file so static imports of persisted stores see real Storage APIs.
 */
import { stubZustandPersistEnv } from "@/test/stubZustandPersistEnv";

stubZustandPersistEnv();
