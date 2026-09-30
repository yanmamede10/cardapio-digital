import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { after, test } from "node:test";
import { PrismaClient } from "@prisma/client";
import { R, call } from "./helpers.ts";

// Security checks that aren't about one screen. The test database is the one tests/run.mjs migrated.
const db = new PrismaClient();
after(() => db.$disconnect());

test("RLS ligado em todas as tabelas do schema public (a API segue funcionando: ela é dona das tabelas)", async () => {
  const tables = await db.$queryRaw<{ tablename: string; rowsecurity: boolean }[]>`SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`;
  assert.ok(tables.length >= 21, `só ${tables.length} tabelas`);
  assert.deepEqual(tables.filter((t) => !t.rowsecurity).map((t) => t.tablename), []);
});

/** Loads the API module (app.ts builds the app without listening) with these settings; everything else as the test API. */
const boot = (env: Record<string, string>) =>
  spawnSync(process.execPath, ["--import", "tsx", "apps/api/src/app.ts"], { env: { ...process.env, NODE_ENV: "", JWT_SECRET: "", CORS_ORIGINS: "", ...env }, encoding: "utf8", timeout: 60_000 });

test("em produção a API não sobe sem JWT_SECRET de 32+ caracteres e CORS_ORIGINS, e diz o que falta; fora de produção, como antes", () => {
  const none = boot({ NODE_ENV: "production" });
  assert.equal(none.status, 1);
  assert.match(none.stderr, /JWT_SECRET com pelo menos 32 caracteres/);
  assert.match(none.stderr, /CORS_ORIGINS com as URLs do painel e do cardápio/);

  const short = boot({ NODE_ENV: "production", JWT_SECRET: "x".repeat(31), CORS_ORIGINS: "https://painel.exemplo.com" });
  assert.equal(short.status, 1);
  assert.match(short.stderr, /JWT_SECRET/);
  assert.doesNotMatch(short.stderr, /CORS_ORIGINS/);

  assert.equal(boot({ NODE_ENV: "production", JWT_SECRET: "x".repeat(32), CORS_ORIGINS: " , " }).status, 1, "CORS_ORIGINS só com vírgulas");
  const ok = boot({ NODE_ENV: "production", JWT_SECRET: "x".repeat(32), CORS_ORIGINS: "https://painel.exemplo.com,https://cardapio.exemplo.com" });
  assert.equal(ok.status, 0, ok.stderr);
  const dev = boot({});
  assert.equal(dev.status, 0, dev.stderr);
});

test("sem X-Session-Id válido nenhuma chamada devolve pedidos (nem a antiga sessão \"anonymous\")", async () => {
  const mine = crypto.randomUUID();
  const item = (await call("GET", `/api/restaurants/${R}/items`)).body.find((i: { soldOut: boolean }) => !i.soldOut);
  const order = (await call("POST", "/api/orders", { session: mine, body: { mode: "delivery", restaurantId: R, lines: [{ itemId: item.id, quantity: 1, notes: "", selectedOptions: [] }] } })).body;
  assert.ok(order.id);
  assert.ok((await call("GET", "/api/orders", { session: mine })).body.some((o: { id: string }) => o.id === order.id), "o próprio aparelho vê o pedido");

  for (const session of [undefined, "", "anonymous", "   ", "1234"]) {
    const label = JSON.stringify(session);
    assert.equal((await call("GET", "/api/orders", { session })).status, 400, `lista com ${label}`);
    assert.equal((await call("GET", `/api/orders/${order.id}`, { session })).status, 404, `pedido com ${label}`);
    assert.equal((await call("POST", "/api/orders", { session, body: { mode: "delivery", restaurantId: R, lines: [{ itemId: item.id, quantity: 1, notes: "", selectedOptions: [] }] } })).status, 400, `novo pedido com ${label}`);
  }
  const other = await call("GET", "/api/orders", { session: crypto.randomUUID() });
  assert.deepEqual([other.status, other.body], [200, []], "outro aparelho não vê nada");
});
