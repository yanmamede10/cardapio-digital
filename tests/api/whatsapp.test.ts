import assert from "node:assert/strict";
import http from "node:http";
import { after, before, describe, test } from "node:test";
import { R, call, login, uid } from "./helpers.ts";

// The API under test is pointed (tests/run.mjs) at this fake Evolution on :4299, so it runs its real Evolution adapter
// against canned answers — no Evolution, no phone. Webhook payloads below have the shape Evolution v2.3.7 posts.
type Req = { method: string; path: string; body: any; apikey?: string };
const seen: Req[] = [];
const instances = new Set<string>();
let scanned = false;
let failSends = false;

const evolution = http.createServer((req, res) => {
  let raw = "";
  req.on("data", (c) => (raw += c)).on("end", () => {
    const r: Req = { method: req.method!, path: req.url!, body: raw ? JSON.parse(raw) : null, apikey: req.headers.apikey as string };
    seen.push(r);
    const json = (status: number, b: unknown) => res.writeHead(status, { "Content-Type": "application/json" }).end(JSON.stringify(b));
    const [, group, action, name = ""] = r.path.split("/");
    if (r.apikey !== "test-evo-key") return json(401, { status: 401, error: "Unauthorized" });
    if (action === "create") return instances.add(r.body.instanceName), json(201, { instance: { instanceName: r.body.instanceName, status: "close" } });
    if (!instances.has(decodeURIComponent(name))) return json(404, { status: 404, error: "Not Found" });
    if (action === "connectionState") return json(200, { instance: { instanceName: name, state: scanned ? "open" : "connecting" } });
    if (action === "connect") return json(200, scanned ? { instance: { instanceName: name, state: "open" } } : { pairingCode: null, code: "2@abc", base64: "data:image/png;base64,QR", count: 1 });
    if (action === "delete") return instances.delete(decodeURIComponent(name)), json(200, { status: "SUCCESS", error: false });
    if (group === "message") return failSends ? json(500, { status: 500, error: "Internal Server Error" }) : json(201, { key: { id: `SENT-${seen.length}` } });
    json(404, {});
  });
});
const sends = () => seen.filter((r) => r.path.startsWith("/message/"));

let A: string; // fresh restaurant that sets WhatsApp up (keeps the seeded one untouched for the UI tests)
let owner: string;
let fogoOwner: string;
const phone = `55119${String(Date.now()).slice(-8)}`;
const P = () => `/api/restaurants/${A}`;

const SECRET = { "x-webhook-secret": "test-webhook-secret" };
const upsert = (data: object, instance = A) => ({ event: "messages.upsert", instance, data });
const text = (conversation: string, over: object = {}) => ({
  key: { remoteJid: `${phone}@s.whatsapp.net`, fromMe: false, id: `IN-${uid()}` },
  pushName: "João Cliente",
  messageType: "conversation",
  messageTimestamp: Math.floor(Date.now() / 1000),
  message: { conversation },
  ...over
});
const hook = (payload: object, headers: Record<string, string> = SECRET) => call("POST", "/api/whatsapp/webhook", { body: payload, headers });
const ticketOf = async () => (await call("GET", `${P()}/tickets`, { token: owner })).body.find((t: { channel: string }) => t.channel === "whatsapp");

before(async () => {
  await new Promise<void>((ok) => evolution.listen(4299, ok));
  const admin = process.env.SUPER_ADMIN_KEY ?? "test-admin-key";
  const email = `dono-zap-${uid()}@t.com`;
  const cnpj = String(Date.now()).slice(-12) + "77";
  const created = await call("POST", "/api/admin/restaurants", { token: admin, body: { name: `Zap ${uid()}`, cnpj, ownerName: "Dona Zap", ownerEmail: email } });
  A = created.body.id;
  await call("PATCH", `/api/admin/restaurants/${A}/status`, { token: admin, body: { status: "ativo" } });
  owner = (await call("POST", "/api/auth/login", { body: { email, password: created.body.ownerPassword } })).body.token;
  fogoOwner = await login();
});
after(() => new Promise<void>((ok) => evolution.close(() => ok())));

