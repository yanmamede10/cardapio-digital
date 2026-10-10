import type { CartLine, Order } from "@cardapio/shared";

export function orderRef(o: Order): string {
  return o.mode === "table" ? `Mesa ${String(o.tableNumber ?? 0).padStart(2, "0")}` : `Delivery #${o.code}`;
}

export function orderSubtitle(o: Order): string {
  if (o.mode === "table") {
    const parts = [o.waiterName || undefined, o.partySize ? `${o.partySize} pessoas` : undefined, o.guestName || undefined].filter(
      Boolean
    ) as string[];
    if (o.status === "awaiting") return "Mesa livre: aceitar abre a mesa";
    return parts.length ? parts.join(" · ") : `Comanda aberta · rodada ${o.round}`;
  }
  return o.addressLabel || o.guestName || `${o.lines.length} ${o.lines.length === 1 ? "item" : "itens"}`;
}

/** "Lançado no estabelecimento": the waiter took this order at the table (it skipped Recebido). */
export function InHouseTag({ order }: { order: Order }) {
  if (!order.waiterName) return null;
  return (
    <span style={{ alignSelf: "flex-start", fontSize: "var(--text-caption)", fontWeight: 600, letterSpacing: ".02em", textTransform: "uppercase", whiteSpace: "nowrap", borderRadius: 999, padding: "2px 8px", color: "var(--secText)", border: "1px solid var(--secText)" }}>
      Lançado no estabelecimento
    </span>
  );
}

/** A free table's first order from the QR or the tablet: nobody accepted it yet, so the table isn't open and nothing counts.
 *  The table number stands out — whoever accepts should know which table is about to open. */
export function AwaitingTag({ order }: { order: Order }) {
  if (order.status !== "awaiting") return null;
  return (
    <div style={{ borderRadius: 10, padding: "8px 11px", border: "1px solid var(--warn)", background: "color-mix(in srgb, var(--warn) 12%, transparent)", color: "var(--ink)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: "var(--text-subheadline)", fontWeight: 600 }}>
        <i className="fa-solid fa-hourglass-half" aria-hidden="true" style={{ fontSize: "var(--icon-sm)", color: "var(--warn)" }} />
        Aguardando aceite
      </div>
      <div className="mono" style={{ fontSize: "var(--text-title2)", fontWeight: 600, letterSpacing: "-.02em", lineHeight: 1.2 }}>Mesa {String(order.tableNumber ?? 0).padStart(2, "0")}</div>
    </div>
  );
}

/** "Para levar": the kitchen packs it to go. It stays on the table's comanda like any other order. */
export function TakeawayTag({ order }: { order: Order }) {
  if (!order.takeaway) return null;
  return (
    <span style={{ alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: 6, fontSize: "var(--text-footnote)", fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase", whiteSpace: "nowrap", borderRadius: 8, padding: "3px 9px", background: "var(--ink)", color: "var(--bg)" }}>
      <i className="fa-solid fa-bag-shopping" aria-hidden="true" style={{ fontSize: "var(--icon-sm)" }} />
      Para levar
    </span>
  );
}

/** What the kitchen must see under each line: the customer's choices ("Bem passado · Bacon extra") and note. */
export function LineExtras({ line }: { line: CartLine }) {
  const options = line.selectedOptions.map((o) => o.label).join(" · ");
  if (!options && !line.notes) return null;
  return (
    <div style={{ fontSize: "var(--text-footnote)", lineHeight: 1.45, paddingLeft: 22 }}>
      {options && <div style={{ color: "var(--ink3)" }}>{options}</div>}
      {line.notes && <div style={{ color: "var(--brandText)", fontWeight: 600 }}>Obs: {line.notes}</div>}
    </div>
  );
}
