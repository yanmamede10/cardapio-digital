import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { brl } from "../lib/format";
import { useApp } from "../context/AppContext";
import { useCart } from "../context/CartContext";
import { useToast } from "../context/ToastContext";

/** Fixed bottom row shown on Menu/History: waiter pill (table mode) + "Ver carrinho" bar. */
export function BottomBar() {
  const { mode, tableNumber, tableSession, setWaiterCalled } = useApp();
  const { count, subtotal } = useCart();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const isMesa = mode === "table";
  const showWaiter = isMesa;
  const showCart = count > 0;
  if (!showWaiter && !showCart) return null;

  const callWaiter = async () => {
    setWaiterCalled(true);
    showToast(`Garçom chamado para a Mesa ${tableNumber ?? ""}`, "fa-solid fa-bell-concierge");
    if (tableSession.lastOrderId) {
      try {
        await api.callWaiter(tableSession.lastOrderId);
      } catch {
        // best-effort — the toast + UI state already reflect the call
      }
    }
  };

  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: "12px var(--pad) calc(12px + var(--safe))", display: "flex", gap: 10, alignItems: "flex-end", pointerEvents: "none", zIndex: 30 }}>
      {showWaiter && (
        <button
          type="button"
          onClick={callWaiter}
          className="tap"
          style={{
            pointerEvents: "auto",
            flex: showCart ? "none" : 1,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 9,
            border: "1px solid var(--pri)", cursor: "pointer", borderRadius: "var(--r-elevated)", padding: "14px 16px",
            background: tableSession.waiterCalled ? "var(--pri)" : "var(--glassStrong)",
            backdropFilter: "saturate(180%) blur(22px)", WebkitBackdropFilter: "saturate(180%) blur(22px)",
            color: tableSession.waiterCalled ? "var(--priInk)" : "var(--acc)",
            font: "600 var(--t-b) var(--font)", whiteSpace: "nowrap",
            boxShadow: "var(--shadow-waiter)"
          }}
        >
          <i className="fa-solid fa-bell-concierge" style={{ fontSize: "var(--i-m)" }} />
          {tableSession.waiterCalled ? "Garçom a caminho" : "Chamar garçom"}
        </button>
      )}
      {showCart && (
        <button
          type="button"
          onClick={() => navigate("/cart")}
          className="tap"
          style={{
            pointerEvents: "auto", flex: 1, minWidth: 0, border: "none", cursor: "pointer",
            borderRadius: "var(--r-elevated)", padding: "14px 16px", background: "var(--pri)", color: "var(--priInk)",
            display: "flex", alignItems: "center", gap: 12, boxShadow: "var(--shadow-cart)",
            animation: "dcRise .4s var(--ease-spring) both"
          }}
        >
          <span style={{ position: "relative", flex: "none", width: 28, height: 28, borderRadius: 999, background: "rgba(252,247,211,.18)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <i className="fa-solid fa-basket-shopping" style={{ fontSize: "var(--i-s)" }} />
            <span style={{ position: "absolute", top: -5, right: -6, minWidth: 17, height: 17, padding: "0 4px", boxSizing: "border-box", borderRadius: 999, background: "var(--priInk)", color: "var(--pri)", font: "700 10px var(--font)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {count}
            </span>
          </span>
          <span style={{ flex: 1, textAlign: "left", font: "600 var(--t-b) var(--font)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            Ver carrinho
          </span>
          <span style={{ font: "700 var(--t-m) var(--font)" }}>{brl(subtotal)}</span>
        </button>
      )}
    </div>
  );
}
