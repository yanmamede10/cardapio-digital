import type { CartLineSelectedOption, Order } from "@cardapio/shared";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ScreenHeader } from "../components/ScreenHeader";
import { useApp } from "../context/AppContext";
import { cartLineKey, useCart } from "../context/CartContext";
import { useToast } from "../context/ToastContext";
import { api } from "../lib/api";
import { formatDate, formatMoney } from "../lib/format";

const STATUS_LABEL: Record<Order["status"], string> = {
  awaiting: "Aguardando confirmação",
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
  const { setActiveRestaurant } = useApp();
  const { showToast } = useToast();
  const [orders, setOrders] = useState<Order[] | null>(null);

  useEffect(() => {
    api.listOrders("delivery").then(setOrders);
  }, []);

  /** Rebuilds the cart from today's menu: the same dishes and choices at today's prices. A dish that left the menu, is
   *  sold out or whose choice no longer exists stays out, and the cart says which (the old order's prices are never reused). */
  const repeat = async (order: Order) => {
    let items;
    try {
      items = await api.getItems(order.restaurantId);
    } catch {
      return showToast("Não foi possível carregar o cardápio de hoje", "fa-solid fa-triangle-exclamation");
    }
    const leftOut: string[] = [];
    const lines = order.lines.flatMap((l) => {
      const item = items.find((i) => i.id === l.itemId && !i.soldOut);
      const options = (item ? l.selectedOptions : []).map((o) => {
        const group = item!.optionGroups.find((g) => g.id === o.groupId);
        const opt = group?.options.find((x) => x.id === o.optionId);
        return group && opt ? { groupId: group.id, groupLabel: group.label, optionId: opt.id, label: opt.label, priceDelta: opt.priceDelta } : null;
      });
      if (!item || options.includes(null)) {
        leftOut.push(l.name);
        return [];
      }
      const selectedOptions = options as CartLineSelectedOption[];
      const unitPrice = Math.round((item.price + selectedOptions.reduce((t, o) => t + o.priceDelta, 0)) * 100) / 100;
      return [{ key: cartLineKey(item.id, selectedOptions, l.notes), itemId: item.id, name: item.name, unitPrice, quantity: l.quantity, notes: l.notes, selectedOptions }];
    });
    setActiveRestaurant(order.restaurantId);
    replaceAll(lines);
    if (lines.length) showToast(`Itens do pedido ${order.code} no carrinho, com os preços de hoje`, "fa-solid fa-rotate-right");
    navigate("/cart", { state: { leftOut } });
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
