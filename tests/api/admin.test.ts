import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { R, call, uid } from "./helpers.ts";

const token = process.env.SUPER_ADMIN_KEY ?? "test-admin-key"; // set by tests/run.mjs
let seq = 0;
const cnpj = () => String(Date.now() * 100 + (seq++ % 100)).slice(-12) + "91"; // 14 digits, unique per call
const owner = () => ({ ownerName: "Dona Ana", ownerEmail: `dono-${uid()}@t.com` });

describe("super admin", () => {
  test("sem chave, chave errada ou token de staff → 401", async () => {
    const staff = (await call("POST", "/api/auth/login", { body: { email: "marina@fogoeno.com.br", password: "senha123" } })).body.token;
    for (const t of [undefined, "errada", staff]) assert.equal((await call("GET", "/api/admin/restaurants", { token: t })).status, 401);
  });

  test("cadastra como pendente, formata o CNPJ, recusa CNPJ repetido ou inválido e ativa", async () => {
    const digits = cnpj();
    const created = await call("POST", "/api/admin/restaurants", { token, body: { name: `Cantina São João ${uid()}`, cnpj: digits, contact: "Ana · (11) 99999-0000", ...owner() } });
    assert.equal(created.status, 201);
    assert.equal(created.body.status, "pendente");
    assert.match(created.body.id, /^cantina-sao-joao-/);
    assert.equal(created.body.cnpj.replace(/\D/g, ""), digits);
    assert.match(created.body.cnpj, /^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/);

    assert.equal((await call("POST", "/api/admin/restaurants", { token, body: { name: "Outro", cnpj: digits, ...owner() } })).status, 409);
    assert.equal((await call("POST", "/api/admin/restaurants", { token, body: { name: "Outro", cnpj: "123", ...owner() } })).status, 400);
    assert.equal((await call("POST", "/api/admin/restaurants", { token, body: { name: " ", cnpj: cnpj(), ...owner() } })).status, 400);

    const listed = async () => (await call("GET", "/api/restaurants")).body.some((r: { id: string }) => r.id === created.body.id);
    assert.equal(await listed(), false, "pendente não aparece no delivery");
    assert.equal((await call("PATCH", `/api/admin/restaurants/${created.body.id}/status`, { token, body: { status: "pendente" } })).status, 400);
    assert.equal((await call("PATCH", `/api/admin/restaurants/${created.body.id}/status`, { token, body: { status: "ativo" } })).body.status, "ativo");
    assert.equal(await listed(), true);
    assert.ok((await call("GET", "/api/admin/restaurants", { token })).body.some((r: { id: string; status: string }) => r.id === created.body.id && r.status === "ativo"));
  });

  test("cadastro cria o Dono: e-mail validado e único, loga com a senha provisória só depois de ativar", async () => {
    const o = owner();
    const post = (body: object) => call("POST", "/api/admin/restaurants", { token, body: { name: `Bar ${uid()}`, cnpj: cnpj(), ...o, ...body } });
    assert.equal((await post({ ownerEmail: "sem-arroba" })).status, 400);
    assert.equal((await post({ ownerName: " " })).status, 400);
    assert.equal((await post({ ownerEmail: "marina@fogoeno.com.br" })).status, 409, "e-mail de staff já existente");

    const created = await post({ ownerEmail: o.ownerEmail.toUpperCase() });
    assert.equal(created.status, 201);
    assert.ok(created.body.ownerPassword.length >= 12);
    const login = () => call("POST", "/api/auth/login", { body: { email: o.ownerEmail, password: created.body.ownerPassword } });
    assert.equal((await login()).status, 403, "pendente não loga");
    await call("PATCH", `/api/admin/restaurants/${created.body.id}/status`, { token, body: { status: "ativo" } });
    const ok = await login();
    assert.deepEqual([ok.status, ok.body.staff.role, ok.body.staff.restaurantId], [200, "owner", created.body.id]);
    assert.ok(!(await call("GET", "/api/admin/restaurants", { token })).body.some((r: object) => "ownerPassword" in r), "senha não volta na listagem");
  });

  test("desativar revoga na hora: o token emitido antes já falha no request seguinte, e não loga de novo", async () => {
    const login = () => call("POST", "/api/auth/login", { body: { email: "marina@fogoeno.com.br", password: "senha123" } });
    const old = (await login()).body.token as string;
    // tables = rota de Operação (só requireStaff); finance-entries = rota com requireMinRole
    const statuses = async () => [(await call("GET", `/api/restaurants/${R}/tables`, { token: old })).status, (await call("GET", `/api/restaurants/${R}/finance-entries`, { token: old })).status];
    assert.deepEqual(await statuses(), [200, 200]);
    try {
      await call("PATCH", `/api/admin/restaurants/${R}/status`, { token, body: { status: "inativo" } });
      assert.deepEqual(await statuses(), [401, 401], "mesmo token, request seguinte");
      assert.equal((await login()).status, 403);
    } finally {
      await call("PATCH", `/api/admin/restaurants/${R}/status`, { token, body: { status: "ativo" } });
    }
    assert.deepEqual(await statuses(), [200, 200], "status é lido ao vivo — reativar devolve o acesso");
  });
});

