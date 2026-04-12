import path from "path";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { APP_THEME_OPTIONS } from "./src/appconfig.constants";

// Injects the theme-id → background-color map into index.html at build time so
// the pre-paint script in <head> can read it without duplicating the constants.
function injectAppThemeColors(): Plugin {
  const colors: Record<string, string> = {};
  for (const opt of APP_THEME_OPTIONS) {
    // Strip alpha channel if present (e.g. "#00000090" → "#000000")
    colors[opt.id] = opt.value.length > 7 ? opt.value.slice(0, 7) : opt.value;
  }
  const json = JSON.stringify(colors);
  return {
    name: "inject-app-theme-colors",
    transformIndexHtml: (html) => html.replace("__APP_THEME_COLORS__", json),
  };
}

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [injectAppThemeColors(), react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
}));
