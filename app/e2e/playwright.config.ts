import { defineConfig } from "@playwright/test";
import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
dotenv.config({ path: fileURLToPath(new URL(".env", import.meta.url)) });
export default defineConfig({
  testDir: "./tests",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  globalSetup: "./setup.ts",
  globalTeardown: "./teardown.ts",
  workers: 2,
  fullyParallel: false,
  retries: 0,
  forbidOnly: true,
  reporter: [["list"]],
  use: {
    baseURL: process.env.BASE ?? "http://localhost:3200",
    channel: process.env.E2E_CHROME_CHANNEL ?? "chrome",
    viewport: { width: 1512, height: 982 },
    contextOptions: { reducedMotion: "reduce" },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
});
