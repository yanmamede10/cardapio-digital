import { defineConfig } from "@playwright/test";

// Only for `npm run carga` (tests/run.mjs): the API on :4200 and both apps built and served by `vite preview`
// (cardápio :5273, painel :5274) are already up, with the full house of pico.mjs running. Never part of `npm test`.
export default defineConfig({
  testDir: ".",
  testMatch: "painel.spec.ts",
  outputDir: "../../test-results/carga",
  workers: 1,
  reporter: "list",
  timeout: 10 * 60_000,
  use: { baseURL: "http://localhost:5274", channel: "chrome", timezoneId: "America/Sao_Paulo", trace: "retain-on-failure" }
});
