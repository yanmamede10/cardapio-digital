import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import { ADMIN_KEY, call, uid } from "./helpers.ts";

// Salão of the demo hamburgueria (prisma/seed-demo.ts): QR → pedido → Central → comanda → fechamento.
const D = "chapa27";
const P = `/api/restaurants/${D}`;
let owner: string;
let waiter: string;
let kitchen: string;
let items: { id: string; name: string; price: number; optionGroups: { id: string; options: { id: string; label: string; priceDelta: number }[] }[] }[];
const item = (name: string) => items.find((i) => i.name === name)!;
const staff = async (u: string) => (await call("POST", "/api/auth/login", { body: { email: `${u}@chapa27.example`, password: "senha123" } })).body.token as string;

before(async () => {
  [owner, waiter, kitchen] = await Promise.all([staff("dono"), staff("garcom"), staff("cozinha")]);
  items = (await call("GET", `${P}/items`)).body;
});

describe("QR da mesa", () => {
  test("o QR de uma mesa abre o restaurante dela, não outro", async () => {
    const { tableCode } = (await call("GET", `${P}/tables/12/qr`, { token: waiter })).body;
    assert.equal(tableCode, "chapa27.12");
    assert.deepEqual((await call("GET", `/api/tables/${tableCode}`)).body, { restaurantId: D, tableNumber: 12 });
  });

  test("mesa que não existe, restaurante inexistente ou inativo, código sem restaurante → 404", async () => {
    for (const code of ["chapa27.99", "naoexiste.1", "12", "chapa27.", ".3", "chapa27.1.5"]) {
      assert.equal((await call("GET", `/api/tables/${encodeURIComponent(code)}`)).status, 404, code);
    }
    assert.equal((await call("GET", "/api/tables/fogo.1")).status, 200);
    const status = (s: string) => call("PATCH", "/api/admin/restaurants/fogo/status", { token: ADMIN_KEY, body: { status: s } });
    try {
      await status("inativo");
      assert.equal((await call("GET", "/api/tables/fogo.1")).status, 404, "restaurante inativo");
    } finally {
      await status("ativo");
    }
  });
});
