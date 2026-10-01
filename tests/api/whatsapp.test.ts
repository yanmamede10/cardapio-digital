import assert from "node:assert/strict";
import http from "node:http";
import { after, before, describe, test } from "node:test";
import { R, call, firstLogin, login, uid } from "./helpers.ts";

// The API under test is pointed (tests/run.mjs) at this fake Evolution on :4299, so it runs its real Evolution adapter
// against canned answers — no Evolution, no phone. Webhook payloads below have the shape Evolution v2.3.7 posts.
// The same server is the S3 of the private WhatsApp bucket ("wa-test"): PutObject = PUT /wa-test/<key>.
type Req = { method: string; path: string; body: any; apikey?: string };
const seen: Req[] = [];
const uploads: { path: string; type?: string }[] = [];
const instances = new Set<string>();
let scanned = false;
let failSends = false;
let failReads = false;
let failUploads = false;
const files = new Map<string, Buffer>(); // received message id → the bytes getBase64FromMediaMessage hands back

const evolution = http.createServer((req, res) => {
  const chunks: Buffer[] = [];
  req.on("data", (c) => chunks.push(c)).on("end", () => {
    if (req.method === "PUT" && req.url!.startsWith("/wa-test/")) {
      uploads.push({ path: req.url!.split("?")[0], type: req.headers["content-type"] });
      return res.writeHead(failUploads ? 403 : 200, { ETag: '"fake"' }).end();
    }
    const raw = Buffer.concat(chunks).toString();
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
    if (action === "getBase64FromMediaMessage") {
      const file = files.get(r.body?.message?.key?.id);
      return file ? json(201, { mediaType: "imageMessage", base64: file.toString("base64") }) : json(400, { status: 400, error: "Message not found" });
    }
    if (action === "markMessageAsRead") return failReads ? json(500, { status: 500, error: "Internal Server Error" }) : json(201, { message: "Read messages", read: "success" });
    json(404, {});
  });
});
const sends = () => seen.filter((r) => r.path.startsWith("/message/"));
const reads = () => seen.filter((r) => r.path.startsWith("/chat/markMessageAsRead/"));
const downloads = () => seen.filter((r) => r.path.startsWith("/chat/getBase64FromMediaMessage/"));

let firstId = ""; // the first customer message — still unread when Atendimento first replies
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
const ticketOf = async (from = phone) => (await call("GET", `${P()}/tickets`, { token: owner })).body.find((t: { refLabel: string }) => t.refLabel === `WhatsApp · +${from}`);
/** A photo or voice note as Evolution posts it: no bytes (base64: false), only what the message says; `file` is what
 *  downloadMedia gets back for it. */
const mediaMsg = (kind: "image" | "audio", media: { mimetype: string; caption?: string; fileLength?: unknown }, file?: Buffer, base = text("")) => {
  if (file) files.set(base.key.id, file);
  return { ...base, messageType: `${kind}Message`, message: { [`${kind}Message`]: media } };
};

