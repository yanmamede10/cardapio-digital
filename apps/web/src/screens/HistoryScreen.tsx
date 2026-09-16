import type { Order } from "@cardapio/shared";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ScreenHeader } from "../components/ScreenHeader";
import { cartLineKey, useCart } from "../context/CartContext";
import { useToast } from "../context/ToastContext";
import { api } from "../lib/api";
import { formatDate, formatMoney } from "../lib/format";

const STATUS_LABEL: Record<Order["status"], string> = {
  pending: "Recebido",
  preparing: "Preparando",
  ready: "Pronto para envio",
  out_for_delivery: "Saiu para entrega",
  delivered: "Entregue",
  served: "Servido",
  cancelled: "Cancelado"
};

export default function HistoryScreen() {
  const navigate = useNavigate();
  const { replaceAll } = useCart();
  const { showToast } = useToast();
  const [orders, setOrders] = useState<Order[] | null>(null);

  useEffect(() => {
    api.listOrders("delivery").then(setOrders);
  }, []);

  const repeat = (order: Order) => {
    replaceAll(
      order.lines.map((l) => ({
        key: cartLineKey(l.itemId, l.selectedOptions, l.notes),
        itemId: l.itemId,
        name: l.name,
        unitPrice: l.unitPrice,
        quantity: l.quantity,
        notes: l.notes,
        selectedOptions: l.selectedOptions
      }))
    );
    showToast(`Itens do pedido ${order.code} no carrinho`, "fa-solid fa-rotate-right");
    navigate("/cart");
  };

  return (
    <div className="screen">
      <ScreenHeader title="Meus pedidos" onBack={() => navigate(-1)} />
      <div className="scroll no-scrollbar" style={{ padding: "16px var(--pad) 0", display: "flex", flexDirection: "column", gap: 10 }}>
        {orders === null && (
          <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
            <i className="fa-solid fa-circle-notch fa-spin" style={{ fontSize: 22, color: "var(--acc)" }} />
          </div>
        )}
        {orders?.length === 0 && (
          <div style={{ padding: "40px 8px", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 14 }}>
            <i className="fa-solid fa-receipt" style={{ fontSize: 38, color: "var(--ink2)", opacity: 0.5 }} />
            <div style={{ font: "700 var(--t-m) var(--font)" }}>Nenhum pedido ainda</div>
            <div style={{ maxWidth: 260, font: "400 var(--t-s) var(--font)", color: "var(--ink2)", lineHeight: 1.5 }}>
              Seus pedidos de delivery aparecem aqui depois da primeira compra.
            </div>
          </div>
        )}
        {orders?.map((h) => (
          <div key={h.id} className="card" style={{ padding: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
              <div style={{ font: "600 var(--t-b) var(--font)", textTransform: "capitalize" }}>{formatDate(h.createdAt)}</div>
              <div style={{ font: "500 var(--t-xs) var(--font)", color: "var(--ink2)" }}>{h.code}</div>
            </div>
            <div style={{ marginTop: 6, font: "400 var(--t-s) var(--font)", color: "var(--ink2)", lineHeight: 1.6 }}>
              {h.lines.map((l) => `${l.quantity}× ${l.name}`).join(" · ")}
            </div>
            <div style={{ marginTop: 11, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <div style={{ font: "700 var(--t-b) var(--font)" }}>{formatMoney(h.total)}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "5px 10px", borderRadius: 999, background: "var(--surf2)", font: "600 var(--t-xs) var(--font)", color: "var(--ink2)" }}>
                <i className="fa-solid fa-circle-check" style={{ fontSize: "var(--i-s)", color: h.status === "delivered" ? "var(--good)" : "var(--ink2)" }} />
                {STATUS_LABEL[h.status]}
              </div>
              <button
                type="button"
                onClick={() => repeat(h)}
                className="tap"
                style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 8, border: "1px solid var(--pri)", background: "transparent", cursor: "pointer", borderRadius: 999, padding: "8px 14px", color: "var(--acc)", font: "600 var(--t-s) var(--font)" }}
              >
                <i className="fa-solid fa-rotate-right" style={{ fontSize: "var(--i-s)" }} />Pedir de novo
              </button>
            </div>
          </div>
        ))}
        <div style={{ height: 24 }} />
      </div>
    </div>
  );
}
