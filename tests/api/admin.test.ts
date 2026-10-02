import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { ALL_MODULES, R, call, firstLogin, uid } from "./helpers.ts";

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
    assert.equal(await listed(), false, "ativo, mas sem o módulo Delivery (F-6)");
    assert.equal((await call("PATCH", `/api/admin/restaurants/${created.body.id}/modules`, { token, body: { modules: ALL_MODULES } })).status, 200);
    assert.equal(await listed(), true, "com o Delivery ligado pelo super admin");
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
    assert.deepEqual([ok.status, ok.body.staff.role, ok.body.staff.restaurantId, ok.body.mustChangePassword], [200, "owner", created.body.id, true]);
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

/** Fresh active restaurant + its Dono's login (provisional password). */
async function fresh() {
  const o = owner();
  const created = (await call("POST", "/api/admin/restaurants", { token, body: { name: `Detalhe ${uid()}`, cnpj: cnpj(), contact: "Ana", ...o } })).body;
  await call("PATCH", `/api/admin/restaurants/${created.id}/status`, { token, body: { status: "ativo" } });
  return { id: created.id as string, email: o.ownerEmail, password: created.ownerPassword as string };
}

describe("super admin · detalhe do restaurante", () => {

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
    const dono = await firstLogin(r.email, r.password);
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

describe("super admin · resetar senha", () => {
  test("gera senha provisória, derruba a sessão aberta e obriga a troca no próximo login", async () => {
    const r = await fresh();
    const dono = await firstLogin(r.email, r.password);
    const email = `garcom-${uid()}@t.com`;
    const waiter = (await call("POST", `/api/restaurants/${r.id}/staff`, { token: dono, body: { name: "Gil", email, role: "waiter", password: "segredo1" } })).body;
    const login = (password: string) => call("POST", "/api/auth/login", { body: { email, password } });
    const before = await login("segredo1");
    assert.equal(before.body.mustChangePassword, false, "senha dada pelo Dono não é provisória");
    const tables = (t: string) => call("GET", `/api/restaurants/${r.id}/tables`, { token: t });
    assert.equal((await tables(before.body.token)).status, 200);

    const reset = await call("POST", `/api/admin/restaurants/${r.id}/staff/${waiter.id}/reset-password`, { token });
    assert.equal(reset.status, 200);
    assert.ok(reset.body.password.length >= 12);
    const pwd = reset.body.password as string;
    assert.equal((await tables(before.body.token)).status, 401, "sessão aberta antes do reset cai na hora (F-2)");
    assert.equal((await login("segredo1")).status, 401, "senha antiga não vale mais");

    const t = await login(pwd);
    assert.deepEqual([t.status, t.body.mustChangePassword], [200, true]);
    const tok = t.body.token as string;
    assert.equal((await tables(tok)).status, 403, "com senha provisória, só a troca");
    assert.equal((await call("GET", "/api/auth/me", { token: tok })).body.mustChangePassword, true);
    const change = (currentPassword: string, newPassword: string) => call("POST", "/api/auth/password", { token: tok, body: { currentPassword, newPassword } });
    assert.equal((await change("errada", "nova-senha-1")).status, 400);
    assert.equal((await change(pwd, "123")).status, 400, "curta");
    assert.equal((await change(pwd, pwd)).status, 400, "igual à provisória");
    const changed = await change(pwd, "nova-senha-1");
    assert.equal(changed.status, 200);
    assert.equal((await tables(changed.body.token)).status, 200, "trocou: este aparelho segue, com o token novo (F-2)");
    assert.deepEqual([(await tables(tok)).status, (await tables(before.body.token)).status], [401, 401], "os tokens de antes não voltam");
    assert.equal((await login("nova-senha-1")).body.mustChangePassword, false);
  });

  test("404 pra usuário de outro restaurante; token de staff não reseta", async () => {
    const r = await fresh();
    const donoId = (await call("GET", `/api/admin/restaurants/${r.id}`, { token })).body.staff[0].id;
    assert.equal((await call("POST", `/api/admin/restaurants/${R}/staff/${donoId}/reset-password`, { token })).status, 404);
    const staff = (await call("POST", "/api/auth/login", { body: { email: "marina@fogoeno.com.br", password: "senha123" } })).body.token;
    assert.equal((await call("POST", `/api/admin/restaurants/${r.id}/staff/${donoId}/reset-password`, { token: staff })).status, 401);
    assert.equal((await call("POST", "/api/auth/login", { body: { email: r.email, password: r.password } })).status, 200, "nada foi resetado");
  });
});

describe("super admin · mensalidades", () => {
  test("ciclo: valor e dia, gerar o mês, atrasar, marcar pago — a Minha Fatura mostra igual e ninguém é desativado", async () => {
    const r = await fresh();
    const dono = await firstLogin(r.email, r.password);
    const plan = await call("PATCH", `/api/admin/restaurants/${r.id}/plan`, { token, body: { planPrice: 249.9, planDueDay: 5 } });
    assert.deepEqual([plan.status, plan.body.planPrice, plan.body.planDueDay], [200, 249.9, 5]);

    const month = "2025-01"; // past: due on the 5th and unpaid → atrasado (computed, never stored)
    const gen = await call("POST", "/api/admin/billing", { token, body: { month } });
    assert.equal(gen.status, 201);
    assert.ok(gen.body.created >= 1);
    assert.equal((await call("POST", "/api/admin/billing", { token, body: { month } })).body.created, 0, "gerar de novo não duplica");

    const charge = (await call("GET", "/api/admin/billing", { token })).body.find((c: { restaurantId: string; month: string }) => c.restaurantId === r.id && c.month === month);
    assert.deepEqual([charge.status, charge.value, charge.description, charge.restaurantName.startsWith("Detalhe")], ["overdue", 249.9, "Mensalidade 01/2025", true]);
    assert.equal(new Date(charge.date).toLocaleDateString("sv-SE"), "2025-01-05");

    const fatura = async () => (await call("GET", `/api/restaurants/${r.id}/finance`, { token: dono })).body;
    let f = await fatura();
    assert.equal(f.planPrice, 249.9);
    assert.equal(f.charges.find((c: { id: string }) => c.id === charge.id).status, "overdue");
    assert.equal(new Date(f.planDueDate).toLocaleDateString("sv-SE"), "2025-01-05", "vence = a mensalidade mais antiga em aberto");
    assert.equal((await call("GET", `/api/admin/restaurants/${r.id}`, { token })).body.status, "ativo", "atrasado não desativa");

    const paid = await call("POST", `/api/admin/billing/${charge.id}/pay`, { token, body: { paidOn: "2025-02-03", paymentMethod: "PIX" } });
    assert.deepEqual([paid.status, paid.body.status, paid.body.paidOn, paid.body.paymentMethod], [200, "paid", "2025-02-03", "PIX"]);
    f = await fatura();
    const seen = f.charges.find((c: { id: string }) => c.id === charge.id);
    assert.deepEqual([seen.status, seen.paidOn, seen.paymentMethod], ["paid", "2025-02-03", "PIX"]);
  });

  test("antes do vencimento é pendente; só restaurante ativo com valor entra na geração", async () => {
    const active = await fresh();
    await call("PATCH", `/api/admin/restaurants/${active.id}/plan`, { token, body: { planPrice: 100, planDueDay: 28 } });
    const pending = (await call("POST", "/api/admin/restaurants", { token, body: { name: `Pendente ${uid()}`, cnpj: cnpj(), ...owner() } })).body;
    await call("PATCH", `/api/admin/restaurants/${pending.id}/plan`, { token, body: { planPrice: 100, planDueDay: 28 } });
    const noPrice = await fresh();

    await call("POST", "/api/admin/billing", { token, body: { month: "2099-12" } });
    const list = (await call("GET", "/api/admin/billing", { token })).body.filter((c: { month: string }) => c.month === "2099-12");
    assert.equal(list.find((c: { restaurantId: string }) => c.restaurantId === active.id)?.status, "pending");
    assert.ok(!list.some((c: { restaurantId: string }) => c.restaurantId === pending.id || c.restaurantId === noPrice.id));
  });

  test("valida valor, dia, mês, data e forma de pagamento", async () => {
    const url = `/api/admin/restaurants/${(await fresh()).id}/plan`;
    for (const bad of [{ planPrice: -1, planDueDay: 5 }, { planPrice: "10", planDueDay: 5 }, { planPrice: 10, planDueDay: 0 }, { planPrice: 10, planDueDay: 29 }, { planPrice: 10, planDueDay: 1.5 }]) {
      assert.equal((await call("PATCH", url, { token, body: bad })).status, 400, JSON.stringify(bad));
    }
    assert.equal((await call("PATCH", "/api/admin/restaurants/nao-existe/plan", { token, body: { planPrice: 1, planDueDay: 1 } })).status, 404);
    for (const month of ["2025-13", "jan", undefined]) assert.equal((await call("POST", "/api/admin/billing", { token, body: { month } })).status, 400, String(month));
    const charge = (await call("GET", "/api/admin/billing", { token })).body[0];
    assert.equal((await call("POST", `/api/admin/billing/${charge.id}/pay`, { token, body: { paidOn: "03/02/2025", paymentMethod: "PIX" } })).status, 400);
    assert.equal((await call("POST", `/api/admin/billing/${charge.id}/pay`, { token, body: { paidOn: "2025-02-03", paymentMethod: "Cheque" } })).status, 400);
    assert.equal((await call("POST", "/api/admin/billing/nao-existe/pay", { token, body: { paidOn: "2025-02-03", paymentMethod: "PIX" } })).status, 404);
  });
});

test("só o super admin: token de staff (até de Dono) recebe 401 em todas as rotas de /api/admin", async () => {
  const staff = (await call("POST", "/api/auth/login", { body: { email: "marina@fogoeno.com.br", password: "senha123" } })).body.token;
  const routes: [string, string][] = [
    ["GET", "/restaurants"],
    ["POST", "/restaurants"],
    ["GET", `/restaurants/${R}`],
    ["PATCH", `/restaurants/${R}`],
    ["PATCH", `/restaurants/${R}/status`],
    ["PATCH", `/restaurants/${R}/modules`],
    ["PATCH", `/restaurants/${R}/plan`],
    ["POST", `/restaurants/${R}/staff/x/reset-password`],
    ["GET", "/billing"],
    ["POST", "/billing"],
    ["POST", "/billing/x/pay"]
  ];
  for (const [method, path] of routes) {
    for (const t of [staff, undefined]) assert.equal((await call(method, `/api/admin${path}`, { token: t, body: method === "GET" ? undefined : {} })).status, 401, `${method} ${path}`);
  }
});

test("restaurante novo do super admin nasce sem o módulo Delivery (F-6): todos os outros ligados, e fora da lista do app do cliente", async () => {
  const r = await fresh();
  const modules = (await call("GET", `/api/admin/restaurants/${r.id}`, { token })).body.modules as string[];
  assert.deepEqual(modules, ALL_MODULES.filter((m) => m !== "delivery"));
  assert.ok(!(await call("GET", "/api/restaurants/")).body.some((x: { id: string }) => x.id === r.id), "ativo, mas sem Delivery não aparece");
  assert.ok((await call("GET", `/api/admin/restaurants/${R}`, { token })).body.modules.includes("delivery"), "os que já existiam ficam como estavam");
});
