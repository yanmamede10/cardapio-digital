import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import { R, call, login, uid } from "./helpers.ts";

const P = `/api/restaurants/${R}`;
let owner: string;
let manager: string;
let waiter: string;

before(async () => {
  [owner, manager, waiter] = await Promise.all([login(), login("bruno@fogoeno.com.br"), login("paula@fogoeno.com.br")]);
});

describe("hierarquia Funcionário < Administrador < Dono", () => {
  test("cada nível vê o seu e o de baixo", async () => {
    const status = async (token: string, path: string) => (await call("GET", `${P}/${path}`, { token })).status;
    // Operação (qualquer staff) / Administrador+ / Dono
    assert.deepEqual([await status(waiter, "tables"), await status(waiter, "finance-entries"), await status(waiter, "staff")], [200, 403, 403]);
    assert.deepEqual([await status(manager, "tables"), await status(manager, "finance-entries"), await status(manager, "staff")], [200, 200, 403]);
    assert.deepEqual([await status(owner, "tables"), await status(owner, "finance-entries"), await status(owner, "staff")], [200, 200, 200]);
  });

  test("Administrador não cadastra ninguém (nem a si como Dono)", async () => {
    const res = await call("POST", `${P}/staff`, { token: manager, body: { name: "X", email: `x-${uid()}@t.com`, role: "owner", password: "123456" } });
    assert.equal(res.status, 403);
  });
});

describe("Equipe & Permissões", () => {
  test("adicionar, logar, e rebaixar vale já no próximo request (mesmo token)", async () => {
    const email = `adm-${uid()}@t.com`;
    const created = await call("POST", `${P}/staff`, { token: owner, body: { name: "Ana Admin", email, role: "manager", password: "segredo1" } });
    assert.equal(created.status, 201);

    const res = await call("POST", "/api/auth/login", { body: { email, password: "segredo1" } });
    const token = res.body.token as string;
    assert.equal((await call("GET", `${P}/finance-entries`, { token })).status, 200);

    const edited = await call("PATCH", `${P}/staff/${created.body.id}`, { token: owner, body: { role: "waiter", name: "Ana Garçom" } });
    assert.deepEqual([edited.status, edited.body.role, edited.body.name], [200, "waiter", "Ana Garçom"]);
    assert.equal((await call("GET", `${P}/finance-entries`, { token })).status, 403, "papel lido do banco, não do token");
  });

  test("valida papel, e-mail repetido, o próprio papel e membro de outro restaurante", async () => {
    const base = { name: "Y", email: `y-${uid()}@t.com`, password: "123456" };
    for (const role of ["superuser", "toString", undefined]) {
      assert.equal((await call("POST", `${P}/staff`, { token: owner, body: { ...base, role } })).status, 400, String(role));
    }
    assert.equal((await call("POST", `${P}/staff`, { token: owner, body: { ...base, role: "waiter", password: "123" } })).status, 400, "senha curta");
    assert.equal((await call("POST", `${P}/staff`, { token: owner, body: { ...base, role: "waiter", email: "paula@fogoeno.com.br" } })).status, 409);

    const me = (await call("GET", `${P}/staff`, { token: owner })).body.find((s: { email: string }) => s.email === "marina@fogoeno.com.br");
    assert.equal((await call("PATCH", `${P}/staff/${me.id}`, { token: owner, body: { role: "waiter" } })).status, 400, "Dono não se rebaixa");
    assert.equal((await call("PATCH", `${P}/staff/nao-existe`, { token: owner, body: { name: "Z" } })).status, 404);
  });
});
