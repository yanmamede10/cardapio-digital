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

/** "Lançado no estabelecimento": the waiter took this order at the table (it skipped Recebido). */
export function InHouseTag({ order }: { order: Order }) {
  if (!order.waiterName) return null;
  return (
    <span style={{ alignSelf: "flex-start", fontSize: 10.5, fontWeight: 700, letterSpacing: ".02em", textTransform: "uppercase", whiteSpace: "nowrap", borderRadius: 999, padding: "2px 8px", color: "var(--sec)", border: "1px solid var(--sec)" }}>
      Lançado no estabelecimento
    </span>
  );
}

/** A free table's first order from the QR or the tablet: nobody accepted it yet, so the table isn't open and nothing counts.
 *  The table number stands out — whoever accepts should know which table is about to open. */
export function AwaitingTag({ order }: { order: Order }) {
  if (order.status !== "awaiting") return null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, borderRadius: 10, padding: "7px 10px", border: "1px solid var(--warn)", background: "color-mix(in srgb, var(--warn) 12%, transparent)" }}>
      <i className="fa-solid fa-hourglass-half" aria-hidden="true" style={{ fontSize: 14, color: "var(--warn)" }} />
      <span style={{ flex: 1, fontSize: 12.5, fontWeight: 600, color: "var(--ink)" }}>Aguardando aceite · mesa livre</span>
      <span className="mono" style={{ fontSize: 17, fontWeight: 700, color: "var(--ink)" }}>Mesa {String(order.tableNumber ?? 0).padStart(2, "0")}</span>
    </div>
  );
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
