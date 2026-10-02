import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { connect } from "node:net";
import { networkInterfaces } from "node:os";
import { after, test } from "node:test";
import { PrismaClient } from "@prisma/client";
import { ADMIN_KEY, R, call, login, uid } from "./helpers.ts";

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
  spawnSync(process.execPath, ["--import", "tsx", "apps/api/src/app.ts"], { env: { ...process.env, NODE_ENV: "", JWT_SECRET: "", CORS_ORIGINS: "", SUPER_ADMIN_KEY: "", ...env }, encoding: "utf8", timeout: 60_000 });

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

test("sem HOST a API escuta só em 127.0.0.1: a própria máquina (e o túnel) conecta, o endereço da rede local não", async () => {
  const env = { ...process.env, PORT: "4298" };
  delete env.HOST;
  const api = spawn(process.execPath, ["--import", "tsx", "apps/api/src/index.ts"], { env });
  try {
    const listening = await new Promise<string>((ok, fail) => {
      api.stdout.on("data", (b) => String(b).includes("listening") && ok(String(b).trim()));
      api.on("exit", (code) => fail(new Error(`a API saiu com ${code}`)));
    });
    assert.match(listening, /listening on http:\/\/127\.0\.0\.1:4298$/);
    const reaches = (host: string) => new Promise<boolean>((ok) => { const s = connect(4298, host).on("connect", () => (s.destroy(), ok(true))).on("error", () => ok(false)); });
    assert.equal(await reaches("127.0.0.1"), true);
    const lan = Object.values(networkInterfaces()).flat().find((a) => a?.family === "IPv4" && !a.internal)?.address;
    if (lan) assert.equal(await reaches(lan), false, `${lan}:4298, pela rede local`);
  } finally {
    api.kill();
  }
});

test("docker compose não monta a Evolution sem EVOLUTION_API_KEY; com ela, a porta 8085 fica só em 127.0.0.1", () => {
  const env = { ...process.env };
  delete env.EVOLUTION_API_KEY; // tests/run.mjs sets one for the fake Evolution
  const config = (key?: string) => spawnSync("docker", ["compose", "-f", "docker-compose.yml", "config"], { env: key ? { ...env, EVOLUTION_API_KEY: key } : env, encoding: "utf8" });
  const without = config();
  assert.notEqual(without.status, 0);
  assert.match(without.stderr, /required variable EVOLUTION_API_KEY is missing a value: set EVOLUTION_API_KEY in apps\/api\/\.env/);
  const withKey = config("k".repeat(64));
  assert.equal(withKey.status, 0, withKey.stderr);
  assert.match(withKey.stdout, /host_ip: 127\.0\.0\.1\s+target: 8080\s+published: "8085"/);
});

