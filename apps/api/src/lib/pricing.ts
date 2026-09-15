import type { CartLineSelectedOption, MenuItemOptionGroup } from "@cardapio/shared";
import type { MenuItem } from "@prisma/client";

export class PricingError extends Error {}

/**
 * Recomputes a line's true unit price and a trusted selectedOptions array from
 * the item's own option groups — the client only sends {groupId, optionId} per
 * pick; every price and label is re-derived here so a tampered request body
 * can't change what gets charged.
 */
export function priceLine(
  item: MenuItem,
  requestedOptions: { groupId: string; optionId: string }[]
): { unitPrice: number; selectedOptions: CartLineSelectedOption[] } {
  const groups = JSON.parse(item.optionGroupsJson) as MenuItemOptionGroup[];
  let unitPrice = item.price;
  const selectedOptions: CartLineSelectedOption[] = [];

  for (const group of groups) {
    const picks = requestedOptions.filter((r) => r.groupId === group.id);
    if (group.type === "single") {
      if (picks.length > 1) {
        throw new PricingError(`Group ${group.id} accepts only one selection`);
      }
    }
    for (const pick of picks) {
      const option = group.options.find((o) => o.id === pick.optionId);
      if (!option) {
        throw new PricingError(`Unknown option ${pick.optionId} for group ${group.id}`);
      }
      unitPrice += option.priceDelta;
      selectedOptions.push({
        groupId: group.id,
        groupLabel: group.label,
        optionId: option.id,
        label: option.label,
        priceDelta: option.priceDelta
      });
    }
  }

  return { unitPrice: Math.round(unitPrice * 100) / 100, selectedOptions };
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
