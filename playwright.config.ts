import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.ONE_E2E_PORT ?? "3200");
if (!Number.isInteger(port) || port < 1024 || port > 65535) {
  throw new Error("ONE_E2E_PORT must be an integer from 1024 through 65535.");
}
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  webServer: {
    command: `npm run start -- --hostname 127.0.0.1 --port ${port}`,
    url: `${baseURL}/briefing`,
    // Fail if occupied rather than accidentally testing another project.
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
