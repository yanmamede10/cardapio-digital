import type { CartLineSelectedOption, MenuItem } from "@cardapio/shared";

export interface ItemDraft {
  radios: Record<string, number>; // groupId -> selected option index
  checks: Record<string, Record<number, boolean>>; // groupId -> optionIndex -> selected
  qty: number;
  notes: string;
}

export function defaultDraft(item: MenuItem): ItemDraft {
  const radios: Record<string, number> = {};
  const checks: Record<string, Record<number, boolean>> = {};
  for (const g of item.optionGroups) {
    if (g.type === "single") radios[g.id] = 0;
    else checks[g.id] = {};
  }
  return { radios, checks, qty: 1, notes: "" };
}

export function computeUnitPrice(item: MenuItem, draft: ItemDraft): number {
  let price = item.price;
  for (const g of item.optionGroups) {
    if (g.type === "single") {
      const opt = g.options[draft.radios[g.id] ?? 0];
      if (opt) price += opt.priceDelta;
    } else {
      g.options.forEach((opt, i) => {
        if (draft.checks[g.id]?.[i]) price += opt.priceDelta;
      });
    }
  }
  return Math.round(price * 100) / 100;
}

export function computeSelectedOptions(item: MenuItem, draft: ItemDraft): CartLineSelectedOption[] {
  const out: CartLineSelectedOption[] = [];
  for (const g of item.optionGroups) {
    if (g.type === "single") {
      const idx = draft.radios[g.id] ?? 0;
      const opt = g.options[idx];
      if (opt && (opt.priceDelta > 0 || g.options.length > 1)) {
        out.push({ groupId: g.id, groupLabel: g.label, optionId: opt.id, label: opt.label, priceDelta: opt.priceDelta });
      }
    } else {
      g.options.forEach((opt, i) => {
        if (draft.checks[g.id]?.[i]) {
          out.push({ groupId: g.id, groupLabel: g.label, optionId: opt.id, label: opt.label, priceDelta: opt.priceDelta });
        }
      });
    }
  }
  return out;
}
