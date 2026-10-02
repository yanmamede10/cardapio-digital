import assert from "node:assert/strict";
import { before, test } from "node:test";
import { ADMIN_KEY, R, call, login, uid } from "./helpers.ts";

// F-2 (SEG-A06): when the Dono or the super admin changes or resets someone's password, every session of that person stops
// at the next request; when the person changes their own, the device they're on stays logged in (it gets a new token) and
// the others drop. Before: every token stayed valid until it expired (24 h).
const P = `/api/restaurants/${R}`;
let owner: string;
const alive = async (token: string) => (await call("GET", "/api/auth/me", { token })).status;
const signIn = async (email: string, password: string) => (await call("POST", "/api/auth/login", { body: { email, password } })).body.token as string;

before(async () => {
  owner = await login();
});

/** A new waiter with this password, logged in on two devices. */
async function waiterOnTwoDevices(password = "senha-garcom-1") {
  const email = `sessao-${uid()}@t.com`;
  const created = await call("POST", `${P}/staff`, { token: owner, body: { name: "Sessão", email, role: "waiter", password } });
  assert.equal(created.status, 201);
  return { id: created.body.id as string, email, a: await signIn(email, password), b: await signIn(email, password) };
}

test("o Dono troca a senha de alguém em Equipe: os dois aparelhos dela caem na próxima requisição; a senha nova entra", async () => {
  const w = await waiterOnTwoDevices();
  assert.deepEqual([await alive(w.a), await alive(w.b)], [200, 200]);
  assert.equal((await call("PATCH", `${P}/staff/${w.id}`, { token: owner, body: { password: "senha-nova-dono" } })).status, 200);
  assert.deepEqual([await alive(w.a), await alive(w.b)], [401, 401]);
  assert.equal((await call("GET", `${P}/tables`, { token: w.a })).status, 401, "nenhuma rota aceita o token antigo");
  assert.equal(await alive(await signIn(w.email, "senha-nova-dono")), 200);
  assert.equal(await alive(owner), 200, "o Dono que trocou segue logado");
});

test("mudar só o nome ou o papel não derruba ninguém", async () => {
  const w = await waiterOnTwoDevices();
  await call("PATCH", `${P}/staff/${w.id}`, { token: owner, body: { name: "Outro nome", role: "kitchen" } });
  assert.deepEqual([await alive(w.a), await alive(w.b)], [200, 200]);
});

test("o super admin reseta a senha: as sessões abertas caem na hora (antes só esperavam a troca da provisória e voltavam)", async () => {
  const w = await waiterOnTwoDevices();
  const reset = await call("POST", `/api/admin/restaurants/${R}/staff/${w.id}/reset-password`, { token: ADMIN_KEY });
  assert.deepEqual([await alive(w.a), await alive(w.b)], [401, 401]);
  const provisional = await signIn(w.email, reset.body.password);
  const changed = await call("POST", "/api/auth/password", { token: provisional, body: { currentPassword: reset.body.password, newPassword: "senha-depois-reset" } });
  assert.equal(changed.status, 200);
  assert.deepEqual([await alive(w.a), await alive(w.b), await alive(changed.body.token)], [401, 401, 200], "as antigas não voltam depois da troca");
});

test("a própria pessoa troca a senha: o aparelho em que ela está continua logado (token novo) e o outro cai", async () => {
  const w = await waiterOnTwoDevices("senha-propria-1");
  const res = await call("POST", "/api/auth/password", { token: w.a, body: { currentPassword: "senha-propria-1", newPassword: "senha-propria-2" } });
  assert.equal(res.status, 200);
  assert.equal(typeof res.body.token, "string");
  assert.equal(await alive(res.body.token), 200, "este aparelho segue, com o token que recebeu");
  assert.equal(await alive(w.b), 401, "o outro aparelho cai");
  assert.equal(await alive(w.a), 401, "o token de antes da troca não vale mais (este aparelho já usa o novo)");
});

test("o Dono troca a própria senha em Equipe: ele segue logado neste aparelho e os outros aparelhos dele caem", async () => {
  const email = `dono-${uid()}@t.com`;
  const created = await call("POST", `${P}/staff`, { token: owner, body: { name: "Dono Dois", email, role: "owner", password: "senha-dono-1" } });
  const [here, there] = [await signIn(email, "senha-dono-1"), await signIn(email, "senha-dono-1")];
  const res = await call("PATCH", `${P}/staff/${created.body.id}`, { token: here, body: { password: "senha-dono-2" } });
  assert.equal(res.status, 200);
  assert.deepEqual([await alive(res.body.token), await alive(there), await alive(here)], [200, 401, 401]);
});
