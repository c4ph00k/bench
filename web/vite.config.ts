import { defineConfig } from "vitest/config";
import type { PluginOption } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

/** Multi-page build: one HTML entry per app, so their global styles never collide. */
const entry = (name: string) => fileURLToPath(new URL(name, import.meta.url));

/** The apps with their own HTML entry point in web/dist, for deep-link fallback. */
const APPS = ["login", "crm", "space", "rolodex"];

/** Dev only: send a deep link like /crm/contacts to that app's HTML, not the launcher. The login
    document is in the list so /login resolves in dev too - in production the gate redirects there
    before any page is served. */
function appFallback(): PluginOption {
  return {
    name: "bench-app-fallback",
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        const { pathname } = new URL(req.url ?? "/", "http://localhost");
        const app = APPS.find(
          (name) => pathname === `/${name}` || pathname.startsWith(`/${name}/`),
        );
        if (app && !/\.[a-z0-9]+$/i.test(pathname))
          req.url = `/${app}/index.html`;
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), appFallback()],
  build: {
    rollupOptions: {
      input: {
        home: entry("index.html"),
        login: entry("login/index.html"),
        crm: entry("crm/index.html"),
        space: entry("space/index.html"),
        rolodex: entry("rolodex/index.html"),
      },
    },
  },
  server: {
    port: 8101,
    strictPort: true,
    proxy: { "/api": `http://localhost:${process.env.API_PORT ?? 8100}` },
  },
  preview: { port: 8102, strictPort: true },
  test: {
    environment: "jsdom",
    setupFiles: ["src/space/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      include: ["src/**"],
      exclude: ["src/**/main.tsx", "src/**/test/**", "src/**/*.test.*"],
      thresholds: { statements: 80 },
    },
  },
});
