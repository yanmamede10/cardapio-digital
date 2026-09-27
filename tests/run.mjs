// npm test [api|e2e]
// Throwaway Postgres in Docker → migrate + seed → API on :4200 → API tests and/or Playwright UI tests → teardown.
// Everything points at the container through DATABASE_URL; the real (Supabase) database is never touched.
import { execSync, spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const API_DIR = `${ROOT}apps/api`;
const DB_URL = "postgresql://postgres:test@localhost:54329/cardapio_test";
const CONTAINER = "cardapio-test-db";
const only = process.argv[2]; // "api" | "e2e" | undefined (both)
// TZ: the API pins São Paulo time; tests must agree on "today" even on a UTC CI runner.
const env = { ...process.env, DATABASE_URL: DB_URL, DIRECT_URL: DB_URL, PORT: "4200", API_URL: "http://localhost:4200", TZ: "America/Sao_Paulo", SUPER_ADMIN_KEY: "test-admin-key" };
// WhatsApp: the API talks to a fake Evolution that tests/api/whatsapp.test.ts serves on :4299 — no real Evolution needed.
// Storage blanked (set-but-empty beats apps/api/.env), so a test never uploads to the real bucket.
Object.assign(env, { EVOLUTION_API_URL: "http://localhost:4299", EVOLUTION_API_KEY: "test-evo-key", WHATSAPP_WEBHOOK_URL: "http://localhost:4200/api/whatsapp/webhook", WHATSAPP_WEBHOOK_SECRET: "test-webhook-secret", STORAGE_S3_ENDPOINT: "" });

const sh = (cmd, cwd = ROOT) => execSync(cmd, { cwd, env, stdio: "inherit" });
const run = (cmd, args, cwd = ROOT) =>
  new Promise((resolve) => spawn(cmd, args, { cwd, env, stdio: "inherit", shell: true }).on("exit", (code) => resolve(code ?? 1)));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let api;
let failed = false;
try {
  console.log("▸ Postgres de teste (Docker)");
  execSync(`docker rm -f ${CONTAINER}`, { stdio: "ignore" });
  sh(`docker run -d --rm --name ${CONTAINER} -e POSTGRES_PASSWORD=test -e POSTGRES_DB=cardapio_test -p 54329:5432 postgres:16-alpine`);
  for (let i = 0; ; i++) {
    try {
      execSync(`docker exec ${CONTAINER} pg_isready -U postgres -d cardapio_test`, { stdio: "ignore" });
      break;
    } catch {
      if (i > 30) throw new Error("Postgres de teste não subiu");
      await sleep(1000);
    }
  }

  console.log("▸ migrações + seed");
  sh("npx prisma migrate deploy", API_DIR);
  sh("npx tsx prisma/seed.ts", API_DIR);

  console.log("▸ API em :4200");
  // detached (non-Windows): own process group, so teardown can kill npx → tsx → node together.
  api = spawn("npx", ["tsx", "src/index.ts"], { cwd: API_DIR, env, stdio: "inherit", shell: true, detached: process.platform !== "win32" });
  for (let i = 0; ; i++) {
    try {
      if ((await fetch(`${env.API_URL}/api/health`)).ok) break;
    } catch {}
    if (i > 60) throw new Error("API de teste não subiu");
    await sleep(500);
  }

  if (only !== "e2e") failed = (await run("node", ["--import", "tsx", "--test", "--test-reporter=spec", "--test-concurrency=1", '"tests/api/*.test.ts"'])) !== 0 || failed;
  if (only !== "api") failed = (await run("npx", ["playwright", "test"])) !== 0 || failed;
} catch (err) {
  console.error(err);
  failed = true;
} finally {
  // Kill the whole tree (npx → tsx → node), not just the shell.
  if (api) process.platform === "win32" ? execSync(`taskkill /pid ${api.pid} /T /F`, { stdio: "ignore" }) : process.kill(-api.pid, "SIGTERM");
  execSync(`docker rm -f ${CONTAINER}`, { stdio: "ignore" });
}
process.exit(failed ? 1 : 0);
