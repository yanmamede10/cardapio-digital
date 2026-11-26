// Integração entre o app do cliente e a API: o preço que o cardápio mostra (apps/web, itemDraft.ts) tem de ser o mesmo que
// a API cobra (apps/api, pricing.ts), para TODA combinação de opções de um prato. Se um dos lados mudar a regra sozinho,
// o cliente vê um valor e paga outro.
import { describe, expect, it } from "vitest";
import type { MenuItem as PrismaMenuItem } from "@prisma/client";
import type { MenuItem, MenuItemOptionGroup } from "@cardapio/shared";
import { computeSelectedOptions, computeUnitPrice, defaultDraft, type ItemDraft } from "../../apps/web/src/lib/itemDraft.ts";
import { priceLine } from "../../apps/api/src/lib/pricing.ts";

// Um X-Burguer do seed de demonstração: ponto da carne sem custo, tamanho com desconto e acréscimo, adicionais com centavos.
const grupos: MenuItemOptionGroup[] = [
  { id: "ponto", label: "Ponto da carne", type: "single", hint: "", options: [
    { id: "ao-ponto", label: "Ao ponto", priceDelta: 0 },
    { id: "bem-passado", label: "Bem passado", priceDelta: 0 }
  ] },
  { id: "tamanho", label: "Tamanho", type: "single", hint: "", options: [
    { id: "simples", label: "Simples", priceDelta: 0 },
    { id: "kids", label: "Kids", priceDelta: -4.1 },
    { id: "duplo", label: "Duplo", priceDelta: 9.9 }
  ] },
  { id: "adicionais", label: "Adicionais", type: "multi", hint: "", options: [
    { id: "bacon", label: "Bacon", priceDelta: 4.5, productId: "insumo-bacon", quantity: 0.03 },
    { id: "cheddar", label: "Cheddar", priceDelta: 3.35 },
    { id: "ovo", label: "Ovo", priceDelta: 2.1 },
    { id: "cebola", label: "Cebola caramelizada", priceDelta: 0.15 }
  ] },
  { id: "sem-custo", label: "Retirar", type: "single", hint: "", options: [{ id: "nada", label: "Nada", priceDelta: 0 }] }
];

const prato = { id: "x-burguer", price: 29.9, optionGroups: grupos } as MenuItem;
const doBanco = { price: prato.price, optionGroupsJson: JSON.stringify(grupos) } as PrismaMenuItem;

/** Todas as escolhas possíveis: um índice por grupo single e qualquer subconjunto dos multi. */
function* todasAsEscolhas(): Generator<ItemDraft> {
  const [ponto, tamanho, adicionais] = grupos;
  for (let p = 0; p < ponto.options.length; p++)
    for (let t = 0; t < tamanho.options.length; t++)
      for (let mask = 0; mask < 1 << adicionais.options.length; mask++) {
        const draft = defaultDraft(prato);
        draft.radios.ponto = p;
        draft.radios.tamanho = t;
        adicionais.options.forEach((_, i) => (draft.checks.adicionais[i] = Boolean(mask & (1 << i))));
        yield draft;
      }
}

describe("preço do cardápio × preço cobrado pela API", () => {
  it("o rascunho padrão começa na primeira opção de cada grupo single e sem adicionais", () => {
    const draft = defaultDraft(prato);
    expect(draft).toEqual({ radios: { ponto: 0, tamanho: 0, "sem-custo": 0 }, checks: { adicionais: {} }, qty: 1, notes: "" });
    expect(computeUnitPrice(prato, draft)).toBe(29.9);
  });

  it("as 96 combinações do prato têm o mesmo preço nos dois lados", () => {
    let combinacoes = 0;
    for (const draft of todasAsEscolhas()) {
      const escolhidas = computeSelectedOptions(prato, draft);
      // O app envia só {groupId, optionId}; a API recalcula preço e rótulos a partir do catálogo.
      const servidor = priceLine(doBanco, escolhidas.map(({ groupId, optionId }) => ({ groupId, optionId })));
      expect(servidor.unitPrice, JSON.stringify(escolhidas)).toBe(computeUnitPrice(prato, draft));
      combinacoes++;
    }
    expect(combinacoes).toBe(2 * 3 * 2 ** 4);
  });

  it("o pior caso de centavos (Duplo + todos os adicionais) fecha em R$ 49,90", () => {
    const draft = defaultDraft(prato);
    draft.radios.tamanho = 2;
    draft.checks.adicionais = { 0: true, 1: true, 2: true, 3: true };
    expect(computeUnitPrice(prato, draft)).toBe(49.9);
  });

  it("o grupo de opção única e sem custo não é enviado, mas o insumo do bacon vai para o estoque", () => {
    const draft = defaultDraft(prato);
    draft.checks.adicionais = { 0: true };
    const escolhidas = computeSelectedOptions(prato, draft);
    expect(escolhidas.map((o) => o.optionId)).toEqual(["ao-ponto", "simples", "bacon"]);
    const { selectedOptions } = priceLine(doBanco, escolhidas);
    expect(selectedOptions.find((o) => o.optionId === "bacon")).toMatchObject({ productId: "insumo-bacon", quantity: 0.03 });
  });
});