test("compose de produção: só o Caddy publica portas (80 e 443), a API confia só nele, tudo reinicia sozinho e as imagens têm versão fixa", () => {
  // deploy/.env only exists on the VM, and older Compose (the CI's) wants the env_file to exist even with
  // --no-env-resolution: an empty one for the duration of the check, never touching a real one.
  const envFile = "deploy/.env";
  const created = !existsSync(envFile);
  if (created) writeFileSync(envFile, "");
  let r;
  try {
    r = spawnSync("docker", ["compose", "-f", "deploy/docker-compose.prod.yml", "config", "--format", "json", "--no-env-resolution"], { env: { ...process.env, PUBLIC_IP: "203.0.113.10", EVOLUTION_API_KEY: "k".repeat(64), DIRECT_URL: "postgresql://u:p@db.invalid:5432/postgres" }, encoding: "utf8" });
  } finally {
    if (created) rmSync(envFile);
  }
  assert.equal(r.status, 0, r.stderr);
  type Service = { image: string; restart: string; ports?: { published: string; protocol: string }[]; healthcheck?: unknown; environment?: Record<string, string>; networks?: Record<string, { ipv4_address?: string } | null> };
  const services: Record<string, Service> = JSON.parse(r.stdout).services;
  const published = Object.entries(services).flatMap(([name, s]) => (s.ports ?? []).map((p) => `${name} ${p.published}/${p.protocol}`));
  assert.deepEqual(published, ["caddy 80/tcp", "caddy 443/tcp"]);
  assert.equal(services.api.environment?.TRUSTED_PROXY, services.caddy.networks?.default?.ipv4_address);
  assert.ok(services.api.healthcheck, "healthcheck na API");
  assert.equal(services.evolution.image, "evoapicloud/evolution-api:v2.3.7", "a mesma do dev");
  for (const [name, s] of Object.entries(services)) {
    assert.equal(s.restart, "unless-stopped", name);
    if (name !== "api") assert.match(s.image, /:v?\d+\.\d+(\.\d+)?(-[\w.]+)?$/,`${name}: ${s.image}`); // the API's base is pinned in its Dockerfile
  }
  for (const from of readFileSync("apps/api/Dockerfile", "utf8").match(/^FROM \S+/gm) ?? []) assert.match(from, /:\d+\.\d+\.\d+-/, from);
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

test("logo, capa e foto do prato: só PNG, JPEG ou WebP, reconhecidos pelos primeiros bytes (nome e tipo informados não valem)", async () => {
  const token = await login();
  const P = `/api/restaurants/${R}`;
  const itemId = (await call("GET", `${P}/items`)).body[0].id;
  const send = (path: string, bytes: Buffer, type: string, name: string, kind?: string) => {
    const form = new FormData();
    if (kind) form.append("kind", kind);
    form.append("file", new Blob([bytes], { type }), name);
    return fetch(`${process.env.API_URL ?? "http://localhost:4200"}${path}`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form });
  };
  const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg"><script>alert(document.cookie)</script></svg>`);
  const html = Buffer.from("<html><script>alert(1)</script></html>");
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(24)]);
  const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(24)]);
  const webp = Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WEBPVP8 "), Buffer.alloc(16)]);

  for (const [bytes, type, name] of [[svg, "image/svg+xml", "logo.svg"], [svg, "image/png", "logo.png"], [html, "image/jpeg", "foto.jpg"]] as const) {
    for (const kind of ["logo", "cover"]) {
      const res = await send(`${P}/appearance/upload`, bytes, type, name, kind);
      assert.deepEqual([res.status, (await res.json()).error], [400, "Envie uma imagem PNG, JPEG ou WebP."], `${kind} ${name} ${type}`);
    }
    assert.equal((await send(`${P}/items/${itemId}/image`, bytes, type, name)).status, 400, `prato ${name} ${type}`);
  }
  // Real images pass the check even when the browser names them wrong; with no bucket in the tests the upload itself is a 503.
  for (const bytes of [png, jpeg, webp]) {
    assert.equal((await send(`${P}/appearance/upload`, bytes, "application/octet-stream", "sem-extensao", "logo")).status, 503);
    assert.equal((await send(`${P}/items/${itemId}/image`, bytes, "text/plain", "foto.txt")).status, 503);
  }
});

test("pedido malformado responde 400 sem detalhe interno (nada de caminho de arquivo, código ou consulta do Prisma)", async () => {
  const session = crypto.randomUUID();
  for (const itemId of [123, { not: "x" }, null]) {
    const res = await call("POST", "/api/orders", { session, body: { mode: "delivery", restaurantId: R, lines: [{ itemId, quantity: 1, notes: "", selectedOptions: [] }] } });
    assert.equal(res.status, 400, JSON.stringify(itemId));
    assert.doesNotMatch(JSON.stringify(res.body), /prisma|invocation|\.ts|apps[\/]|Argument/i, JSON.stringify(res.body));
  }
});

/** Runs `check` with fogo deactivated by the super admin, then reactivates it whatever happens. */
async function whileInactive(check: () => Promise<void>) {
  const setStatus = (status: string) => call("PATCH", `/api/admin/restaurants/${R}/status`, { token: ADMIN_KEY, body: { status } });
  assert.equal((await setStatus("inativo")).status, 200);
  try {
    await check();
  } finally {
    await setStatus("ativo");
  }
}
const someItem = async () => (await call("GET", `/api/restaurants/${R}/items`)).body.find((i: { soldOut: boolean }) => !i.soldOut) as { id: string };

test("restaurante inativo (ou pendente): o cardápio público some (404); reativado, volta", async () => {
  const item = await someItem();
  const paths = ["", "/categories", "/items", `/items/${item.id}`, "/appearance"];
  await whileInactive(async () => {
    for (const path of paths) assert.equal((await call("GET", `/api/restaurants/${R}${path}`)).status, 404, `GET ${path || "/"}`);
  });
  for (const path of paths) assert.equal((await call("GET", `/api/restaurants/${R}${path}`)).status, 200, `GET ${path || "/"} ativo`);
});

