import assert from "node:assert/strict";
import { test } from "node:test";
import { brl } from "@cardapio/shared";
import * as dashboard from "../../apps/dashboard/src/lib/format.ts";
import * as web from "../../apps/web/src/lib/format.ts";

// E-7: one money formatter for both apps, pt-BR, the minus sign before the symbol (the cardápio's own printed "R$ -10,00").
test("um formatador de moeda só, nos dois apps: -R$ 10,00, R$ 1.340,50 e nada de -R$ 0,00", () => {
  assert.equal(dashboard.brl, brl, "o painel usa o do @cardapio/shared");
  assert.equal(web.brl, brl, "o cardápio usa o do @cardapio/shared");
  assert.equal("formatMoney" in web, false, "o formatador duplicado do cardápio saiu");
  assert.equal(brl(-10), "-R$ 10,00");
  assert.equal(brl(10), "R$ 10,00");
  assert.equal(brl(1340.5), "R$ 1.340,50");
  assert.equal(brl(-1340.5), "-R$ 1.340,50");
  assert.equal(brl(0), "R$ 0,00");
  assert.equal(brl(-0.001), "R$ 0,00");
  assert.equal(brl(0.1 + 0.2), "R$ 0,30");
});
