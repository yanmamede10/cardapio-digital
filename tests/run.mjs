// npm test [api|e2e] · npm run carga [-- supabase]
// Throwaway Postgres in Docker → migrate + seed → API on :4200 → API tests and/or Playwright UI tests → teardown.
// Everything points at the container through DATABASE_URL; the real (Supabase) database is never touched — except by
// `npm run carga -- supabase`, which runs the load test against apps/api/.env's database (the Supabase test project).
import { execSync, spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import C from "./load/cenario.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const API_DIR = `${ROOT}apps/api`;
const DB_URL = "postgresql://postgres:test@localhost:54329/cardapio_test";
const CONTAINER = "cardapio-test-db";
const only = process.argv[2]; // "api" | "e2e" | "carga" (casa cheia) | undefined (api + e2e)
const supabase = only === "carga" && process.argv[3] === "supabase";
// TZ: the API pins São Paulo time; tests must agree on "today" even on a UTC CI runner.
const env = { ...process.env, PORT: "4200", API_URL: "http://localhost:4200", TZ: "America/Sao_Paulo", SEED_DEMO_PASSWORD: "senha123" };
// The suites call as a few logins from this machine, far faster than people: 3000/min per staff member instead of 600
// (apps/api/src/lib/rateLimit.ts; tests/api/limites.test.ts reads the same number). The load test keeps the real one.
if (only !== "carga") env.STAFF_PER_MINUTE = "3000";
if (!supabase) {
  Object.assign(env, { DATABASE_URL: DB_URL, DIRECT_URL: DB_URL, SUPER_ADMIN_KEY: "test-admin-key" });
  // WhatsApp: the API talks to a fake Evolution that tests/api/whatsapp.test.ts serves on :4299 — no real Evolution needed.
  // Storage: the private WhatsApp bucket points at that same fake (it answers S3 PUTs too) with dummy keys; the public bucket
  // is blanked (set-but-empty beats apps/api/.env). No test ever reaches the real Supabase.
  Object.assign(env, { EVOLUTION_API_URL: "http://localhost:4299", EVOLUTION_API_KEY: "test-evo-key", WHATSAPP_WEBHOOK_URL: "http://localhost:4200/api/whatsapp/webhook", WHATSAPP_WEBHOOK_SECRET: "test-webhook-secret" });
  Object.assign(env, { STORAGE_S3_ENDPOINT: "http://localhost:4299", STORAGE_S3_REGION: "us-east-1", STORAGE_S3_ACCESS_KEY_ID: "test", STORAGE_S3_SECRET_ACCESS_KEY: "test", STORAGE_S3_WHATSAPP_BUCKET: "wa-test", STORAGE_S3_BUCKET: "", STORAGE_PUBLIC_URL: "https://public.invalid/storage/v1/object/public/cardapio" });
}

const sh = (cmd, cwd = ROOT) => execSync(cmd, { cwd, env, stdio: "inherit" });
const run = (cmd, args, cwd = ROOT) =>
  new Promise((resolve) => spawn(cmd, args, { cwd, env, stdio: "inherit", shell: true }).on("exit", (code) => resolve(code ?? 1)));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// detached (non-Windows): own process group, so teardown can kill npx → tsx → node together.
const start = (args, cwd) => spawn("npx", args, { cwd, env, stdio: "inherit", shell: true, detached: process.platform !== "win32" });
// Kill the whole tree (npx → tsx → node), not just the shell.
const kill = (p) => {
  try {
    process.platform === "win32" ? execSync(`taskkill /pid ${p.pid} /T /F`, { stdio: "ignore" }) : process.kill(-p.pid, "SIGTERM");
  } catch {} // already gone
};

let api;
const servers = [];
let failed = false;
try {
  if (supabase) {
    console.log("▸ banco do apps/api/.env (Supabase de testes): só o seed de demonstração, que não apaga nada e para se o Chapa 27 já existe");
    sh("npx tsx prisma/seed-demo.ts", API_DIR);
  } else {
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

    console.log("▸ migrações + seeds");
    sh("npx prisma migrate deploy", API_DIR);
    sh("npx tsx prisma/seed-demo.ts", API_DIR); // on the empty database: the production seed must run alone
    sh("npx tsx prisma/seed.ts", API_DIR); // wipes everything, then "fogo" with its team
    sh("npx tsx prisma/seed-demo.ts", API_DIR); // the hamburgueria again, for the end-to-end flow and the load test
  }

  console.log("▸ API em :4200");
  api = start(["tsx", "src/index.ts"], API_DIR);
  for (let i = 0; ; i++) {
    try {
      if ((await fetch(`${env.API_URL}/api/health`)).ok) break;
    } catch {}
    if (i > 60) throw new Error("API de teste não subiu");
    await sleep(500);
  }

  if (only === "carga") {
    // The two apps as a phone gets them (vite build + preview, not the dev server's loose modules): Lighthouse measures that.
    console.log("▸ cardápio (:5273) e painel (:5274) construídos");
    for (const [app, port] of [["web", "5273"], ["dashboard", "5274"]]) {
      execSync("npx vite build --outDir dist/carga --emptyOutDir --logLevel warn", { cwd: `${ROOT}apps/${app}`, env: { ...env, VITE_API_URL: env.API_URL, VITE_CUSTOMER_APP_URL: "http://localhost:5273" }, stdio: "inherit" });
      servers.push(start(["vite", "preview", "--outDir", "dist/carga", "--port", port, "--strictPort"], `${ROOT}apps/${app}`));
    }
    // The full house (tests/load/pico.mjs) and, once it's full, the menu in Lighthouse and order → Central on real screens.
    const load = run("node", ["tests/load/pico.mjs"]);
    await sleep(C.rampaS * 1000);
    const lighthouse = await run("node", ["tests/load/cardapio.mjs"]);
    const panel = await run("npx", ["playwright", "test", "-c", "tests/load/playwright.config.ts"]);
    failed = [lighthouse, panel, await load].some((code) => code !== 0);
  } else {
    if (only !== "e2e") failed = (await run("node", ["--import", "tsx", "--test", "--test-reporter=spec", "--test-concurrency=1", '"tests/api/*.test.ts"'])) !== 0 || failed;
    if (only !== "api") failed = (await run("npx", ["playwright", "test"])) !== 0 || failed;
  }
} catch (err) {
  console.error(err);
  failed = true;
} finally {
  for (const p of [api, ...servers]) if (p) kill(p);
  if (!supabase) execSync(`docker rm -f ${CONTAINER}`, { stdio: "ignore" });
}
process.exit(failed ? 1 : 0);