describe("super admin · detalhe do restaurante", () => {
  /** Fresh active restaurant + its Dono's login. */
  async function fresh() {
    const o = owner();
    const created = (await call("POST", "/api/admin/restaurants", { token, body: { name: `Detalhe ${uid()}`, cnpj: cnpj(), contact: "Ana", ...o } })).body;
    await call("PATCH", `/api/admin/restaurants/${created.id}/status`, { token, body: { status: "ativo" } });
    return { id: created.id as string, email: o.ownerEmail, password: created.ownerPassword as string };
  }

  test("mostra configurações atuais, módulos, equipe com papel e o aceite do WhatsApp", async () => {
    const d = (await call("GET", `/api/admin/restaurants/${R}`, { token })).body;
    assert.equal(d.ownerEmail, "marina@fogoeno.com.br");
    assert.deepEqual([d.template, d.paymentMode, d.taxRegime], ["classico", "maquininha_propria", "simples_nacional"]);
    assert.ok(!d.modules.includes("fiscal"));
    assert.ok(d.staff.some((s: { email: string; role: string }) => s.email === "paula@fogoeno.com.br" && s.role === "waiter"));
    assert.ok(!("passwordHash" in d.staff[0]));

    const r = await fresh();
    const url = `/api/admin/restaurants/${r.id}`;
    assert.deepEqual((await call("GET", url, { token })).body.whatsapp, { state: "disconnected", termsAcceptedAt: null, termsAcceptedBy: null });
    const dono = (await call("POST", "/api/auth/login", { body: { email: r.email, password: r.password } })).body.token;
    await call("POST", `/api/restaurants/${r.id}/whatsapp/terms`, { token: dono });
    const wa = (await call("GET", url, { token })).body.whatsapp;
    assert.equal(wa.termsAcceptedBy, "Dona Ana");
    assert.ok(Date.now() - Date.parse(wa.termsAcceptedAt) < 60_000);
    assert.equal((await call("GET", "/api/admin/restaurants/nao-existe", { token })).status, 404);
  });

  test("edita nome, CNPJ, contato e e-mail do dono — o Dono passa a logar com o e-mail novo", async () => {
    const r = await fresh();
    const url = `/api/admin/restaurants/${r.id}`;
    const digits = cnpj();
    const newEmail = `novo-${uid()}@t.com`;
    const res = await call("PATCH", url, { token, body: { name: "Cantina Nova", cnpj: digits, contact: "Beto · (11) 3333-0000", ownerEmail: newEmail.toUpperCase() } });
    assert.equal(res.status, 200);
    assert.deepEqual([res.body.name, res.body.cnpj.replace(/\D/g, ""), res.body.contact, res.body.ownerEmail], ["Cantina Nova", digits, "Beto · (11) 3333-0000", newEmail]);
    assert.equal((await call("PATCH", url, { token, body: { contact: "só contato" } })).body.name, "Cantina Nova", "campo ausente não muda");

    const login = (email: string) => call("POST", "/api/auth/login", { body: { email, password: r.password } });
    assert.equal((await login(r.email)).status, 401);
    assert.equal((await login(newEmail)).status, 200);
  });

  test("valida: nome vazio, CNPJ inválido ou de outro restaurante, e-mail inválido ou de outra pessoa", async () => {
    const url = `/api/admin/restaurants/${(await fresh()).id}`;
    for (const bad of [{ name: " " }, { cnpj: "123" }, { ownerEmail: "sem-arroba" }]) assert.equal((await call("PATCH", url, { token, body: bad })).status, 400, JSON.stringify(bad));
    assert.equal((await call("PATCH", url, { token, body: { cnpj: "12.345.678/0001-90" } })).status, 409, "CNPJ do fogo");
    assert.equal((await call("PATCH", url, { token, body: { ownerEmail: "marina@fogoeno.com.br" } })).status, 409);
    assert.equal((await call("PATCH", "/api/admin/restaurants/nao-existe", { token, body: { name: "X" } })).status, 404);
  });

  test("token de staff não lê nem edita o detalhe", async () => {
    const staff = (await call("POST", "/api/auth/login", { body: { email: "marina@fogoeno.com.br", password: "senha123" } })).body.token;
    assert.equal((await call("GET", `/api/admin/restaurants/${R}`, { token: staff })).status, 401);
    assert.equal((await call("PATCH", `/api/admin/restaurants/${R}`, { token: staff, body: { name: "Hack" } })).status, 401);
  });
});
