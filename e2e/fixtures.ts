import { test as base, expect } from "@playwright/test";
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { spawn } from "node:child_process";
import { rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Page } from "@playwright/test";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** The seeded login - see server/src/index.ts and .env.example, which seed it on first run. */
const LOGIN = { email: "marco@example.com", password: "bench" };

/** Poll the API until the server answers, so tests never race the boot. Any HTTP reply proves it
    is listening; the gate turns everything into a 401 until a spec signs in, which is still an answer. */
async function waitForServer(url: string, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.status < 500) return;
    } catch {
      // not listening yet
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`server at ${url} did not start within ${timeoutMs}ms`);
}

/**
 * Sign in through the real form, as a person does. Every spec needs this - the gate sits in front
 * of every page and every API route - and each test gets a fresh browser context, so it is a
 * beforeEach in each spec rather than a fixture: visible in the file, next to what it sets up.
 */
export async function login(page: Page): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill(LOGIN.email);
  await page.getByLabel("Password").fill(LOGIN.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.getByRole("navigation", { name: "Primary" }).waitFor();
}

/**
 * One server per worker, each with its own freshly seeded databases, so specs running in
 * parallel never share state. Ports start at 8150 and the auth store is a Postgres container per
 * worker, migrated and seeded by the server on boot the same way the unit suites do.
 */
export const test = base.extend<object, { appServer: string }>({
  appServer: [
    async ({}, use, workerInfo) => {
      const port = 8150 + workerInfo.workerIndex;
      const dataDir = path.join("e2e", ".tmp", `w${workerInfo.workerIndex}`);
      rmSync(path.join(root, dataDir), { recursive: true, force: true });

      const postgres = await new PostgreSqlContainer(
        "postgres:17-alpine",
      ).start();

      // npx is a .cmd on Windows, which child_process cannot execute by its bare name.
      const npx = process.platform === "win32" ? "npx.cmd" : "npx";
      const server = spawn(npx, ["tsx", "server/src/index.ts"], {
        cwd: root,
        env: {
          ...process.env,
          PORT: String(port),
          DATA_DIR: dataDir,
          DATABASE_URL: postgres.getConnectionUri(),
          JWT_SECRET: "e2e-secret",
          // Keep the seed deterministic whatever the developer's .env holds, so LOGIN below matches.
          SEED_EMAIL: LOGIN.email,
          SEED_PASSWORD: LOGIN.password,
        },
        stdio: "ignore",
      });
      const base = `http://localhost:${port}`;
      await waitForServer(`${base}/api/space/tree`);

      await use(base);

      server.kill();
      await postgres.stop();
    },
    { scope: "worker", auto: true },
  ],
  baseURL: async ({ appServer }, use) => {
    await use(appServer);
  },
});

export { expect };
