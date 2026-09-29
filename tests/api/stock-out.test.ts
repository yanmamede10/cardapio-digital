import assert from "node:assert/strict";
import { test } from "node:test";
import { stockOut } from "../../apps/api/src/lib/stock.ts";

test("stockOut: composto consome a ficha técnica, simples consome a si mesmo, item legado é ignorado", () => {
  const products = new Map([
    ["burger", { id: "burger", composed: true, components: [{ componentId: "pao", quantity: 1 }, { componentId: "blend", quantity: 0.15 }] }],
    ["chope", { id: "chope", composed: false, components: [] }]
  ]);
  const out = stockOut(
    [
      { productId: "burger", quantity: 3 },
      { productId: "chope", quantity: 2 },
      { productId: "burger", quantity: 1 },
      { productId: null, quantity: 5 }
    ],
    products
  );
  assert.equal(out.get("pao"), 4);
  assert.equal(out.get("blend"), 0.6, "0.45 + 0.15 sem 0.6000000001");
  assert.equal(out.get("chope"), 2);
  assert.equal(out.has("burger"), false);
  assert.equal(out.size, 3);
});

test("stockOut: adicional com estoque soma a quantidade dele × a quantidade da linha", () => {
  const products = new Map([["burger", { id: "burger", composed: true, components: [{ componentId: "pao", quantity: 1 }] }]]);
  const out = stockOut([{ productId: "burger", quantity: 2, options: [{ productId: "bacon", quantity: 0.03 }, { productId: null }, {}] }], products);
  assert.equal(out.get("bacon"), 0.06);
  assert.equal(out.get("pao"), 2);
  assert.equal(out.size, 2);
});
