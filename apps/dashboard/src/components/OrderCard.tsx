import type { CartLine, Order } from "@cardapio/shared";

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

/** What the kitchen must see under each line: the customer's choices ("Bem passado · Bacon extra") and note. */
export function LineExtras({ line }: { line: CartLine }) {
  const options = line.selectedOptions.map((o) => o.label).join(" · ");
  if (!options && !line.notes) return null;
  return (
    <div style={{ fontSize: 11.5, lineHeight: 1.45, paddingLeft: 22 }}>
      {options && <div style={{ color: "var(--ink3)" }}>{options}</div>}
      {line.notes && <div style={{ color: "var(--brandText)", fontWeight: 600 }}>Obs: {line.notes}</div>}
    </div>
  );
}
