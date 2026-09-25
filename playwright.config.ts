import { defineConfig, devices } from "@playwright/test";

// Run through `npm test` / `npm run test:e2e`: tests/run.mjs has already started the throwaway
// database and the API on :4200; Playwright only adds the dashboard dev server pointed at it.
export default defineConfig({
  testDir: "tests/e2e",
  workers: 1, // one shared seeded database
  reporter: "list",
  // timezoneId: same "today" as the API (São Paulo) whatever the machine's zone — CI runs in UTC.
  use: { baseURL: "http://localhost:5274", channel: "chrome", timezoneId: "America/Sao_Paulo", screenshot: "only-on-failure", trace: "retain-on-failure" },
  projects: [
    { name: "desktop", testMatch: /desktop\.spec\.ts/, use: { viewport: { width: 1366, height: 820 } } },
    { name: "mobile", testMatch: /mobile\.spec\.ts/, use: { ...devices["Pixel 7"], channel: "chrome" } }
  ],
  webServer: {
    command: "npx vite --port 5274 --strictPort",
    cwd: "apps/dashboard",
    url: "http://localhost:5274",
    env: { VITE_API_URL: "http://localhost:4200" },
    reuseExistingServer: false,
    timeout: 120_000
  }
});
