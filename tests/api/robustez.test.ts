import assert from "node:assert/strict";
import { test } from "node:test";
import { call } from "./helpers.ts";

test("um pedido malformado responde com erro e a API continua de pé (antes derrubava o processo)", async () => {
  const token = (await call("POST", "/api/auth/login", { body: { email: "gerente@chapa27.example", password: "senha123" } })).body.token;
  const P = "/api/restaurants/chapa27";
  const kids = (await call("GET", `${P}/items`)).body.find((i: { name: string }) => i.name === "Kids");
  const res = await call("PATCH", `${P}/items/${kids.id}`, { token, body: { price: "abc" } });
  assert.ok(res.status >= 400 && res.status < 600, String(res.status));
  assert.equal((await call("GET", "/api/health")).status, 200);
  assert.equal((await call("GET", `${P}/items/${kids.id}`)).body.price, 24.9);
});
