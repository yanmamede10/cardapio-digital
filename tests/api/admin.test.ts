import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { R, call, uid } from "./helpers.ts";

const token = process.env.SUPER_ADMIN_KEY ?? "test-admin-key"; // set by tests/run.mjs
const cnpj = () => String(Date.now()).slice(-12).padStart(12, "0") + "91"; // 14 digits, unique per call

describe("super admin", () => {
  test("sem chave, chave errada ou token de staff → 401", async () => {
    const staff = (await call("POST", "/api/auth/login", { body: { email: "marina@fogoeno.com.br", password: "senha123" } })).body.token;
    for (const t of [undefined, "errada", staff]) assert.equal((await call("GET", "/api/admin/restaurants", { token: t })).status, 401);
  });

  test("cadastra como pendente, formata o CNPJ, recusa CNPJ repetido ou inválido e ativa", async () => {
    const digits = cnpj();
    const created = await call("POST", "/api/admin/restaurants", { token, body: { name: `Cantina São João ${uid()}`, cnpj: digits, contact: "Ana · (11) 99999-0000" } });
    assert.equal(created.status, 201);
    assert.equal(created.body.status, "pendente");
    assert.match(created.body.id, /^cantina-sao-joao-/);
    assert.equal(created.body.cnpj.replace(/\D/g, ""), digits);
    assert.match(created.body.cnpj, /^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/);

    assert.equal((await call("POST", "/api/admin/restaurants", { token, body: { name: "Outro", cnpj: digits } })).status, 409);
    assert.equal((await call("POST", "/api/admin/restaurants", { token, body: { name: "Outro", cnpj: "123" } })).status, 400);
    assert.equal((await call("POST", "/api/admin/restaurants", { token, body: { name: " ", cnpj: cnpj() } })).status, 400);

    const listed = async () => (await call("GET", "/api/restaurants")).body.some((r: { id: string }) => r.id === created.body.id);
    assert.equal(await listed(), false, "pendente não aparece no delivery");
    assert.equal((await call("PATCH", `/api/admin/restaurants/${created.body.id}/status`, { token, body: { status: "pendente" } })).status, 400);
    assert.equal((await call("PATCH", `/api/admin/restaurants/${created.body.id}/status`, { token, body: { status: "ativo" } })).body.status, "ativo");
    assert.equal(await listed(), true);
    assert.ok((await call("GET", "/api/admin/restaurants", { token })).body.some((r: { id: string; status: string }) => r.id === created.body.id && r.status === "ativo"));
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
