import type { Order, SupportTicket } from "@cardapio/shared";
import { brl, minutesSince } from "../lib/format";

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

/** Elapsed-minutes pill turns amber at 11min and red at 20min. */
function elapsedStyle(minutes: number) {
  if (minutes >= 20) return { background: "rgba(158,42,16,.14)", color: "var(--alert)" };
  if (minutes >= 11) return { background: "rgba(165,113,28,.16)", color: "var(--warn)" };
  return { background: "var(--surface2)", color: "var(--ink2)" };
}

interface Props {
  order: Order;
  ticket?: SupportTicket;
  onAccept: () => void;
  onReject: () => void;
  onAdvance: () => void;
  onChat: () => void;
  onPrint: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  dragging: boolean;
}

export function OrderCard({ order, ticket, onAccept, onReject, onAdvance, onChat, onPrint, onDragStart, onDragEnd, dragging }: Props) {
  const minutes = minutesSince(order.createdAt);
  const tone = elapsedStyle(minutes);
  const advanceLabel =
    order.status === "preparing" ? "Marcar pronto" : order.status === "ready" || order.status === "out_for_delivery" ? "Entregar" : null;

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", order.id);
        e.dataTransfer.effectAllowed = "move";
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      className="card"
      style={{ padding: 11, display: "flex", flexDirection: "column", gap: 9, cursor: "grab", opacity: dragging ? 0.45 : 1 }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
        <i
          className={`fa-solid ${order.mode === "table" ? "fa-chair" : "fa-motorcycle"}`}
          style={{ fontSize: 17, color: "var(--brandText)", marginTop: 1 }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 13.5, letterSpacing: "-.01em" }}>{orderRef(order)}</div>
          <div style={{ fontSize: 11.5, color: "var(--ink3)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {orderSubtitle(order)}
          </div>
        </div>
        <span className="pill mono" style={{ ...tone, fontSize: 11, padding: "2px 8px" }}>
          {minutes} min
        </span>
      </div>

      <div style={{ border: "1px solid var(--line)", borderRadius: 9, padding: "7px 9px", display: "flex", flexDirection: "column", gap: 3 }}>
        {order.lines.map((l) => (
          <div key={l.id} style={{ display: "flex", gap: 7, fontSize: 12, color: "var(--ink2)" }}>
            <span className="mono" style={{ color: "var(--brandText)", fontWeight: 600 }}>
              {l.quantity}×
            </span>
            <span style={{ flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{l.name}</span>
          </div>
        ))}
        {order.lines.length === 0 && <div style={{ fontSize: 12, color: "var(--ink3)" }}>Sem itens</div>}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
        <div className="mono" style={{ flex: 1, fontSize: 15, fontWeight: 600 }}>
          {brl(order.total)}
        </div>
        <button type="button" className="icon-btn" onClick={onChat} title="Abrir conversa" style={{ position: "relative" }}>
          <i className="fa-solid fa-comment" style={{ fontSize: 14 }} />
          {!!ticket?.unreadCount && (
            <span
              className="mono"
              style={{
                position: "absolute",
                top: -5,
                right: -5,
                minWidth: 16,
                height: 16,
                borderRadius: 20,
                background: "var(--brand)",
                color: "var(--brandInk)",
                fontSize: 9,
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "0 4px"
              }}
            >
              {ticket.unreadCount}
            </span>
          )}
        </button>
        <button type="button" className="icon-btn" onClick={onPrint} title="Imprimir comanda">
          <i className="fa-solid fa-print" style={{ fontSize: 14 }} />
        </button>
      </div>

      {order.status === "pending" && (
        <div style={{ display: "flex", gap: 7 }}>
          <button type="button" className="btn btn-primary" style={{ flex: 1 }} onClick={onAccept}>
            <i className="fa-solid fa-check" style={{ fontSize: 13 }} />
            Aceitar
          </button>
          <button type="button" className="btn btn-outline" style={{ color: "var(--ink3)" }} onClick={onReject}>
            Recusar
          </button>
        </div>
      )}

      {advanceLabel && (
        <button type="button" className="btn btn-outline" style={{ width: "100%" }} onClick={onAdvance}>
          {advanceLabel}
          <i className="fa-solid fa-arrow-right" style={{ fontSize: 12 }} />
        </button>
      )}
    </div>
  );
}
