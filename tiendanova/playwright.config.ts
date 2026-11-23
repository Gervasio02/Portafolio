import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  retries: process.env.CI ? 1 : 0,
  fullyParallel: false,
  timeout: 90_000,
  use: {
    baseURL: process.env.BASE_URL || "http://127.0.0.1:3000",
    launchOptions: process.env.CHROMIUM_PATH
      ? { executablePath: process.env.CHROMIUM_PATH }
      : {},
    trace: "retain-on-failure",
  },
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: process.env.E2E_DEV
          ? "npm run dev -- --hostname 127.0.0.1"
          : "npm run start",
        url: "http://127.0.0.1:3000/health",
        timeout: 110_000,
        reuseExistingServer: false,
      },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
