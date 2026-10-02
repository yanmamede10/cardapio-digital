import type { Order, OrderStatus } from "@cardapio/shared";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { useToast } from "../context/ToastContext";
import { api } from "../lib/api";
import { usePageTitle } from "../lib/title";
import { brl } from "../lib/format";

const STAGES: { status: OrderStatus; label: string; note: string; icon: string }[] = [
  { status: "pending", label: "Pedido confirmado", note: "Restaurante recebeu seu pedido", icon: "fa-solid fa-check" },
  { status: "preparing", label: "Preparando", note: "Cozinha em produção", icon: "fa-solid fa-kitchen-set" },
  { status: "ready", label: "Pronto para envio", note: "Aguardando o entregador", icon: "fa-solid fa-box" },
  { status: "out_for_delivery", label: "Saiu para entrega", note: "Entregador a caminho", icon: "fa-solid fa-motorcycle" },
  { status: "delivered", label: "Entregue", note: "Bom apetite!", icon: "fa-solid fa-house" }
];

export default function OrderStatusScreen() {
  const { orderId = "" } = useParams();
  const navigate = useNavigate();
  const { mode, tableNumber, restaurantId, tableSession, setWaiterCalled, registerTableOrder } = useApp();
  const { showToast } = useToast();
  const [order, setOrder] = useState<Order | null>(null);
  usePageTitle(order ? `Pedido ${order.code}` : "", order?.restaurantId);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    let wasAwaiting = false;
    const poll = () => {
      api.getOrder(orderId).then((o) => {
        if (cancelled) return;
        // A free table's first order joins the table's total when the restaurant accepts it (a refused one never does).
        if (wasAwaiting && o.status !== "awaiting" && o.status !== "cancelled") registerTableOrder(o.total, o.id);
        wasAwaiting = o.status === "awaiting";
        setOrder(o);
        // Delivery: until delivered. Table: while it waits for the restaurant, so the customer sees accepted or refused.
        const waiting = o.mode === "delivery" ? o.status !== "delivered" && o.status !== "cancelled" : o.status === "awaiting" || o.status === "pending";
        if (waiting) timer = setTimeout(poll, 3000);
      });
    };
    poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [orderId, registerTableOrder]);

  if (!order) {
    return (
      <div className="screen" style={{ alignItems: "center", justifyContent: "center" }}>
        <i className="fa-solid fa-circle-notch fa-spin" style={{ fontSize: 24, color: "var(--acc)" }} />
      </div>
    );
  }

  const isMesa = order.mode === "table";
  const currentIndex = STAGES.findIndex((s) => s.status === order.status);
  const awaiting = isMesa && order.status === "awaiting";
  const refused = isMesa && order.status === "cancelled";
  const table = tableNumber ?? order.tableNumber ?? "";

  const callWaiter = async () => {
    setWaiterCalled(true);
    showToast(`Garçom chamado para a Mesa ${tableNumber ?? ""}`, "fa-solid fa-bell-concierge");
    try {
      await api.callWaiter(order.id);
    } catch {
      // toast already reflects the call locally
    }
  };

  return (
    <div className="screen">
      <div className="scroll no-scrollbar" style={{ padding: "calc(var(--pad) + 14px) var(--pad) 0" }}>
        <div style={{ animation: "dcPop .45s cubic-bezier(.2,.8,.3,1) both", width: 74, height: 74, borderRadius: 999, background: refused ? "var(--surf2)" : "var(--pri)", color: refused ? "var(--ink)" : "var(--priInk)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <i className={awaiting ? "fa-solid fa-hourglass-half" : refused ? "fa-solid fa-bell-concierge" : isMesa ? "fa-solid fa-kitchen-set" : "fa-solid fa-check"} style={{ fontSize: 30 }} aria-hidden="true" />
        </div>
        <div role="status" aria-live="polite">
          <div style={{ marginTop: 18, font: "700 var(--t-xl) var(--font)", letterSpacing: "-.025em", lineHeight: 1.15 }}>
            {awaiting ? "Aguardando confirmação do restaurante" : refused ? "Pedido não confirmado. Chame o garçom." : isMesa ? "Pedido recebido pela cozinha" : "Pedido confirmado!"}
          </div>
          <div style={{ marginTop: 10, font: "400 var(--t-b) var(--font)", color: "var(--ink2)", lineHeight: 1.5 }}>
            {awaiting
              ? `O primeiro pedido da Mesa ${table} é confirmado pela equipe. Assim que confirmarem, ele vai para a cozinha.`
              : refused
              ? "O restaurante não confirmou este pedido e nada foi cobrado. Um garçom resolve com você na mesa."
              : isMesa
              ? `A cozinha já começou a preparar. O garçom traz à Mesa ${table} assim que estiver pronto.`
              : "Acompanhe o preparo e a entrega por aqui — avisamos a cada etapa."}
          </div>
        </div>

        <div className="card" style={{ marginTop: 18, padding: 18, display: "flex", gap: 18 }}>
          <div>
            <div className="mono-label" style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <i className="fa-solid fa-receipt" style={{ fontSize: "var(--i-s)" }} />pedido
            </div>
            <div style={{ marginTop: 4, font: "600 var(--t-m) var(--font)" }}>{order.code}</div>
          </div>
          <div>
            <div className="mono-label" style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <i className={isMesa ? "fa-solid fa-qrcode" : "fa-solid fa-clock"} style={{ fontSize: "var(--i-s)" }} />{isMesa ? "mesa" : "previsão"}
            </div>
            <div style={{ marginTop: 4, font: "600 var(--t-m) var(--font)" }}>{isMesa ? String(tableNumber ?? order.tableNumber ?? "") : "30–40 min"}</div>
          </div>
        </div>

        {!isMesa && (
          <div style={{ marginTop: 22, display: "flex", flexDirection: "column" }}>
            {STAGES.map((s, i) => {
              const done = i < currentIndex;
              const now = i === currentIndex;
              const active = done || now;
              return (
                <div key={s.status} style={{ display: "flex", gap: 14 }}>
                  <div style={{ flex: "none", display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <div
                      style={{
                        width: 26, height: 26, borderRadius: 999, display: "flex", alignItems: "center", justifyContent: "center",
                        color: "var(--priInk)", background: active ? "var(--pri)" : "transparent",
                        border: `2px solid ${active ? "var(--pri)" : "var(--line)"}`,
                        boxShadow: now ? "var(--ring-now)" : "none"
                      }}
                    >
                      {active && <i className={s.icon} style={{ fontSize: 11 }} />}
                    </div>
                    {i < STAGES.length - 1 && (
                      <div style={{ width: 2, flex: 1, minHeight: 22, background: done ? "var(--pri)" : "var(--line)" }} />
                    )}
                  </div>
                  <div style={{ paddingBottom: 18 }}>
                    <div style={{ font: `${active ? 600 : 500} var(--t-b) var(--font)`, color: active ? "var(--ink)" : "var(--ink2)" }}>{s.label}</div>
                    <div style={{ marginTop: 3, font: "400 var(--t-s) var(--font)", color: "var(--ink2)" }}>{now ? `${s.note} · agora` : s.note}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {isMesa && !awaiting && !refused && (
          <div style={{ marginTop: 22, padding: 18, borderRadius: "var(--r-standard)", background: "var(--surf2)", border: "1px solid var(--line)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9, font: "600 var(--t-b) var(--font)" }}>
              <i className="fa-solid fa-receipt" style={{ fontSize: "var(--i-s)", color: "var(--acc)" }} />Comanda da Mesa {tableNumber ?? order.tableNumber}
            </div>
            <div style={{ marginTop: 6, font: "400 var(--t-s) var(--font)", color: "var(--ink2)", lineHeight: 1.5 }}>
              Novos pedidos continuam somando na mesma comanda. O pagamento é feito no caixa ou com o garçom.
            </div>
            <div style={{ marginTop: 12, display: "flex", gap: 18 }}>
              <div>
                <div className="mono-label">rodadas</div>
                <div style={{ marginTop: 3, font: "700 var(--t-m) var(--font)" }}>{tableSession.rounds}</div>
              </div>
              <div>
                <div className="mono-label">total na mesa</div>
                <div style={{ marginTop: 3, font: "700 var(--t-m) var(--font)" }}>{brl(tableSession.tableTotal)}</div>
              </div>
            </div>
          </div>
        )}
        <div style={{ height: 24 }} />
      </div>

      <div style={{ flex: "none", padding: "16px var(--pad) calc(16px + var(--safe))", display: "flex", gap: 10, borderTop: "1px solid var(--line)", background: "var(--glass)", backdropFilter: "saturate(180%) blur(22px)", WebkitBackdropFilter: "saturate(180%) blur(22px)" }}>
        {isMesa && (
          <button className="btn-outline" style={{ flex: "none" }} onClick={callWaiter}>
            <i className="fa-solid fa-bell-concierge" style={{ fontSize: "var(--i-m)" }} />Chamar garçom
          </button>
        )}
        <button
          className="btn-primary"
          style={{ flex: 1 }}
          onClick={() => navigate(restaurantId ? `/r/${restaurantId}/menu` : "/")}
        >
          <i className="fa-solid fa-utensils" style={{ fontSize: "var(--i-m)" }} />
          {isMesa ? "Continuar pedindo" : "Voltar ao cardápio"}
        </button>
      </div>
    </div>
  );
}
