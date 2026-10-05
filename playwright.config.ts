import { defineConfig } from "@playwright/test";

// Run through `npm test` / `npm run test:e2e`: tests/run.mjs has already started the throwaway
// database and the API on :4200; Playwright adds the dashboard (:5274) and the customer app (:5273) pointed at it.
// Screen sizes of the test plan: desktop 1366, tablet in landscape 1280×800, phone 390.
const touch = { hasTouch: true, isMobile: true };
export default defineConfig({
  testDir: "tests/e2e",
  workers: 1, // one shared seeded database
  reporter: "list",
  // timezoneId: same "today" as the API (São Paulo) whatever the machine's zone — CI runs in UTC.
  use: { baseURL: "http://localhost:5274", channel: "chrome", timezoneId: "America/Sao_Paulo", screenshot: "only-on-failure", trace: "retain-on-failure" },
  projects: [
    { name: "desktop", testMatch: /(desktop|fluxo-critico|varredura|dialogos|caddy|checklist|nao-encontrada)\.spec\.ts/, use: { viewport: { width: 1366, height: 820 } } },
    { name: "tablet", testMatch: /varredura\.spec\.ts/, use: { viewport: { width: 1280, height: 800 }, hasTouch: true } },
    { name: "mobile", testMatch: /(mobile|varredura|dialogos|checklist|nao-encontrada)\.spec\.ts/, use: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, ...touch } }
  ],
  webServer: [
    {
      command: "npx vite --port 5274 --strictPort",
      cwd: "apps/dashboard",
      url: "http://localhost:5274",
      env: { VITE_API_URL: "http://localhost:4200", VITE_PUBLIC_URL: "http://localhost:5273" },
      reuseExistingServer: false,
      timeout: 120_000
    },
    {
      command: "npx vite --port 5273 --strictPort",
      cwd: "apps/web",
      url: "http://localhost:5273",
      env: { VITE_API_URL: "http://localhost:4200" },
      reuseExistingServer: false,
      timeout: 120_000
    }
  ]
});
