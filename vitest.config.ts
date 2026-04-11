import path from "path";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Keeps `@/` imports working in tests. Uses `node` by default — fine for utils,
// pure functions, and Zustand. Use `// @vitest-environment jsdom` at the top
// of a file (or a separate config) when you need the DOM for components.
export default defineConfig({
	plugins: [react()],
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./src"),
		},
	},
	test: {
		environment: "node",
		include: ["src/**/*.{test,spec}.{ts,tsx}"],
		passWithNoTests: true,
		// setupFiles runs before executing tests in the file, hence the stub is in place
		// before the actual test file is executed.
		setupFiles: [path.resolve(__dirname, "./src/test/vitestSetup.ts")],
	},
});