before(async () => {
  await new Promise<void>((ok) => evolution.listen(4299, ok));
  const admin = process.env.SUPER_ADMIN_KEY ?? "test-admin-key";
  const email = `dono-zap-${uid()}@t.com`;
  const cnpj = String(Date.now()).slice(-12) + "77";
  const created = await call("POST", "/api/admin/restaurants", { token: admin, body: { name: `Zap ${uid()}`, cnpj, ownerName: "Dona Zap", ownerEmail: email } });
  A = created.body.id;
  await call("PATCH", `/api/admin/restaurants/${A}/status`, { token: admin, body: { status: "ativo" } });
  owner = await firstLogin(email, created.body.ownerPassword);
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
    assert.deepEqual(create.body.webhook, { enabled: true, url: "http://localhost:4200/api/whatsapp/webhook", headers: SECRET, byEvents: false, base64: false, events: ["MESSAGES_UPSERT"] });
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

  test("sem o segredo, a recusa vem antes de ler o corpo; com o segredo, corpo acima de 2 MB → 413", async () => {
    const API = process.env.API_URL ?? "http://localhost:4200";
    // Announces 50 MB and sends a few bytes: the 401 must come back while the body is still "on its way".
    const early = await new Promise<number | "esperou o corpo">((resolve) => {
      const req = http.request(`${API}/api/whatsapp/webhook`, { method: "POST", headers: { "Content-Type": "application/json", "Content-Length": String(50 * 1024 * 1024) } }, (res) => {
        res.resume();
        resolve(res.statusCode!);
        req.destroy();
      });
      req.on("error", () => {}); // the socket we tear down after the answer
      req.write('{"event":"messages.upsert","data":"');
      setTimeout(() => (resolve("esperou o corpo"), req.destroy()), 5000);
    });
    assert.equal(early, 401);

    const limit = 2 * 1024 * 1024; // no media bytes in the webhook any more
    const over = await fetch(`${API}/api/whatsapp/webhook`, { method: "POST", headers: { "Content-Type": "application/json", ...SECRET }, body: JSON.stringify({ event: "messages.upsert", pad: "x".repeat(limit) }) });
    assert.equal(over.status, 413);
    const under = await hook({ ...upsert(text("")), pad: "x".repeat(limit - 2048) });
    assert.equal(under.status, 200, "logo abaixo do limite passa");
  });

  test("mensagem recebida vira ticket WhatsApp no restaurante certo; reentrega não duplica; receber nunca envia nada nem marca como lida", async () => {
    const msg = text("Oi, vocês abrem hoje?");
    firstId = msg.key.id;
    assert.equal((await hook(upsert(msg))).status, 200);
    assert.equal((await hook(upsert(msg))).status, 200, "Evolution reentregando");

    const t = await ticketOf();
    assert.deepEqual([t.customerName, t.refLabel, t.status, t.unreadCount], ["João Cliente", `WhatsApp · +${phone}`, "new", 1]);
    assert.deepEqual(t.messages.map((m: { from: string; text: string }) => [m.from, m.text]), [["customer", "Oi, vocês abrem hoje?"]]);
    assert.equal(sends().length, 0, "nada de confirmação/boas-vindas automática");
    assert.equal(reads().length, 0, "receber não dá visto");

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

  test("responder no Atendimento envia pelo provedor e dá visto nas pendentes; envio que falha não fica como enviado nem dá visto", async () => {
    const t = await ticketOf();
    const sent = await call("POST", `${P()}/tickets/${t.id}/messages`, { token: owner, body: { text: "Abrimos às 18h!" } });
    assert.equal(sent.status, 201);
    const [out] = sends();
    assert.deepEqual([out.path, out.apikey, out.body], [`/message/sendText/${A}`, "test-evo-key", { number: phone, text: "Abrimos às 18h!" }]);
    assert.deepEqual([sent.body.status, sent.body.unreadCount, sent.body.messages.at(-1).text], ["in_progress", 0, "Abrimos às 18h!"]);
    assert.deepEqual(
      reads().map((r) => [r.path, r.body]),
      [[`/chat/markMessageAsRead/${A}`, { readMessages: [{ remoteJid: `${phone}@s.whatsapp.net`, fromMe: false, id: firstId }] }]],
      "visto só na mensagem que estava pendente"
    );

    await hook(upsert(text("E no domingo?"))); // pending again, so a failed send would have something to mark
    failSends = true;
    const failed = await call("POST", `${P()}/tickets/${t.id}/messages`, { token: owner, body: { text: "não vai" } });
    failSends = false;
    assert.equal(failed.status, 502);
    assert.equal(reads().length, 1, "envio que falhou não dá visto");
    assert.equal((await ticketOf()).messages.length, 3);

    failReads = true;
    const delivered = await call("POST", `${P()}/tickets/${t.id}/messages`, { token: owner, body: { text: "Domingo também!" } });
    failReads = false;
    assert.equal(reads().length, 2, "tentou dar o visto");
    assert.deepEqual([delivered.status, delivered.body.messages.at(-1).text], [201, "Domingo também!"], "visto que falha não vira erro da resposta já enviada");
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

  test("imagem que o Storage recusa não se perde: fica o aviso para ver no celular", async () => {
    failUploads = true;
    await hook(upsert(mediaMsg("image", { mimetype: "image/jpeg", caption: "cardápio?" }, Buffer.from("fake"))));
    failUploads = false;
    const last = (await ticketOf()).messages.at(-1);
    assert.deepEqual([last.text, last.mediaUrl], ["[Imagem — não foi possível salvar, veja no celular] cardápio?", null]);
  });

  test("mídia vai para o bucket privado (tipo sem parâmetro) e o payload só traz URL assinada, nunca a pública", async () => {
    await hook(upsert(mediaMsg("audio", { mimetype: "audio/ogg; codecs=opus" }, Buffer.from("OggS"))));
    const up = uploads.at(-1)!;
    assert.match(up.path, new RegExp(`^/wa-test/${A}/[0-9a-f-]{36}\\.ogg$`));
    assert.equal(up.type, "audio/ogg");

    const t = await ticketOf();
    const url = new URL(t.messages.at(-1).mediaUrl);
    assert.equal(url.origin + url.pathname, `http://localhost:4299${up.path}`);
    assert.ok(url.searchParams.get("X-Amz-Signature"), "assinada");
    assert.equal(url.searchParams.get("X-Amz-Expires"), "3600");
    assert.ok(process.env.STORAGE_PUBLIC_URL && !JSON.stringify(t).includes(process.env.STORAGE_PUBLIC_URL), "nada do bucket público");
  });

  test("mídia recebida acima de 8 MB não é baixada e a conversa certa avisa o atendente; até 8 MB chega normal", async () => {
    const MB = 1024 * 1024;
    const other = `55219${String(Date.now()).slice(-8)}`;
    const fromOther = text("", { key: { remoteJid: `${other}@s.whatsapp.net`, fromMe: false, id: `BIG-${uid()}` }, pushName: "Maria" });
    // 12 MB as Evolution declares it (Baileys' Long): no download, the note in Maria's conversation, João's untouched.
    const before = (await ticketOf()).messages.length;
    const big = mediaMsg("image", { mimetype: "image/jpeg", caption: "o cardápio", fileLength: { low: 12 * MB, high: 0, unsigned: true } }, undefined, fromOther);
    assert.equal((await hook(upsert(big))).status, 200);
    const maria = (await ticketOf(other)).messages.at(-1);
    assert.deepEqual([maria.from, maria.text, maria.mediaUrl], ["customer", "[Arquivo de 12 MB não recebido (o limite é 8 MB). Peça para o cliente enviar de outro jeito.] o cardápio", null]);
    assert.ok(!downloads().some((r) => r.body.message.key.id === big.key.id), "não baixou");
    assert.equal((await ticketOf()).messages.length, before, "a conversa do João não muda");

    // Exactly 8 MB (declared as a string): downloaded and kept in the private bucket.
    const ok = mediaMsg("audio", { mimetype: "audio/ogg; codecs=opus", fileLength: String(8 * MB) }, Buffer.alloc(8 * MB));
    assert.equal((await hook(upsert(ok))).status, 200);
    let last = (await ticketOf()).messages.at(-1);
    assert.deepEqual([last.text, last.mediaType, Boolean(last.mediaUrl)], ["", "audio", true]);
    assert.deepEqual(downloads().at(-1)!.body, { message: { key: { id: ok.key.id } }, convertToMp4: false });

    // No size declared, and the file turns out bigger than 8 MB: not kept either.
    await hook(upsert(mediaMsg("image", { mimetype: "image/jpeg" }, Buffer.alloc(8 * MB + 1))));
    last = (await ticketOf()).messages.at(-1);
    assert.deepEqual([last.text, last.mediaUrl], ["[Arquivo de 8,1 MB não recebido (o limite é 8 MB). Peça para o cliente enviar de outro jeito.]", null]);
  });

  test("mídia acima de 8 MB pelo Atendimento: 413 com a mensagem para quem enviou; exatamente 8 MB passa", async () => {
    const t = await ticketOf();
    const send = (bytes: number) => {
      const form = new FormData();
      form.append("file", new Blob([new Uint8Array(bytes)], { type: "image/jpeg" }), "foto.jpg");
      return fetch(`${process.env.API_URL ?? "http://localhost:4200"}${P()}/tickets/${t.id}/media`, { method: "POST", headers: { Authorization: `Bearer ${owner}` }, body: form });
    };
    const big = await send(8 * 1024 * 1024 + 1);
    assert.equal(big.status, 413);
    assert.equal((await big.json()).error, "Arquivo acima de 8 MB. Envie uma imagem menor ou um áudio mais curto.");
    assert.equal((await send(8 * 1024 * 1024)).status, 201);
  });

  test("desconectar remove a sessão no provedor", async () => {
    const res = await call("POST", `${P()}/whatsapp/disconnect`, { token: owner });
    assert.equal(res.body.state, "disconnected");
    assert.ok(seen.some((r) => r.method === "DELETE" && r.path === `/instance/delete/${A}`));
  });
});
