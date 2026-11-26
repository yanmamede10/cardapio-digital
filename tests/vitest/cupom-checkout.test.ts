// Regras do cupom no checkout do delivery (apps/api/src/lib/coupons.ts), a mesma função usada por /api/coupons/apply e pelo
// pedido. O banco é simulado (vi.mock): o teste fixa a ordem das regras e a mensagem que o cliente lê em cada caso.
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Coupon } from "@prisma/client";

const findUnique = vi.fn();
vi.mock("../../apps/api/src/db.ts", () => ({ prisma: { coupon: { findUnique } } }));

const { COUPON_USED_UP, deliveryCoupon } = await import("../../apps/api/src/lib/coupons.ts");

const AGORA = new Date("2026-11-26T19:00:00-03:00");
const cupom = (o: Partial<Coupon> = {}) =>
  ({ id: "c1", restaurantId: "chapa27", code: "BEMVINDO10", kind: "percent", value: 10, active: true, channel: "delivery",
     validUntil: new Date("2026-12-31T23:59:59-03:00"), usedCount: 3, usageLimit: 100, ...o }) as Coupon;

beforeEach(() => {
  findUnique.mockReset();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(AGORA);
});

describe("cupom no checkout do delivery", () => {
  it("normaliza o código digitado (espaços e minúsculas) antes de buscar no restaurante", async () => {
    findUnique.mockResolvedValue(cupom());
    await expect(deliveryCoupon("chapa27", "  bemvindo10 ")).resolves.toEqual({ coupon: cupom() });
    expect(findUnique).toHaveBeenCalledWith({ where: { restaurantId_code: { restaurantId: "chapa27", code: "BEMVINDO10" } } });
  });

  it("código vazio ou restaurante inválido nem chegam ao banco", async () => {
    await expect(deliveryCoupon("chapa27", "   ")).resolves.toEqual({ error: "Digite o código do cupom." });
    await expect(deliveryCoupon("chapa27", 42)).resolves.toEqual({ error: "Digite o código do cupom." });
    await expect(deliveryCoupon(undefined, "BEMVINDO10")).resolves.toEqual({ error: "Cupom não encontrado neste restaurante." });
    expect(findUnique).not.toHaveBeenCalled();
  });

  it.each([
    ["não existe", null, "Cupom não encontrado neste restaurante."],
    ["está pausado", cupom({ active: false }), "Este cupom está pausado pelo restaurante."],
    ["venceu um segundo atrás", cupom({ validUntil: new Date(AGORA.getTime() - 1000) }), "Este cupom expirou."],
    ["chegou ao limite de usos", cupom({ usedCount: 100, usageLimit: 100 }), COUPON_USED_UP],
    ["vale só na mesa", cupom({ channel: "table" }), "Este cupom vale só para pedidos na mesa."],
    ["é de combo", cupom({ kind: "combo" as Coupon["kind"] }), "Cupom de combo ainda não vale no app."]
  ])("recusa o cupom que %s", async (_, doBanco, mensagem) => {
    findUnique.mockResolvedValue(doBanco);
    await expect(deliveryCoupon("chapa27", "BEMVINDO10")).resolves.toEqual({ error: mensagem });
  });

  it("um cupom pausado E vencido mostra o motivo mais acionável primeiro (pausado)", async () => {
    findUnique.mockResolvedValue(cupom({ active: false, validUntil: new Date("2026-01-01") }));
    await expect(deliveryCoupon("chapa27", "BEMVINDO10")).resolves.toEqual({ error: "Este cupom está pausado pelo restaurante." });
  });

  it.each([
    ["percentual no delivery", cupom()],
    ["valor fixo em Ambos os canais", cupom({ kind: "fixed", value: 5, channel: "both" })],
    ["que vence exatamente agora", cupom({ validUntil: AGORA })],
    ["com o último uso disponível", cupom({ usedCount: 99, usageLimit: 100 })]
  ])("aceita cupom %s", async (_, doBanco) => {
    findUnique.mockResolvedValue(doBanco);
    await expect(deliveryCoupon("chapa27", "BEMVINDO10")).resolves.toEqual({ coupon: doBanco });
  });
});
