import assert from "node:assert/strict";
import { before, test } from "node:test";
import { R, call, login, uid } from "./helpers.ts";

// F-1 (SEG-A01): a delivery coupon only counts if it's one of the restaurant's coupons in Promoções and usable by that
// screen's rules (on, not expired, uses left, channel delivery or both). The server computes the discount from it, freezes it
// on the order, and never reads a discount or total sent by the device. Before: any non-empty code gave 10%.
const P = `/api/restaurants/${R}`;
let owner: string;
let item: { id: string; price: number };
const future = () => new Date(Date.now() + 7 * 86_400_000).toISOString();

before(async () => {
  owner = await login();
  item = (await call("GET", `${P}/items`)).body.find((i: { soldOut: boolean; optionGroups: unknown[] }) => !i.soldOut && i.optionGroups.length === 0);
});

/** A coupon in Promoções (as the dashboard creates it), returned with its code. */
async function coupon(over: Record<string, unknown> = {}) {
  const body = { code: `TESTE${uid().toUpperCase()}`, kind: "percent", value: 15, channel: "delivery", validUntil: future(), usageLimit: 10, ...over };
  const res = await call("POST", `${P}/coupons`, { token: owner, body });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return res.body as { id: string; code: string };
}
const apply = (code: string) => call("POST", "/api/coupons/apply", { body: { restaurantId: R, code } });
/** A delivery order of 2 × the item with this coupon code, plus whatever extra fields the device may send. */
const order = (couponCode?: string, extra: Record<string, unknown> = {}) =>
  call("POST", "/api/orders", { session: crypto.randomUUID(), body: { mode: "delivery", restaurantId: R, couponCode, lines: [{ itemId: item.id, quantity: 2, notes: "", selectedOptions: [] }], ...extra } });
const round2 = (n: number) => Math.round(n * 100) / 100;

test('"abc" é recusado: no "Aplicar" e no pedido, que não é criado', async () => {
  const applied = await apply("abc");
  assert.deepEqual(applied.body, { valid: false, message: "Cupom não encontrado neste restaurante.", kind: null, value: 0 });
  const session = crypto.randomUUID();
  const res = await call("POST", "/api/orders", { session, body: { mode: "delivery", restaurantId: R, couponCode: "abc", lines: [{ itemId: item.id, quantity: 1, notes: "", selectedOptions: [] }] } });
  assert.deepEqual([res.status, res.body.error], [400, "Cupom não encontrado neste restaurante."]);
  assert.deepEqual((await call("GET", "/api/orders", { session })).body, [], "nenhum pedido criado");
});

test("cupom cadastrado aplica exatamente o desconto dele (percentual e valor fixo), grava no pedido e conta o uso", async () => {
  const pct = await coupon({ kind: "percent", value: 15 });
  assert.deepEqual((await apply(pct.code.toLowerCase())).body, { valid: true, kind: "percent", value: 15, message: "Cupom aplicado: 15% de desconto no subtotal." });
  const a = (await order(pct.code)).body;
  assert.equal(a.subtotal, round2(item.price * 2));
  assert.equal(a.discount, round2(a.subtotal * 0.15));
  assert.equal(a.total, round2(a.subtotal + a.deliveryFee - a.discount));
  assert.equal(a.couponCode, pct.code);

  const fixed = await coupon({ kind: "fixed", value: 7.5 });
  assert.equal((await apply(fixed.code)).body.message, "Cupom aplicado: R$ 7,50 de desconto no subtotal.");
  const b = (await order(fixed.code)).body;
  assert.equal(b.discount, 7.5);

  const big = await coupon({ kind: "fixed", value: 9999 });
  assert.equal((await order(big.code)).body.discount, round2(item.price * 2), "nunca mais que o subtotal");

  const used = (await call("GET", `${P}/coupons`, { token: owner })).body.find((c: { id: string }) => c.id === pct.id);
  assert.equal(used.usedCount, 1);
});

test("o servidor ignora qualquer desconto ou total enviado pelo aparelho", async () => {
  const forged = { discount: 999, discountPercent: 90, total: 0.01, subtotal: 0.01 };
  const none = (await order(undefined, forged)).body;
  assert.deepEqual([none.discount, none.subtotal], [0, round2(item.price * 2)]);
  const pct = await coupon({ kind: "percent", value: 20 });
  const withCoupon = (await order(pct.code, forged)).body;
  assert.equal(withCoupon.discount, round2(withCoupon.subtotal * 0.2));
  assert.equal(withCoupon.total, round2(withCoupon.subtotal + withCoupon.deliveryFee - withCoupon.discount));
});

test("pelas regras de Promoções: pausado, expirado, esgotado, só para mesa e de outro restaurante são recusados", async () => {
  const paused = await coupon();
  await call("PATCH", `${P}/coupons/${paused.id}`, { token: owner, body: { active: false } });
  const cases: [string, string][] = [
    [paused.code, "Este cupom está pausado pelo restaurante."],
    [(await coupon({ validUntil: new Date(Date.now() - 60_000).toISOString() })).code, "Este cupom expirou."],
    [(await coupon({ channel: "table" })).code, "Este cupom vale só para pedidos na mesa."],
    [(await coupon({ kind: "combo", value: 0, comboItemIds: [item.id], comboPrice: 10 })).code, "Cupom de combo ainda não vale no app."]
  ];
  for (const [code, message] of cases) {
    assert.deepEqual([(await apply(code)).body.valid, (await apply(code)).body.message], [false, message], code);
    assert.deepEqual([(await order(code)).status, (await order(code)).body.error], [400, message], code);
  }
  const both = await coupon({ channel: "both", usageLimit: 1 });
  assert.equal((await order(both.code)).status, 201, "canal Ambos vale no delivery");
  assert.deepEqual([(await order(both.code)).status, (await apply(both.code)).body.message], [400, "Este cupom já foi usado o máximo de vezes."]);
  const other = await call("POST", "/api/coupons/apply", { body: { restaurantId: "napoli", code: both.code } });
  assert.equal(other.body.valid, false, "o cupom é do restaurante que o cadastrou");
});

test("dois pedidos ao mesmo tempo com o último uso de um cupom: só um leva o desconto", async () => {
  const last = await coupon({ usageLimit: 1 });
  const results = await Promise.all([order(last.code), order(last.code)]);
  assert.deepEqual(results.map((r) => r.status).sort(), [201, 400]);
  const used = (await call("GET", `${P}/coupons`, { token: owner })).body.find((c: { id: string }) => c.id === last.id);
  assert.equal(used.usedCount, 1);
});
