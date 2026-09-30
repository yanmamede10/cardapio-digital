import assert from "node:assert/strict";
import { test } from "node:test";
import { R, call, login } from "./helpers.ts";

test("um pedido malformado responde com erro e a API continua de pé (antes derrubava o processo)", async () => {
  const token = (await call("POST", "/api/auth/login", { body: { email: "gerente@chapa27.example", password: "senha123" } })).body.token;
  const P = "/api/restaurants/chapa27";
  const kids = (await call("GET", `${P}/items`)).body.find((i: { name: string }) => i.name === "Kids");
  const res = await call("PATCH", `${P}/items/${kids.id}`, { token, body: { price: "abc" } });
  assert.ok(res.status >= 400 && res.status < 600, String(res.status));
  assert.equal((await call("GET", "/api/health")).status, 200);
  assert.equal((await call("GET", `${P}/items/${kids.id}`)).body.price, 24.9);
});

test("ticket: status e responsável inválidos → 400 e nada muda; válidos gravam", async () => {
  const token = await login();
  const P = `/api/restaurants/${R}`;
  const t = (await call("GET", `${P}/tickets`, { token })).body[0];
  const patch = (body: object) => call("PATCH", `${P}/tickets/${t.id}`, { token, body });
  for (const body of [{ status: "fechado" }, { status: 2 }, { status: null }, { assignee: 42 }, { assignee: { name: "x" } }, { assignee: "x".repeat(121) }]) {
    assert.equal((await patch(body)).status, 400, JSON.stringify(body).slice(0, 60));
  }
  const now = (await call("GET", `${P}/tickets`, { token })).body.find((x: { id: string }) => x.id === t.id);
  assert.deepEqual([now.status, now.assignee], [t.status, t.assignee], "recusado não grava nada");
  assert.equal((await patch({ status: "in_progress", assignee: "  Marina Duarte " })).body.assignee, "Marina Duarte");
  assert.equal((await patch({ assignee: null })).body.assignee, null);
  assert.equal((await patch({ status: t.status, assignee: t.assignee })).status, 200);
});

test("horário de funcionamento: dia fora de 0–6, repetido, texto longo, tipo errado ou mais de 7 linhas → 400; válido grava", async () => {
  const token = await login();
  const P = `/api/restaurants/${R}`;
  const rows = (await call("GET", `${P}/hours`, { token })).body as { weekday: number; lunch: string; dinner: string; isOpen: boolean }[];
  const put = (body: unknown) => call("PATCH", `${P}/hours`, { token, body });
  const day = { weekday: 1, lunch: "11:30 – 15:00", dinner: "18:00 – 23:00", isOpen: true };
  const bad = [
    { rows: [{ ...day, weekday: 7 }] },
    { rows: [{ ...day, weekday: -1 }] },
    { rows: [{ ...day, weekday: "1" }] },
    { rows: [day, { ...day }] },
    { rows: [{ ...day, lunch: 1130 }] },
    { rows: [{ ...day, dinner: "x".repeat(41) }] },
    { rows: [{ ...day, isOpen: "sim" }] },
    { rows: [null] },
    { rows: "segunda" },
    { rows: [0, 1, 2, 3, 4, 5, 6, 0].map((weekday) => ({ ...day, weekday })) }
  ];
  for (const body of bad) assert.equal((await put(body)).status, 400, JSON.stringify(body).slice(0, 80));
  assert.deepEqual((await call("GET", `${P}/hours`, { token })).body, rows, "recusado não grava nada");
  const ok = await put({ rows });
  assert.deepEqual([ok.status, ok.body], [200, rows]);
});
