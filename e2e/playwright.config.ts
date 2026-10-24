import { fileURLToPath } from "node:url";
import { defineConfig } from "@playwright/test";

// The smoke suite drives the built bundle, so the daemon URL is baked in at build time: the web
// server below builds the desktop pointing at this daemon's port. 3101 rather than the default
// 3001 so a daemon a person left running cannot be silently tested instead of this one.
const DAEMON_PORT = 3101;
const WEB_PORT = 4173;
const FIXTURE_VAULT = fileURLToPath(new URL("./fixtures", import.meta.url));

export default defineConfig({
  testDir: ".",
  // One shared daemon and one shared vault; the tests are seconds long, so parallelism buys
  // nothing and would race the servers this config starts.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: "pnpm --filter daemon start",
      env: {
        VAULT_PATH: FIXTURE_VAULT,
        PORT: String(DAEMON_PORT),
        LUMOS_DISABLE_WHATSAPP: "1",
      },
      url: `http://127.0.0.1:${DAEMON_PORT}/health`,
      // A server already on the port is a failure, not something to quietly test against.
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: `pnpm --filter desktop build && pnpm --filter desktop preview -- --port ${WEB_PORT}`,
      env: { VITE_DAEMON_URL: `http://127.0.0.1:${DAEMON_PORT}` },
      url: `http://localhost:${WEB_PORT}`,
      reuseExistingServer: false,
      timeout: 180_000,
    },
  ],
});