describe("WhatsApp (Evolution)", () => {
  test("conectar: só o Dono, só depois de aceitar o aviso (fica registrado quem e quando), e o QR vem do provedor", async () => {
    assert.deepEqual((await call("GET", `${P()}/whatsapp`, { token: owner })).body, { state: "disconnected", termsAcceptedAt: null, termsAcceptedBy: null });
    assert.equal((await call("POST", `${P()}/whatsapp/connect`, { token: owner })).status, 409, "sem aceite não conecta");

    const accepted = (await call("POST", `${P()}/whatsapp/terms`, { token: owner })).body;
    assert.equal(accepted.termsAcceptedBy, "Dona Zap");
    assert.ok(Date.now() - Date.parse(accepted.termsAcceptedAt) < 60_000);

    const connecting = await call("POST", `${P()}/whatsapp/connect`, { token: owner });
    assert.deepEqual(connecting.body, { state: "connecting", qr: "data:image/png;base64,QR" });
    const create = seen.find((r) => r.path === "/instance/create")!;
    assert.equal(create.apikey, "test-evo-key");
    assert.equal(create.body.instanceName, A);
    assert.deepEqual(create.body.webhook, { enabled: true, url: "http://localhost:4200/api/whatsapp/webhook", headers: SECRET, byEvents: false, base64: true, events: ["MESSAGES_UPSERT"] });
    assert.deepEqual([create.body.groupsIgnore, create.body.alwaysOnline, create.body.readMessages], [true, false, false]);

    scanned = true;
    assert.equal((await call("GET", `${P()}/whatsapp`, { token: owner })).body.state, "connected");

    const [waiter, kitchen] = await Promise.all([login("paula@fogoeno.com.br"), login("igor@fogoeno.com.br")]);
    assert.equal((await call("GET", `/api/restaurants/${R}/whatsapp`, { token: waiter })).status, 200, "garçom vê o indicador");
    assert.equal((await call("POST", `/api/restaurants/${R}/whatsapp/connect`, { token: waiter })).status, 403, "mas não conecta");
    assert.equal((await call("GET", `/api/restaurants/${R}/whatsapp`, { token: kitchen })).status, 403, "cozinha fora do Atendimento");
  });

  test("webhook sem o segredo (ou com outro) é rejeitado e não cria nada", async () => {
    assert.equal((await hook(upsert(text("oi")), {})).status, 401);
    assert.equal((await hook(upsert(text("oi")), { "x-webhook-secret": "chute" })).status, 401);
    assert.equal(await ticketOf(), undefined);
  });

  test("mensagem recebida vira ticket WhatsApp no restaurante certo; reentrega não duplica; receber nunca envia nada", async () => {
    const msg = text("Oi, vocês abrem hoje?");
    assert.equal((await hook(upsert(msg))).status, 200);
    assert.equal((await hook(upsert(msg))).status, 200, "Evolution reentregando");

    const t = await ticketOf();
    assert.deepEqual([t.customerName, t.refLabel, t.status, t.unreadCount], ["João Cliente", `WhatsApp · +${phone}`, "new", 1]);
    assert.deepEqual(t.messages.map((m: { from: string; text: string }) => [m.from, m.text]), [["customer", "Oi, vocês abrem hoje?"]]);
    assert.equal(sends().length, 0, "nada de confirmação/boas-vindas automática");

    // Groups and reactions are not conversations.
    await hook(upsert(text("grupo", { key: { remoteJid: "1203630@g.us", fromMe: false, id: `G-${uid()}` } })));
    await hook(upsert({ ...text(""), messageType: "reactionMessage", message: { reactionMessage: { text: "👍" } } }));
    assert.equal((await ticketOf()).messages.length, 1);
  });

  test("isolamento: outro restaurante não vê nem responde o ticket, e webhook de instância alheia não cria nada lá", async () => {
    const t = await ticketOf();
    assert.equal((await call("GET", `${P()}/tickets`, { token: fogoOwner })).status, 403);
    assert.equal((await call("GET", `${P()}/whatsapp`, { token: fogoOwner })).status, 403);
    assert.equal((await call("POST", `/api/restaurants/${R}/tickets/${t.id}/messages`, { token: fogoOwner, body: { text: "invasão" } })).status, 404);
    assert.equal((await call("POST", `/api/restaurants/${R}/whatsapp/disconnect`, { token: fogoOwner })).status, 200, "desconecta só a própria instância");
    assert.ok(!seen.some((r) => r.path === `/instance/delete/${A}`), "a instância de A segue intacta");

    await hook(upsert(text("oi, fogo"), R)); // "fogo" never accepted the notice
    const fogo = (await call("GET", `/api/restaurants/${R}/tickets`, { token: fogoOwner })).body;
    assert.ok(!fogo.some((x: { channel: string }) => x.channel === "whatsapp"));
    assert.equal(sends().length, 0);
  });

  test("responder no Atendimento chama o provedor com o número do contato; se o provedor falha, nada fica como enviado", async () => {
    const t = await ticketOf();
    const sent = await call("POST", `${P()}/tickets/${t.id}/messages`, { token: owner, body: { text: "Abrimos às 18h!" } });
    assert.equal(sent.status, 201);
    const [out] = sends();
    assert.deepEqual([out.path, out.apikey, out.body], [`/message/sendText/${A}`, "test-evo-key", { number: phone, text: "Abrimos às 18h!" }]);
    assert.deepEqual([sent.body.status, sent.body.unreadCount, sent.body.messages.at(-1).text], ["in_progress", 0, "Abrimos às 18h!"]);

    failSends = true;
    const failed = await call("POST", `${P()}/tickets/${t.id}/messages`, { token: owner, body: { text: "não vai" } });
    failSends = false;
    assert.equal(failed.status, 502);
    assert.equal((await ticketOf()).messages.length, 2);
  });

  test("o que o celular do restaurante manda aparece na conversa; cliente escrevendo num resolvido reabre o mesmo ticket", async () => {
    const t = await ticketOf();
    await hook(upsert(text("Olá! Obrigado pelo contato, já respondemos.", { key: { remoteJid: `${phone}@s.whatsapp.net`, fromMe: true, id: `ME-${uid()}` }, pushName: "Zap Restaurante" })));
    let now = await ticketOf();
    const last = now.messages.at(-1);
    assert.deepEqual([last.from, last.authorName, now.unreadCount, now.customerName], ["staff", "Celular do restaurante", 0, "João Cliente"]);

    await call("PATCH", `${P()}/tickets/${t.id}`, { token: owner, body: { status: "resolved" } });
    await hook(upsert(text("Mais uma dúvida")));
    now = await ticketOf();
    assert.deepEqual([now.id, now.status, now.unreadCount], [t.id, "new", 1]);
    assert.equal((await call("GET", `${P()}/tickets`, { token: owner })).body.filter((x: { channel: string }) => x.channel === "whatsapp").length, 1);
  });

  test("imagem sem Storage não se perde: fica o aviso para ver no celular", async () => {
    await hook(upsert({ ...text(""), messageType: "imageMessage", message: { imageMessage: { mimetype: "image/jpeg", caption: "cardápio?" }, base64: Buffer.from("fake").toString("base64") } }));
    const last = (await ticketOf()).messages.at(-1);
    assert.deepEqual([last.text, last.mediaUrl], ["[Imagem — não foi possível salvar, veja no celular] cardápio?", null]);
  });

  test("desconectar remove a sessão no provedor", async () => {
    const res = await call("POST", `${P()}/whatsapp/disconnect`, { token: owner });
    assert.equal(res.body.state, "disconnected");
    assert.ok(seen.some((r) => r.method === "DELETE" && r.path === `/instance/delete/${A}`));
  });
});
