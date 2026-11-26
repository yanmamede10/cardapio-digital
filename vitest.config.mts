import { defineConfig } from "vitest/config";

// Vitest (atividade "Ferramentas de QA"): roda sobre o mesmo Vite 5 dos apps web e dashboard, sem build nem banco.
// Os testes unitários antigos (node:test, tests/unit) continuam no Gate 4; estes ficam em tests/vitest.
export default defineConfig({
  test: {
    include: ["tests/vitest/**/*.test.ts"],
    environment: "node",
    reporters: ["verbose", ["junit", { outputFile: "reports/vitest-junit.xml" }]],
    coverage: {
      provider: "v8",
      include: ["apps/api/src/lib/rateLimit.ts", "apps/api/src/lib/coupons.ts", "apps/web/src/lib/itemDraft.ts", "apps/api/src/lib/pricing.ts"],
      reporter: ["text", "html", "json-summary"],
      reportsDirectory: "reports/vitest-coverage",
      thresholds: { lines: 80, branches: 70 }
    }
  }
});
