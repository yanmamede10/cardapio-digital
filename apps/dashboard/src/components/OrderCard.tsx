import type { Order } from "@cardapio/shared";

export function orderRef(o: Order): string {
  return o.mode === "table" ? `Mesa ${String(o.tableNumber ?? 0).padStart(2, "0")}` : `Delivery #${o.code}`;
}

export function orderSubtitle(o: Order): string {
  if (o.mode === "table") {
    const parts = [o.waiterName || undefined, o.partySize ? `${o.partySize} pessoas` : undefined, o.guestName || undefined].filter(
      Boolean
    ) as string[];
    return parts.length ? parts.join(" · ") : `Comanda aberta · rodada ${o.round}`;
  }
  return o.addressLabel || o.guestName || `${o.lines.length} ${o.lines.length === 1 ? "item" : "itens"}`;
}