test("restaurante inativo (ou pendente) não recebe pedido de delivery; reativado, recebe", async () => {
  const item = await someItem();
  const order = () => call("POST", "/api/orders", { session: crypto.randomUUID(), body: { mode: "delivery", restaurantId: R, lines: [{ itemId: item.id, quantity: 1, notes: "", selectedOptions: [] }] } });
  await whileInactive(async () => assert.equal((await order()).status, 404));
  assert.equal((await order()).status, 201);
});

test("toda resposta da API sai com cabeçalhos de segurança e sem X-Powered-By (sucesso, 404, erro e o webhook)", async () => {
  const API = process.env.API_URL ?? "http://localhost:4200";
  for (const [method, path] of [["GET", "/api/health"], ["GET", "/api/nao-existe"], ["POST", "/api/whatsapp/webhook"], ["GET", `/api/restaurants/${R}/items`]]) {
    const res = await fetch(`${API}${path}`, { method });
    const label = `${method} ${path} (${res.status})`;
    assert.equal(res.headers.get("x-powered-by"), null, label);
    assert.equal(res.headers.get("x-content-type-options"), "nosniff", label);
    assert.equal(res.headers.get("x-frame-options"), "DENY", label);
    assert.equal(res.headers.get("content-security-policy"), "default-src 'none'; frame-ancestors 'none'", label);
    assert.equal(res.headers.get("referrer-policy"), "no-referrer", label);
  }
});

test("logo e capas: só URL do bucket público (o que o upload devolve) ou a que já estava gravada; javascript: e outros sites, 400", async () => {
  const token = await login();
  const P = `/api/restaurants/${R}`;
  const bucket = `${process.env.STORAGE_PUBLIC_URL}/restaurants/${R}/appearance/teste.png`;
  const draft = (body: unknown) => call("PATCH", `${P}/appearance/draft`, { token, body });
  const profile = (body: unknown) => call("PATCH", `${P}/profile`, { token, body });
  const before = (await call("GET", `${P}/appearance/draft`, { token })).body.draft;
  try {
    for (const url of ["javascript:alert(1)", "https://rastreio.example/pixel.png", "http://public.invalid/x.png", `${process.env.STORAGE_PUBLIC_URL}x/../outro.png`, 42]) {
      assert.equal((await draft({ logoUrl: url })).status, 400, `logo ${url}`);
      assert.equal((await draft({ coverPhotos: [url] })).status, 400, `capa ${url}`);
      assert.equal((await profile({ logoUrl: url })).status, 400, `perfil logo ${url}`);
      assert.equal((await profile({ coverUrl: url })).status, 400, `perfil capa ${url}`);
    }
    assert.equal((await draft({ logoUrl: bucket, coverPhotos: [bucket] })).status, 200);
    assert.equal((await draft({ coverPhotos: [bucket, bucket] })).status, 200, "a que já estava gravada continua valendo");
    assert.equal((await draft({ logoUrl: null, coverPhotos: [] })).status, 200);
    assert.equal((await draft({ coverPhotos: [null] })).status, 400, "capa vazia");
  } finally {
    await draft({ logoUrl: before.logoUrl, coverPhotos: before.coverPhotos });
  }
});

test("em produção a chave do super admin, se definida, tem 32+ caracteres; sem ela, o super admin fica desligado e a API sobe", () => {
  const prod = { NODE_ENV: "production", JWT_SECRET: "x".repeat(32), CORS_ORIGINS: "https://painel.exemplo.com" };
  const weak = boot({ ...prod, SUPER_ADMIN_KEY: "admin123" });
  assert.equal(weak.status, 1);
  assert.match(weak.stderr, /SUPER_ADMIN_KEY com pelo menos 32 caracteres/);
  assert.equal(boot({ ...prod, SUPER_ADMIN_KEY: "k".repeat(32) }).status, 0);
  assert.equal(boot(prod).status, 0, "sem chave: /api/admin responde 503");
  assert.equal(boot({ SUPER_ADMIN_KEY: "admin123" }).status, 0, "fora de produção, como antes");
});
